# Current State

Last updated: 2026-10-21
Maintainer: Magda

## Current release state

Iteration 4 (v0.6.1) implementation and retrospective documentation are on
`dev`. The v0.6.1 candidate is prepared for a separate `dev` → `main` release
pull request; it has not been merged to `main` or deployed by this closeout.
Repository state is not evidence of the live Production version or provider
configuration.

## Delivered application state

- Firebase Authentication remains the identity, credential, session, provider,
  and verification authority. Firebase UID is the cross-system identity key;
  email is not used to merge accounts.
- Neon PostgreSQL behind authenticated Vercel APIs is the canonical application
  state store. Workspace/campaign creation, memberships, invitations, profile
  preferences, Campaign Settings, authentication-email limiting, and active
  campaign entities use that boundary in the current implementation.
- Direct Brevo is the application mail transport. Firestore has no active
  browser application-state repository or application mail/limiter writer.
- The active campaign product includes PCs, Bag of Holding, Items, Sessions,
  NPCs, Locations, Lore, Quests, Arcs, Milestones, and typed entity links.
  Quests have campaign-scoped persistence and reciprocal relationships. Arcs
  and Milestones are GM-only: navigation, direct routes, APIs, and reciprocal
  relationship data are unavailable in Player mode.
  The standalone Relationships and Conditions pages remain retired.
- Issue #360 persists explicit filters per user/context. Issue #340 resolves
  canonical NPC–Location links from both profiles. Issue #268 adds measured,
  targeted loading feedback. Issues #342/#389 establish responsive width
  patterns; #378 makes the browser Firestore-retirement regression part of the
  unit layer; #377 makes documentation reconciliation inventory coverage
  explicit.
- The public site is separated from protected application bootstrap. Invitation
  acceptance resolves before independent-user onboarding.

Implementation evidence and the actionable Iteration 4 retrospective are in
[`iteration-4-retrospective-notes.md`](../sprints/iteration-4-retrospective-notes.md).

## Authorization and known gaps

Workspace and campaign membership roles are separate from selected GM/Player
mode. The membership schema comments declare workspace `owner`/`gm`/`player`
and campaign `gm`/`player`; the text columns have no database enum/check. Some
current workspace writers can persist `admin` or `member`, despite those
comments. The API authorization helpers give workspace owner-only authority to
specific operations and campaign-GM authority to selected operations; checks
are path-specific. Some GM-role writes do not test selected Player mode. Do not
read the UI mode or the older permission matrix as proof that every endpoint
enforces one uniform matrix. The implementation-grounded
[role and mode guide](../multitenant-multirole-management.md) records the
verified checks and limitations; broader authorization refinement remains in
[#284](https://github.com/dopaminedungeon/dopamine-dungeon/issues/284).

Campaign and workspace isolation remains a required invariant, but individual
handlers differ in how they resolve a campaign and apply membership predicates.
The shared workspace-and-campaign resolver is workspace-scoped; some older
routes resolve a campaign slug before checking membership. A route-wide audit
is not implied here.

## Transitional persistence and Production risk

The Development application migration is implemented; operational Firestore
retirement is not certified. The one-time Production audit route was removed
from `dev` and `main` by [PR #373](https://github.com/dopaminedungeon/dopamine-dungeon/pull/373),
and the source removal was verified by [PR #403](https://github.com/dopaminedungeon/dopamine-dungeon/pull/403).
The private #373 report could not be located. The #375 ledger records unknown
execution for Production migrations `0014`–`0022`, Google-only verification,
limiter import, Firestore rules/indexes/TTL/Trigger Email state, rollback and
retention evidence, deny-all canary, and physical retirement. These gates are
unverified, not evidence that work did or did not happen. Do not repeat or
perform an operation based on this repository snapshot; follow the
[migration ledger](../architecture/FIRESTORE_TO_NEON_MIGRATION.md#375-production-evidence-ledger-reviewed-2026-10-12)
and [Deployment runbook](../operations/DEPLOYMENT.md).

## Current iteration and next inputs

Iteration 4 implementation dependencies have merged to `dev`; #407 records the
retrospective and documentation closeout. On 2026-10-12, the Project 1 board
showed Iteration 4 as current for Oct 3–Oct 23, with the 16 dependency issues
and #407 assigned to Magda and grouped under **Ready for merge**. #407 had Low
priority, Low effort, and application version `n/a`. This was a board-view
snapshot, not a change to Project status. The next iteration and its owner,
dates, and committed scope are not yet confirmed; no work has been assigned to
it by this closeout.

Existing open issues are candidate inputs, not commitments:
[#271](https://github.com/dopaminedungeon/dopamine-dungeon/issues/271) for
mobile/tablet usability; [#348](https://github.com/dopaminedungeon/dopamine-dungeon/issues/348)
for typed relationship wording/types; [#270](https://github.com/dopaminedungeon/dopamine-dungeon/issues/270)
for the broader loading-state inventory; [#396](https://github.com/dopaminedungeon/dopamine-dungeon/issues/396)
for cross-tab saved-data synchronization; and [#322](https://github.com/dopaminedungeon/dopamine-dungeon/issues/322)
for the separate go-live security/domain audit. Authorization management and
deletion remain in [#284](https://github.com/dopaminedungeon/dopamine-dungeon/issues/284),
[#362](https://github.com/dopaminedungeon/dopamine-dungeon/issues/362),
[#363](https://github.com/dopaminedungeon/dopamine-dungeon/issues/363), and
[#364](https://github.com/dopaminedungeon/dopamine-dungeon/issues/364). These
are existing issues found in the repository; this closeout creates no duplicate.

The full directional roadmap is in [`ROADMAP.md`](ROADMAP.md). Iteration
history is kept in the Iteration 2, 3, and 4 retrospective records.

## Partial or deferred product state

- Location file upload remains transitional.
- Global search is not implemented.
- Dashboard status signals are guidance rather than activity-derived data.
- Friendship Index concepts remain future work built on typed links, not a
  current standalone relationship feature.
- Public About, Pricing, and Resources surfaces remain coming soon; their
  design/copy acceptance is tracked in [#290](https://github.com/dopaminedungeon/dopamine-dungeon/issues/290)
  and [#291](https://github.com/dopaminedungeon/dopamine-dungeon/issues/291).
- Some domain permission logic is duplicated and requires path-specific
  review; the [permission guide](../multitenant-multirole-management.md) is an
  implementation reference, not a policy guarantee.

## Stable boundaries

- Firebase Authentication remains identity authority; Neon remains canonical
  application persistence.
- `dev` is integration/preview; `main` is the Production source. Do not infer
  current live deployment state from either branch.
- Preserve Firebase UID identity, workspace/campaign isolation, and
  server-side Player-safe projections.
- Do not alter Production data, provider configuration, secrets, or deployment
  settings without the separate operator approval and verification gates.
