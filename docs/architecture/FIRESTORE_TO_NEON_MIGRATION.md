# Firestore to Neon Migration Inventory and Authorization Matrix

Status: Phase 1 inventory

Date: 2026-08-28

Related issue: [#298](https://github.com/dopaminedungeon/dopamine-dungeon/issues/298)

## Scope and evidence

This document records the current repository audit for #298. The issue body is
not exhaustive: paths below were discovered from current source, tests,
migration scripts, and repository configuration. It is not evidence of every
document or collection that may exist in a live Firebase environment.

Effective Firestore rules, indexes, TTL policies, and Trigger Email extension
configuration are console-managed and not committed in this repository. Their
export from each environment is a required Phase 1 input. Entries marked
**Pending environment export** must not have their historical Firestore
permissions inferred from application code.

Firebase Authentication remains authoritative for authentication, credentials,
sessions, providers, and current email-verification state. Firebase UID is the
only cross-system identity key. Normalized email is not an identity migration
key and must not merge, transfer, or reconcile users, memberships, roles, or
application data.

## Firestore inventory

| Firestore path | Audit status and owner | Readers and writers | Purpose and sensitivity | Existing Neon/API destination | Migration disposition and gaps |
| --- | --- | --- | --- | --- | --- |
| `users/{firebaseUid}` | Active; browser client SDK | `AuthContext` initializes, `Settings` reads/writes, user repository writes | Profile and preferences. Contains email, display name, photo URL, onboarding state, and login metadata. Self-only boundary required. | Neon `users`, provisioned through `/api/me`, stores UID, email, display name, and verification history. No profile-preference API/model. | **Migrate**. Define allowed self-editable fields; reconcile profile fields absent from Neon. |
| `tenants/{tenantId}` | Active and legacy; browser client SDK | Canonical creation now uses the authenticated workspace API; tenant repository and bootstrap service remain legacy readers/writers | Workspace record. Tenant isolation boundary. Legacy documents may contain a Firestore-only `description`. | Neon `workspaces`; canonical creation uses `/api/workspace`. Workspace descriptions are intentionally retired and have no Neon destination. | **Replace** canonical creation; **reconcile** remaining legacy records. Inventory/export legacy `description` values before destructive retirement, then archive or delete them under the approved retention decision. Do not migrate descriptions into Neon. |
| `tenantMembers/{membershipId}` | Active and legacy; browser client SDK | Tenant context, tenant-member repository, bootstrap, legacy invitation and workspace-member services | Workspace roles and membership. Role escalation/isolation risk. Some legacy shapes include user email/display name. | Neon `workspace_memberships`; `/api/workspace?resource=workspacePeople` supports people management. | **Reconcile**, then **delete after verification**. Canonical creation path is missing. |
| `campaigns/{campaignId}` | Active and historical migration input; browser client SDK and Admin SDK scripts | Campaign context/repository/bootstrap write; Campaign Settings writes/deletes; migration scripts read root records | Campaign bootstrap plus extended settings. Includes GM-private notes, hidden factions/timelines, and player-visible summaries. | Neon `campaigns`; `/api/campaign-content?resource=campaignPeople` covers people and base campaign updates only. | **Replace** active writes; **migrate/reconcile** historical records. No destination/API for extended fields or deletion. |
| `campaigns/{campaignSlug}/characters/{id}` | Historical migration input; Admin SDK | Character migration script reads | Campaign character data; visibility follows campaign membership and assignment rules. | Neon `characters` and protected content APIs. | **Reconcile**, then **archive/delete after verification**. Preserve IDs where routes depend on them. |
| `campaigns/{campaignSlug}/sessions/{id}` | Historical migration input; Admin SDK | Session migration script reads; Campaign Settings bulk-deletes legacy documents | Campaign session data; tenant/campaign scoped. | Neon `sessions` and protected APIs. | **Reconcile**, then **archive/delete after verification**. |
| `campaigns/{campaignSlug}/items/{id}` | Historical migration input; Admin SDK | Item migration script reads; Campaign Settings bulk-deletes legacy documents | Campaign item data; tenant/campaign scoped. | Neon `items` and protected APIs. | **Reconcile**, then **archive/delete after verification**. |
| `campaigns/{campaignSlug}/meta/bag` | Historical migration input; Admin SDK | Bag migration script reads; Campaign Settings bulk-deletes legacy documents | Campaign bag metadata. | Neon `bag_currency` and `bag_entries`. | **Reconcile**, then **archive/delete after verification**. |
| `campaignMembers/{membershipId}` | Active and legacy; browser client SDK | Campaign context/repository/bootstrap and legacy invitation/workspace-member services | Campaign roles and access. Cross-campaign isolation and GM/Player boundary. | Neon `campaign_memberships`; `/api/campaign-content?resource=campaignPeople` manages people. | **Reconcile**, then **delete after verification**. Canonical campaign-create operation is missing. |
| `invitations/{invitationId}` | Legacy/uncertain; browser client SDK | Legacy invitation service and repository read/write | Pending/accepted invitation state, recipient email, roles, and character IDs. Email-sensitive. | Neon `invitations`; `/api/invitations` and `/api/invitations/accept-pending`. | **Reconcile**. Firestore permits workspace-only invitations and ID arrays; Neon currently requires campaign ID and stores a string. Static non-use is not proof it is safe to delete. |
| `characterAssignments/{assignmentId}` | Legacy/uncertain; browser client SDK | Legacy invitation and workspace-member services read/write | Player-to-character assignment. Role and campaign confidentiality boundary. | Neon `character_assignments`; `/api/campaign-content?resource=characterAssignments`. | **Reconcile**, then **delete after verification**. |
| `mail/{mailId}` | Active server delivery dependency; Admin SDK. Legacy browser helper also exists. | Invitation, verification, and recovery server paths add documents; legacy mail repository can add | Firestore Trigger Email queue. Recipient and rendered mail necessarily contain delivery-sensitive data, including action links in applicable messages. | No replacement. | **Replace** with approved server-only delivery queue/transport. Do not treat this queue as abuse-control or application logging storage. |
| `_authVerificationCooldowns/{firebaseUid}` | Active; Admin SDK only | Verification email limiter transaction reads/writes | Per-UID resend throttling. Stores bounded rolling timestamps and TTL metadata. | No replacement. | **Replace** with a server-only atomic limiter. Preserve accurate retry timing. |
| `_authPasswordRecoveryCooldowns/{emailHmac}` and legacy fingerprint variant | Active; Admin SDK only | Recovery limiter transaction reads/writes | Per-recovery-email throttling. HMAC fingerprint only; recovery responses remain account-neutral. | No replacement. | **Replace** with a server-only atomic limiter. Preserve HMAC domain separation and enumeration-resistant timing. |
| `_authPasswordRecoveryIpCooldowns/{ipHmac}` | Active; Admin SDK only | Recovery limiter transaction reads/writes | Per-source-IP abuse throttling. HMAC fingerprint only. | No replacement. | **Replace** with a server-only atomic limiter using the same trusted platform-IP policy. |

The audit found no committed Firestore rules or indexes and no committed
Trigger Email extension configuration. Dynamic collection access or documents
created outside this repository remain an unresolved environment-export
question.

## Authorization replacement matrix

The current Firestore permission boundary is unknown for every client-SDK path
until the effective rules are exported. Admin SDK paths bypass Firestore rules
by design. The future architecture remains server-API mediated; this document
does not propose PostgreSQL RLS because the browser does not directly access
Neon.

| Responsibility | Current path and known boundary | Required replacement | Required parity tests |
| --- | --- | --- | --- |
| Self profile and settings | Browser `users/{uid}`. **Pending environment export** for Firestore rule. | Authenticated API derives UID from token; self-only field allowlist; query scoping to one Neon user; unique Firebase UID constraint. | Other-user read/write denied; allowed fields persist; UID/body spoof ignored; same-email/different-UID isolation. |
| Workspace creation and membership | Browser `tenants`/`tenantMembers`. **Pending environment export**. | Authenticated API; UID-to-Neon identity resolution; one atomic, idempotent Neon workspace-plus-owner transaction; subsequent membership operations require workspace-role validation and constraints. | Concurrent/retry creation; exactly one owner membership; non-owner role change/remove denied; cross-workspace query isolation. |
| Campaign creation and membership | Browser `campaigns`/`campaignMembers`. **Pending environment export**. | Authenticated API; validate workspace membership; one atomic, idempotent Neon campaign-plus-initial-GM transaction; campaign-scoped membership authorization. | Concurrent/retry creation; GM assignment; non-member denial; cross-campaign isolation; Player cannot gain GM behavior. |
| Campaign settings and GM-private fields | Browser root campaign and subcollection writes/deletes. **Pending environment export**. | GM-only authenticated API; campaign membership validation; query scoping; response filtering that excludes GM notes and hidden fields for Players; Neon constraints for campaign ownership. | GM update succeeds; Player read excludes private fields; Player mutation denied; delete is atomic and scoped. |
| Invitations and acceptance | Active APIs use Neon invitations; legacy Firestore invitation path has **Pending environment export**. | Server-only invite creation; workspace-owner/campaign-GM validation; atomic, idempotent acceptance; campaign/workspace membership and assignment validation; no email identity migration. | Inviter authorization; repeated acceptance; wrong UID/same-email isolation; expired/pending state; assignment and role boundaries. |
| Character assignments | Legacy browser `characterAssignments`. **Pending environment export**. | Authenticated API; campaign membership and GM/Player mode validation; scoped reads; Neon uniqueness constraints. | GM assignment changes; Player restricted view; unrelated campaign denied; duplicate assignment constraint. |
| Email queue | Admin Firestore `mail`; Admin bypasses rules. | Server-only queue/transport with sender configuration held server-side. No client direct queue access. | Unauthorized caller cannot enqueue; invitation regression; verification/recovery delivery behavior; sensitive payload absent from logs/metrics. |
| Verification cooldown | Admin Firestore transaction; no Firestore-rule boundary. | Server-only atomic limiter keyed by Firebase UID; bounded windows/expiry; accurate `Retry-After`. | Cooldown/hour/day boundaries; concurrent requests; storage failure; accurate wait time. |
| Recovery cooldown | Admin Firestore transaction; no Firestore-rule boundary. | Server-only atomic combined email-HMAC and trusted-IP-HMAC limiter; all-or-none reservation; generic account-neutral response and timing. | Existing/nonexistent equivalence; IPv4/IPv6; spoofed headers; concurrent requests; limiter failure; no raw identifier persistence. |

## Migration ordering and gates

1. Export and archive environment-specific Firestore rules, indexes, TTL
   policies, Trigger Email extension configuration, collection counts, and
   representative document shapes.
2. Implement canonical workspace and campaign creation through authenticated,
   atomic, idempotent Neon APIs.
3. Migrate profile and settings storage.
4. Reconcile memberships, invitations, and character assignments.
5. Move campaign settings and lifecycle operations, including GM-private data.
6. Harden migration and reconciliation tooling with dry-run, explicit apply,
   environment targeting, validation, and reporting.
7. Replace the email queue and cooldown limiters with server-owned facilities.
8. Run cutover and parity validation with rollback/forward-fix gates.
9. Deploy a deny-all Firestore canary after application and operational
   dependencies are proven absent.
10. Retire Firestore code, configuration, extensions, and dependencies only
    after the canary and archival requirements succeed.

Moving application reads is not sufficient to begin destructive Firestore
retirement. Writes, Admin SDK dependencies, migration/recovery needs, rules,
indexes, TTL, Trigger Email, data reconciliation, and rollback evidence must
all be resolved first.

## Open questions and gates

- Exported rules, indexes, TTL, and extension configuration for every
  environment are still required.
- Live collection inventory and document shapes may contain paths not found by
  static analysis.
- The canonical destination and visibility policy for extended campaign
  settings remain undefined.
- Legacy invitation conversion requires a decision for workspace-only
  invitations and multi-character assignment shapes.
- Profile preferences need an explicit Neon model/API destination.
- Mail delivery and rate limiting need approved replacement infrastructure.
- Migration scripts need formal reconciliation and safety controls before they
  can be used for a cutover.

## Related architecture records

- [ADR 0003](adr/0003-transitional-firestore-postgres-persistence.md)
- [ADR 0004](adr/0004-firebase-identity-and-email-verification.md)
- [ADR 0006](adr/0006-canonical-workspace-and-campaign-creation.md)
- [System Overview](SYSTEM_OVERVIEW.md)
