# Firestore to Neon Migration Inventory and Authorization Matrix

Status: Development implementation complete; Production operational completion
requires operator evidence (reviewed 2026-10-12; see #375 ledger below)

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
- Retained campaign settings use explicit Neon columns and a Player-safe API
  projection that omits `gmNotes`. Any additional settings need a separate
  product decision; they are not implicitly persisted.
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

The one-time Production audit was completed through a temporary,
claim-gated, read-only path in `api/worldbuilding`. Its sanitized evidence was
captured, the temporary claim was removed, and the route/module were removed
from the release source. The Production release checklist still requires
snapshotting and preserving the final 24-hour Firestore limiter horizon,
importing and reconciling opaque subjects/attempts into Neon, and retaining
Firestore source evidence for rollback. Trigger Email disablement, rules
deny-all, and physical Firestore retirement remain separate later operational
windows.

## #375 Production evidence ledger (reviewed 2026-10-12)

This ledger reconciles repository, public PR, and locally available sanitized
Development report evidence only. It does not authorize or perform Production
operations. The checkout contains three ignored Development reports from
2026-08-31; no Production reconciliation report or access-controlled operator
archive, Production migration ledger, Production Google-only manifest,
Production limiter export/import report, configuration archive, or rollback
record was available to this review. A missing report is **unverified**, not
proof that an operation did not happen. Do not rerun a potentially completed
operation to manufacture evidence.

The requester confirms they are the sole prospective Production release
operator. No personal name or independent approver is recorded in this
handoff. The tentative maintenance target is around 2027-01-12; this is a
planning target, not approval or a scheduled window. The exact date/time and
rollback-retention period remain undecided. The requester does not know which,
if any, Production migrations, limiter imports, Google-only verification
steps, or Firestore changes have occurred; these remain **unverified**, not
evidence of either execution or non-execution.

Safe public evidence references are [PR #365](https://github.com/dopaminedungeon/dopamine-dungeon/pull/365)
(merged 2026-09-01), [PR #372](https://github.com/dopaminedungeon/dopamine-dungeon/pull/372)
(merged 2026-09-04), and [PR #373](https://github.com/dopaminedungeon/dopamine-dungeon/pull/373)
(merged 2026-09-04). PR #365 records Development/Preview implementation and
explicitly defers Production migration, limiter import, and Firestore
retirement. PR #372 lists the Production gates and says its merge did not
perform them. PR #373 confirms the one-time read-only audit was captured and
reviewed, the temporary claim was removed and verified absent, and the route
was retired. It does not publish the private audit report or prove the other
gates below. The requester cannot locate the private report or identify where
it was stored. The `Owner: Magda` label in the deployment runbook is
documentation ownership, not evidence that Magda is the release operator.

| Gate | Target | Status | Dated sanitized evidence reference | Owner and next decision |
| --- | --- | --- | --- | --- |
| Development implementation and Preview validation | Development / Preview | completed | PR #365, merged 2026-09-01; PR #372, merged 2026-09-04, reports authenticated bootstrap, persistence, verification/recovery, invitation, selected-mode, and direct-mail Preview checks. | No Production completion follows from this. Preserve those PRs as implementation evidence. |
| Development inventory/reconciliation report generation | Development | completed | Ignored sanitized summaries: `reports/firestore-reconciliation/development/2026-08-31T18-07-34-847Z/summary.md`, `reports/firestore-reconciliation/development/2026-08-31T18-28-59-136Z/summary.md`, and `reports/firestore-reconciliation/development/2026-08-31T18-38-51-997Z/summary.md`. The full JSON reports stay private and uncommitted. | This is Development evidence only. Do not use its limiter export or classifications as Production proof. |
| Current disposition of Development unresolved findings | Development | unverified | The latest visible Development summaries from 2026-08-31 include `NEEDS_RECONCILIATION` and `UNRESOLVED` classifications. No later Development disposition report was available. Exact per-record findings remain in ignored private reports. | Locate later reviewed evidence or assign an authorized owner to resolve findings; preserve opaque references and do not infer current closure from these dated reports. |
| One-time Production audit capture and temporary claim removal | Production | completed | PR #373, merged 2026-09-04, reports sanitized audit capture/review and verified claim removal. The requester cannot locate the private report or identify its storage location; no private artifact was available here. | Do not rerun the retired route or restore the claim. Recover the report only if it can be safely located; otherwise retain this as PR-reported evidence and do not claim access to its contents. |
| Migration 0014 — nullable `users.email_verified_at` | Production Neon | unverified | PR #372 specifies sequence, not application; Production ledger/schema proof is unavailable as of 2026-10-12. | Sole prospective operator (per requester; no name recorded) must obtain sanitized ledger/schema proof. Do not reapply based on this document. |
| Migration 0015 — workspace creation request key and uniqueness | Production Neon | unverified | PR #372 specifies sequence, not application; no Production ledger/schema proof was available. | Verify ledger and resulting schema before any action; decide forward-fix/restore response. |
| Migration 0016 — campaign creator/request key and uniqueness | Production Neon | unverified | PR #372 specifies sequence, not application; no Production ledger/schema proof was available. | Verify ledger and constraints before any action. |
| Migration 0017 — `users.reduced_motion` | Production Neon | unverified | PR #372 specifies sequence, not application; no Production ledger/schema proof was available. | Verify ledger, default, and nullability before any action. |
| Migration 0018 — campaign summary, GM notes, dates, and update timestamp | Production Neon | unverified | PR #372 specifies sequence, not application; no Production ledger/schema proof was available. | Verify ledger/schema and GM-only projection evidence; do not infer from Development. |
| Migration 0019 — invitation-character assignments and expiry | Production Neon | unverified | PR #372 specifies sequence, not application; no Production ledger/schema proof was available. | Verify ledger, foreign key, and invitation assignment parity. |
| Migration 0020 — auth-email limiter subject/attempt tables | Production Neon | unverified | PR #372 specifies sequence, not application; no Production ledger/schema proof was available. | Verify ledger/schema before evaluating limiter import. |
| Migration 0021 — limiter timestamp time-zone corrections | Production Neon | unverified | PR #372 specifies sequence, not application; no Production ledger/schema proof was available. | Verify ledger and timestamp interpretation before comparing exported attempts. |
| Migration 0022 — invitation lifecycle fields and active uniqueness index | Production Neon | unverified | PR #372 records sequence and duplicate preflight, not application; no sanitized preflight/ledger/schema result was available. | Verify duplicate preflight result and index before any action; retain its evidence. |
| Firestore-to-Neon dispositions, including unresolved/archive-only records | Production Firestore + Neon | unverified | No Production `inventory.json`, `reconciliation.json`, `unresolved.json`, or sanitized `summary.md` was available in the checked report directory or reviewed PR text as of 2026-10-12. The local 2026-08-31 reports are Development-only. | Obtain the access-controlled sanitized report and review every unresolved/needs-reconciliation disposition. Existing migration scripts are not approved for Production apply by this ledger. |
| Google-only verification migration | Production Firebase + Neon | unverified | PR #372 documents a separate guarded dry-run/manifest/apply gate; no Production dry-run, reviewed manifest, apply report, or post-run verification was available. | Confirm via report whether eligible accounts existed. Mark inapplicable only if a target-proven dry run reports none; otherwise obtain separate approval and review partial/failed/skipped outcomes. Never rerun a possibly completed apply. |
| Complete active 24-hour limiter horizon preserved/imported; counts/timestamps reconciled; fail-closed handoff | Production Firestore + Neon | unverified | PR #365 explicitly deferred this; PR #372 specifies the gate. No private limiter manifest, checksum, count/timestamp comparison, import result, or cutover record was available. | Sole prospective operator must locate access-controlled evidence or obtain approval for a new cutover. Preserve opaque UID/HMAC keys and timestamps; never put keys or export contents in this repository. |
| Preview auth/API/mail and GM/Player validation | Preview | completed | PR #365, merged 2026-09-01, and PR #372, merged 2026-09-04, report Preview bootstrap, recovery/verification, invitation, mode-boundary, and direct-mail workflows. PR #372 also records 70 full-E2E passes and 3 failures (touch-target assertion, missing expected console error, obsolete seed heading). | This is Preview evidence only. The accessible summary does not distinguish provider acceptance from inbox delivery; keep those separate and unverified. Review the three E2E failures before treating those journeys as release evidence. |
| Cross-scope runtime verification | Preview / Production | unverified | PR #365 says cross-scope runtime testing was deferred because creating another persistent campaign only for the test would leave shared state while campaign deletion remained deferred to #364. Existing API/boundary tests do not establish a live Production result. | Record explicit other-workspace/campaign denial results after release approval; any runtime fixture needs an approved cleanup plan. This documented deferral is not an approval to skip Production authorization checks. |
| Production auth/API/mail, GM/Player, and tenant/campaign checks | Production | unverified | PR #372 reports Preview validation, not Production verification. No Production smoke record was available as of 2026-10-12. | After target/release approval, record sanitized auth, API, selected-mode, GM-only projection, mail, and cross-scope results. |
| Effective Firestore rules, indexes, TTL, and Trigger Email configuration archive | Production | unverified | Repository inventory says these are console-managed and not committed. PR #372 requires an archive; no sanitized archive reference was supplied. | Sole prospective operator must locate or create the approved access-controlled archive before any config change. Record only an internal reference and review disposition. |
| Rollback readiness, source/archive retention, and historical-data disposition | Production | unverified | PR #372 describes prior-deployment application rollback, migration forward-fix/approved restore, and Firestore retention; no actual backup, retention approval, restore test, or expiry date was available. | Decide and record retention interval, archive owner, restore authority, and deletion approval. Application rollback does not reverse migrations. Preserve historical data until parity and rollback gates pass. |
| Trigger Email disablement | Production | unverified | PR #365 says it was not disabled in that work; PR #372 reserves a later change window. No subsequent operator record was available. | First verify current state. If still enabled, schedule a separately approved window only after direct Brevo operation, sender/DNS checks, and rollback readiness are evidenced. |
| Monitored Firestore deny-all canary | Production | unverified | PR #372 reserves a separate later window; no canary result, monitoring interval, or rollback record was available. | First verify current rules/state. Define owner, observation window, success/error thresholds, monitoring, and restore procedure; obtain separate approval before a canary. |
| Physical Firestore/configuration retirement and data-deletion disposition | Production | unverified | PR #372 defers physical/historical retirement; no deletion approval, retention expiry, or archive verification was available. | Keep data/configuration intact until reconciliation, replacement authorization, canary, and retention gates pass. Obtain separate data-owner approval and record exact scope before retirement. |

The inventory documents workspace-only Firestore invitations as an explicitly
retired application behavior. This is a design-level disposition, not proof
that Production contains none and not authorization to delete any matching
records. Their actual Production count and per-record reconciliation status
remain unverified until the sanitized report is available.

No Production gate is marked pending solely because a runbook says it should
happen; current state must first be confirmed by the sole prospective
operator. No gate is currently proven inapplicable. Google-only verification is inapplicable only
if an approved target-proven dry run establishes that no eligible accounts
exist.

### Ordered operator handoff (no action authorized by #375)

1. **Recover evidence and resolve approval ownership:** the requester confirms
   they are the sole prospective release operator (no personal name is
   recorded here); identify an independent approver and the approved private
   evidence/archive location; reconcile any existing Production migration
   ledger, audit report, record dispositions,
   Google-only manifest/results, limiter evidence, configuration archive,
   deployment record, and rollback/retention approval. Do not repeat completed
   work. Resolve whether Production already runs the Iteration 3 release before
   proposing a change.
2. **Read-only readiness review:** prove the exact Firebase/Neon/Vercel target
   from non-secret metadata; inspect migration state and the `0022` duplicate
   preflight evidence; review Firestore dispositions and effective
   rules/indexes/TTL/Trigger Email archive; resolve Preview resource-sharing
   topology where relevant. Stop on missing, conflicting, or unresolved
   evidence. The existing reconciliation reporter is read-only; legacy
   migration scripts are not a Production importer and are not approved for
   apply.
3. **Approve cutover and rollback before a change window:** explicitly approve
   any required migrations in order `0014`–`0022`, Google-only verification
   only if applicable, the complete final active 24-hour limiter snapshot and
   import, exact count/timestamp reconciliation, and a controlled fail-closed
   handoff before Neon becomes authoritative. Capture results after each step.
   No dual-read/write is allowed. Keep Firestore source data and the export for
   an operator-approved retention period. Set that period and restore authority
   before beginning; neither is established by current evidence. The tentative
   planning target is around 2027-01-12, not an approved or scheduled window.
   Decide the exact date/time and rollback-retention period before proceeding.
   Migration rollback is forward-fix or an approved database restore, not
   application rollback.
4. **Deploy and verify only after gates pass:** use the approved release
   workflow, then record sanitized Production auth/API/mail, GM/Player
   visibility, cross-workspace/campaign denial, and non-destructive smoke
   evidence. Record Brevo provider acceptance separately from inbox delivery.
   If a check fails, stop rollout and use the approved application rollback
   while preserving migrations and source evidence.
5. **Separate Trigger Email disablement window:** verify current state and
   dependencies first. Disable only after archived configuration, accepted
   direct-mail tests, monitored sender/DNS/provider readiness, sole prospective
   operator, independent approver, and rollback procedure are recorded.
6. **Separate deny-all canary window:** only after replacement authorization
   checks and absence of Firestore application dependencies are proven. Approve
   a monitored duration, alert thresholds, operator, and rules-restore
   procedure; record the canary result before advancing.
7. **Separate physical retirement window:** only after successful canary,
   complete reconciliation with no unresolved data, verified archives, and
   expiry of the explicitly approved retention period. Obtain data-owner and
   operational approval for the exact records/configuration to retire. Preserve
   source archives and audit evidence according to the approved retention
   policy; no exact date/time or retention expiry is established.

The private evidence reference must be an access-controlled internal pointer
recorded by the operator, not a copied report or secret in this repository.
Until supplied, the relevant status remains **unverified**.

## Related architecture records

- [ADR 0003](adr/0003-transitional-firestore-postgres-persistence.md)
- [ADR 0004](adr/0004-firebase-identity-and-email-verification.md)
- [ADR 0006](adr/0006-canonical-workspace-and-campaign-creation.md)
- [System Overview](SYSTEM_OVERVIEW.md)
