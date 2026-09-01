# Firestore to Neon Migration Inventory and Authorization Matrix

Status: Development implementation complete; Production release operations pending

Date: 2026-08-28

Related issue: [#298](https://github.com/dopaminedungeon/dopamine-dungeon/issues/298)

## Scope and evidence

This document records the current repository audit and completed Development
implementation for #298. The issue body is
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

Development implementation is complete: browser application state uses
authenticated APIs backed by Neon, transactional mail uses direct Brevo, and
auth-email limiter persistence uses Neon. Remaining Firestore entries are
historical inputs or operational rollback evidence until the Production release
gates below are completed.

## Firestore inventory

| Firestore path | Audit status and owner | Readers and writers | Purpose and sensitivity | Existing Neon/API destination | Migration disposition and gaps |
| --- | --- | --- | --- | --- | --- |
| `users/{firebaseUid}` | Historical migration input; browser application path retired | Legacy migration/reconciliation tooling only | Legacy profile and preference fields. | Neon `users`, provisioned through `/api/me`, with self-only field allowlist. | Retain for environment export/reconciliation and rollback evidence; no active browser reader/writer remains. |
| `tenants/{tenantId}` | Historical migration input; unreachable browser repository retired. | Canonical browser creation/projection use `/api/workspace` and `/api/me`. | Workspace record. Legacy documents may contain a Firestore-only `description`. | Neon `workspaces`. | Browser Firestore path is retired. Export/reconcile legacy values before destructive data retirement. |
| `tenantMembers/{membershipId}` | Historical migration input; no active application repository | `scripts/migrate-firebase.ts` reads legacy membership records. | Workspace roles and membership. Role escalation/isolation risk. Some legacy shapes include user email/display name. | Neon `workspace_memberships`; `/api/workspace?resource=workspacePeople` supports people management. | **Retired application code**. Retain data and migration tooling until environment export/reconciliation gates pass. |
| `campaigns/{campaignId}` | Historical migration input; unreachable browser repository/bootstrap service retired. | Canonical campaign creation/projection use authenticated APIs and `/api/me`; Campaign Settings uses `/api/campaign-content?resource=campaignSettings`; migration scripts read root records. | Campaign bootstrap plus settings. Retained values are `name`, `description`, `status`, `system`, `playerSummary`, `startDate`, `endDate`, and GM-private `gmNotes`. | Neon `campaigns` explicit columns; authenticated `campaignSettings` handler. | Browser Firestore path is retired. Legacy values require export/retention review; campaign deletion is deferred to [#364](https://github.com/dopaminedungeon/dopamine-dungeon/issues/364). |
| `campaigns/{campaignSlug}/characters/{id}` | Historical migration input; Admin SDK | Character migration script reads | Campaign character data; visibility follows campaign membership and assignment rules. | Neon `characters` and protected content APIs. | **Reconcile**, then **archive/delete after verification**. Preserve IDs where routes depend on them. |
| `campaigns/{campaignSlug}/sessions/{id}` | Historical migration input; Admin SDK | Session migration script reads | Campaign session data; tenant/campaign scoped. | Neon `sessions` and protected APIs. | **Reconcile**, then **archive/delete after verification**. |
| `campaigns/{campaignSlug}/items/{id}` | Historical migration input; Admin SDK | Item migration script reads | Campaign item data; tenant/campaign scoped. | Neon `items` and protected APIs. | **Reconcile**, then **archive/delete after verification**. |
| `campaigns/{campaignSlug}/meta/bag` | Historical migration input; Admin SDK | Bag migration script reads | Campaign bag metadata. | Neon `bag_currency` and `bag_entries`. | **Reconcile**, then **archive/delete after verification**. |
| `campaignMembers/{membershipId}` | Historical migration input; no active application repository | `scripts/migrate-firebase.ts` reads legacy membership records. | Campaign roles and access. Cross-campaign isolation and GM/Player boundary. | Neon `campaign_memberships`; `/api/campaign-content?resource=campaignPeople` manages people. | **Retired application code**. Preserve historical records until reconciliation gates pass. |
| `invitations/{invitationId}` | Historical migration/retention input; no active application repository | Legacy Firestore values are not consumed by application code. | Pending/accepted invitation state, recipient email, roles, workspace-only shape, and character-ID arrays. Email-sensitive. | Neon `invitations` with server-managed `expires_at`, plus `invitation_character_assignments`; `/api/invitations` and `/api/invitations/accept-pending`. | Workspace-only invitations are explicitly retired. Multi-character behavior is retained through typed relational rows. Historical values must be exported/reported, never silently transformed or dropped. |
| `characterAssignments/{assignmentId}` | Historical migration/retention input; no active application repository | Legacy invitation and workspace-member application services are retired. | Player-to-character assignment. Role and campaign confidentiality boundary. | Neon `character_assignments`; `/api/campaign-content?resource=characterAssignments`. | **Retired application code**. Retain historical input until reconciliation and rollback gates pass. |
| `mail/{mailId}` | Historical Trigger Email operational input; no active application writer. | Trigger Email configuration remains retained temporarily for rollback only. | Recipient and rendered mail may contain delivery-sensitive action links. | Server-owned Brevo REST transport called by invitation, verification, and recovery handlers. | **Replaced application path**. Do not disable the extension until controlled real-delivery validation and explicit decommission approval. |
| `_authVerificationCooldowns/{firebaseUid}` | Historical operational input after Neon limiter cutover | No application runtime reader/writer. Retain temporarily for production cutover/rollback reconciliation. | Per-UID resend throttling. | Neon `auth_email_rate_limit_subjects` and `auth_email_rate_limit_attempts`. | **Replaced application path**. Development/Preview start fresh; Production requires a final last-24-hour opaque-state import and reconciliation gate. |
| `_authPasswordRecoveryCooldowns/{emailHmac}` and legacy fingerprint variant | Historical operational input after Neon limiter cutover | No application runtime reader/writer. | Per-recovery-email throttling; HMAC only. | Neon limiter tables; current and legacy opaque HMAC keys remain separately addressable for the production cutover horizon. | **Replaced application path**. No plaintext identifier conversion is permitted. |
| `_authPasswordRecoveryIpCooldowns/{ipHmac}` | Historical operational input after Neon limiter cutover | No application runtime reader/writer. | Per-source-IP abuse throttling; HMAC only. | Neon limiter tables. | **Replaced application path**. Production export/import gate remains mandatory. |

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
| Campaign settings and GM-private fields | Canonical reads/writes use `/api/campaign-content?resource=campaignSettings`; legacy Firestore values remain **Pending environment export**. | Firebase-token authentication; resolve campaign server-side; require both workspace and campaign membership; require persisted campaign-GM role plus GM selected mode for mutation; strict field allowlist; server projection excludes `gmNotes` outside GM mode. | GM read/update and canonical read-back; Player-safe projection; Player-mode mutation denied; non-member and cross-workspace denial; unknown/server-owned field rejection. Campaign deletion is intentionally deferred to #364. |
| Invitations and acceptance | Active APIs use Neon invitations; Firestore mail delivery is intentionally retained temporarily. | Server-only seven-day expiration; relational multi-character invitation rows; atomic, idempotent acceptance; existing campaign roles are preserved; no email identity migration. | Inviter authorization; repeated acceptance; wrong UID/same-email isolation; expired/pending state; assignment and role boundaries. |
| Character assignments | Legacy browser `characterAssignments`. **Pending environment export**. | Authenticated API; campaign membership and GM/Player mode validation; scoped reads; Neon uniqueness constraints. | GM assignment changes; Player restricted view; unrelated campaign denied; duplicate assignment constraint. |
| Email queue | Admin Firestore `mail`; Admin bypasses rules. | Server-only queue/transport with sender configuration held server-side. No client direct queue access. | Unauthorized caller cannot enqueue; invitation regression; verification/recovery delivery behavior; sensitive payload absent from logs/metrics. |
| Verification cooldown | Server-only Neon transaction keyed by Firebase UID. | `auth_email_rate_limit_subjects` plus timestamp attempts; locked, bounded windows and accurate `Retry-After`. | Cooldown/hour/day boundaries; concurrent requests; storage failure; accurate wait time. |
| Recovery cooldown | Server-only Neon transaction keyed by email/IP HMACs. | Atomic combined reservation; generic account-neutral response and timing. | Existing/nonexistent equivalence; IPv4/IPv6; spoofed headers; concurrent requests; limiter failure; no raw identifier persistence. |

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

## Read-only inventory and reconciliation tooling

`scripts/firestore-reconciliation.ts` is the #298 read-only operational
inventory/reconciliation reporter. It requires an explicit target,
target-specific confirmation, explicit environment file, and matching Firebase
project ID; it has no apply mode and never selects inherited credentials. It
creates ignored, sanitized reports under
`reports/firestore-reconciliation/<target>/<timestamp>/` and detects unknown
top-level and campaign subcollection paths rather than assuming this inventory
is exhaustive.

Its reconciliation output now assigns one primary disposition per evaluated
record (`CANONICAL_IN_NEON`, `NEEDS_RECONCILIATION`, `ARCHIVE_ONLY`,
`EXPLICITLY_RETIRED`, or `UNRESOLVED`) and attaches independent secondary
findings for retired fields, role/scope mismatches, or compatibility evidence.
`unresolved.json` contains only records needing reconciliation or investigation;
harmless legacy/archive notices remain in the full report. Invitation mapping
requires an exact non-email identifier and is unresolved when that proof is
absent. Its 24-hour limiter export preserves only opaque Firebase UID/HMAC keys and
attempt timestamps for the later Production cutover import. It does not import
or mutate either datastore. See
[`FIRESTORE_RECONCILIATION.md`](../operations/FIRESTORE_RECONCILIATION.md) for
the command, sanitization contract, report meanings, manual configuration
archive checklist, and historical-script limitations.

## Open questions and gates

- Exported rules, indexes, TTL, and extension configuration for every
  environment are still required.
- Live collection inventory and document shapes may contain paths not found by
  static analysis.
- The canonical destination and visibility policy for extended campaign
  settings remain undefined.
- Workspace-only Firestore invitations are explicitly retired historical input.
  Their export/reconciliation report must list unresolved records before
  destructive retirement.
- Existing Neon `invitations.character_id` CSV data is transitional read
  compatibility only. New invitations use typed
  `invitation_character_assignments` rows; do not drop the CSV column before
  historical reconciliation.
- Trigger Email has no active application writer, but extension decommission
  remains an explicit operational approval after controlled delivery evidence.
- Expired Neon limiter rows are logically ignored and pruned on touched
  subjects. Physical deletion needs later operational housekeeping; it is never
  an authorization dependency.
- Production limiter cutover must export the final complete 24-hour Firestore
  horizon, import opaque UID/HMAC keys and timestamps, reconcile both counts
  and timestamps, and fail closed during the final cutover window. No
  dual-read/write is permitted. Development and Preview may begin fresh.
- Migration scripts need formal reconciliation and safety controls before they
  can be used for a cutover.

## Development closeout and Production release boundary

The Development portion of #298 is complete. The Iteration 3 implementation
includes migrations `0015_black_mandroid` through `0021_puzzling_kid_colt`,
Neon/API ownership for application state, direct Brevo delivery, Neon auth
limiter persistence, browser Firestore retirement, and validated
inventory/reconciliation tooling. Development and Preview validation are
complete; no Production migration or cutover is implied.

The future Production release must first run the temporary
`productionReadOnlyAudit` path through the existing `api/worldbuilding`
function. A controlled verified Firebase identity must receive the temporary
`productionAudit: true` custom claim, the sanitized audit must be captured,
then the claim and route/module must be removed and removal deployed. The
Production release checklist must verify migrations `0015`–`0021`, snapshot and
preserve the final 24-hour Firestore limiter horizon, import and reconcile
opaque subjects/attempts into Neon, and retain Firestore source evidence for
rollback. Trigger Email disablement, rules deny-all, and physical Firestore
retirement are separate later operational windows.

## Related architecture records

- [ADR 0003](adr/0003-transitional-firestore-postgres-persistence.md)
- [ADR 0004](adr/0004-firebase-identity-and-email-verification.md)
- [ADR 0006](adr/0006-canonical-workspace-and-campaign-creation.md)
- [System Overview](SYSTEM_OVERVIEW.md)
