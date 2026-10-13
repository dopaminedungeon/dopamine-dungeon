# Iteration 4 Retrospective — Bugfixing (v0.6.1)

Closeout snapshot: 2026-10-12
Owner: Magda
Project iteration: Iteration 4 - bugfixing (v0.6.1), observed Oct 03–Oct 23, 2026

## Outcome

The intended outcome was “Major bugs fixed, documentation updated.” All 16
major dependency issues listed by [#407](https://github.com/dopaminedungeon/dopamine-dungeon/issues/407)
have corresponding PRs merged into `dev`. They deliver the bounded persistence,
navigation, relationship, content, responsive-width, filter, loading, test
discovery, documentation-coverage, and maintenance fixes below. The closeout
then reconciles current docs and records known limitations.

This is implementation completion, not proof that every linked GitHub issue
was administratively closed, every manual acceptance criterion was repeated
in this closeout, or the candidate was released to Production. The v0.6.1
`dev` → `main` promotion is a separate step. No Product code, database,
provider, deployment, or Production change was made as part of closeout.

## Dependency and delivery evidence

The dependency issues are still shown as open in GitHub, but their
implementation PRs are merged into `dev`. Issue state alone was not used as a
completion signal.

| #407 dependency | Delivery evidence |
|---|---|
| #386 — emulator startup / pnpm safety | [PR #388](https://github.com/dopaminedungeon/dopamine-dungeon/pull/388) |
| #381 — campaign self-removal | [PR #383](https://github.com/dopaminedungeon/dopamine-dungeon/pull/383) |
| #265 — refresh and new-tab restoration | [PR #382](https://github.com/dopaminedungeon/dopamine-dungeon/pull/382) |
| #376 — expired Neon limiter housekeeping | [PR #394](https://github.com/dopaminedungeon/dopamine-dungeon/pull/394), CLI follow-up [PR #397](https://github.com/dopaminedungeon/dopamine-dungeon/pull/397) |
| #267 — NPC modal stacking | [PR #393](https://github.com/dopaminedungeon/dopamine-dungeon/pull/393) |
| #264 — Campaign Settings persistence | [PR #387](https://github.com/dopaminedungeon/dopamine-dungeon/pull/387) |
| #266 — Markdown rendering | [PR #390](https://github.com/dopaminedungeon/dopamine-dungeon/pull/390) |
| #342 — Profile Settings responsive width | [PR #400](https://github.com/dopaminedungeon/dopamine-dungeon/pull/400) |
| #268 — measured loading/performance audit | [PR #399](https://github.com/dopaminedungeon/dopamine-dungeon/pull/399) |
| #340 — canonical NPC–Location relationship | [PR #398](https://github.com/dopaminedungeon/dopamine-dungeon/pull/398) |
| #389 — application responsive-width audit | [PR #401](https://github.com/dopaminedungeon/dopamine-dungeon/pull/401) |
| #378 — browser Firestore test discovery | [PR #406](https://github.com/dopaminedungeon/dopamine-dungeon/pull/406) |
| #377 — reconciliation coverage validation | [PR #405](https://github.com/dopaminedungeon/dopamine-dungeon/pull/405) |
| #375 — Iteration 3 Production evidence handoff | [PR #404](https://github.com/dopaminedungeon/dopamine-dungeon/pull/404) |
| #374 — retired Production audit removal | [PR #403](https://github.com/dopaminedungeon/dopamine-dungeon/pull/403) |
| #360 — filter preference persistence | [PR #402](https://github.com/dopaminedungeon/dopamine-dungeon/pull/402) |

## Actionable retrospective

| Topic | Evidence-backed learning | Action or disposition |
|---|---|---|
| What worked | Small issue-scoped PRs kept relationship persistence, UI width, filter state, and test discovery as separate reviewable changes. API/boundary tests and synthetic browser fixtures protect specific contracts without claiming a production database round trip. | Continue to measure/reproduce first, keep API and boundary tests beside the affected authorization predicate, and describe mock/intercepted versus real-data evidence separately. |
| What worked | Existing transaction, idempotency, and Firebase UID identity patterns gave creation, refresh, and invitation work a clear source of truth. | Preserve Firebase UID as the identity key and Neon/API as application-state authority; do not add a parallel browser persistence path. |
| Friction and rework | Several planned claims were broader than the evidence: the docs described uniform Player-mode blocking and complete workspace/campaign scoping, while handler predicates vary. | Describe verified route-level checks and known gaps; keep [#284](https://github.com/dopaminedungeon/dopamine-dungeon/issues/284) and the role-management issues as follow-up instead of presenting an idealized matrix as shipped. |
| Friction and rework | `test:unit` named the browser Firestore-retirement regression but Vitest did not discover it. The targeted command proved a coverage gap, not a restored Firestore runtime. | Keep the exact-file include and regression in the unit quality gate ([#378](https://github.com/dopaminedungeon/dopamine-dungeon/pull/406)); verify test discovery, not just a script name. |
| Friction and rework | The documentation reconciler ran only its configured passes, although the manifest declared a wider closeout inventory. | Keep the five explicit passes, manifest coverage validation, and precise scoped summary from [#377](https://github.com/dopaminedungeon/dopamine-dungeon/pull/405). A clean result is not a whole-repository audit. |
| Wrong assumption | An open issue does not prove implementation is still pending when its PR is merged; conversely, a merged PR does not prove that external Production operations happened. | Check both PR and issue/Project state. The dependency table records merge evidence; #375 separately keeps Production work unverified without operator records. |
| Wrong assumption | Project planning dates and status can diverge from a static sprint file. The prior `current.md` said Sep 06–Sep 19 and Backlog, while the live Project view on Oct 12 showed Iteration 4 current Oct 03–Oct 23 and all 17 matching items in Ready for merge. | Use the Project as assignment/status authority and put dated snapshots in docs. Do not silently change Project fields or invent next-iteration dates. |
| Wrong assumption | “GM role” and “GM mode” are not interchangeable, and a role field typed as text does not enforce its documented value set. | The updated role guide records `owner`/`gm`/`player` and `gm`/`player` as schema-declared roles while explicitly documenting that current workspace writers can persist `admin`/`member`, and that some GM writes do not inspect mode. Track role refinement in #284/#362/#363. |
| Temporary decision removed | Browser Firestore repositories and initialization, direct application mail queue usage, and the temporary read-only Production audit route are absent from the active integration source. | Keep them retired. PR #373 reports the one-time audit and claim removal; PR #403 verifies its source removal from `dev`. Do not restore or call the route. |
| Temporary decision retained | Historical Firestore data, configuration, migration inputs, and source archives remain necessary until parity, rollback, and retention gates are evidenced. | Preserve them. The private #373 report could not be located. The #375 ledger leaves Production migrations `0014`–`0022`, Google-only verification, limiter import, effective rules/indexes/TTL/Trigger Email archive, rollback/retention, deny-all canary, and physical retirement **unverified**. Missing records prove neither execution nor non-execution. |
| Temporary decision deferred | The sole prospective Production operator supplied a planning target around 2027-01-12. The exact date/time and rollback-retention period remain undecided; the target is not approval or a scheduled window. | Keep the #375 sequence behind separate approvals and windows. This closeout does not perform, schedule, or authorize those operations. |

## Final repository and Project state

- `dev` contains the Iteration 4 implementation dependencies and the
  implementation-grounded role/mode guide. The #407 changes are documentation
  only. The production release is not part of this closeout.
- The organization Project 1 view observed on 2026-10-12 showed Iteration 4 as
  current for Oct 03–Oct 23, with 17 filtered issues (the 16 dependencies plus
  #407) under **Ready for merge**. In that view #407 was assigned to Magda,
  Priority Low, Effort Low, Application version `n/a`, Iteration 4. This is a
  UI snapshot; no Project field or status was changed by this closeout.
- The next iteration has no confirmed name, dates, owner assignment, or
  committed scope in the observed Project state. The open issues below are
  candidates for owner triage, not commitments.
- The current authorization reference is path-specific; it does not claim a
  global GM-mode write guard. Current state and roadmap now point to this
  limitation and the focused existing follow-ups.
- No production database ledger, private report, provider settings, or live
  Firestore configuration was inspected or altered. The evidence boundary is
  the [#375 gate ledger](../architecture/FIRESTORE_TO_NEON_MIGRATION.md#375-production-evidence-ledger-reviewed-2026-10-12).

## Deferred inputs already tracked

These issues were found open during closeout; no new issue was needed:

- [#271](https://github.com/dopaminedungeon/dopamine-dungeon/issues/271) — broader mobile/tablet usability beyond width patterns.
- [#270](https://github.com/dopaminedungeon/dopamine-dungeon/issues/270) — broader contextual loading inventory.
- [#348](https://github.com/dopaminedungeon/dopamine-dungeon/issues/348) — relationship type and wording expansion; #340 remains the bounded fix.
- [#284](https://github.com/dopaminedungeon/dopamine-dungeon/issues/284), [#362](https://github.com/dopaminedungeon/dopamine-dungeon/issues/362), [#363](https://github.com/dopaminedungeon/dopamine-dungeon/issues/363), [#364](https://github.com/dopaminedungeon/dopamine-dungeon/issues/364) — authorization refinement, role management, and safe campaign deletion.
- [#396](https://github.com/dopaminedungeon/dopamine-dungeon/issues/396) — synchronization among already-open tabs.
- [#322](https://github.com/dopaminedungeon/dopamine-dungeon/issues/322) — broader go-live security/domain readiness, separate from #375.
- [#375](https://github.com/dopaminedungeon/dopamine-dungeon/issues/375) — unverified Production cutover and Firestore retirement gates.

These are existing focused scopes, not a new iteration plan. The Project owner
must prioritize and assign any accepted work.

## Canonical documentation map

- [Current State](../product/CURRENT_STATE.md) and [Roadmap](../product/ROADMAP.md): delivered state, deferred work, and unverified Production boundary.
- [System Overview](../architecture/SYSTEM_OVERVIEW.md), [role guide](../multitenant-multirole-management.md), [permission table](../permissions-table.md), and [permission graph](../permissions-graph.md): persistence ownership and implementation-grounded role/mode checks.
- [ADR 0003](../architecture/adr/0003-transitional-firestore-postgres-persistence.md), [ADR 0004](../architecture/adr/0004-firebase-identity-and-email-verification.md), and [ADR 0006](../architecture/adr/0006-canonical-workspace-and-campaign-creation.md): current persistence/identity decisions with the #375 evidence caveat.
- [Testing](../operations/TESTING.md), [Repository Policy](../operations/REPOSITORY_POLICY.md), [Deployment](../operations/DEPLOYMENT.md), and [Environment](../operations/ENVIRONMENT.md): test layers, historical live-protection snapshot, and provider/release gates.
- [Iteration Closeout procedure](../operations/ITERATION_CLOSEOUT.md) and [#375 gate ledger](../architecture/FIRESTORE_TO_NEON_MIGRATION.md): reusable closeout process and operator-only Production evidence.

## Validation and change boundary

This was a documentation-only reconciliation. Local checks validated changed
Markdown links/anchors, the declared documentation-manifest inventory and its
files without invoking the live model, and `git diff --check`. Pull request CI
is responsible for the required repository quality gate. No application tests
were run locally because application code did not change. No dependency,
schema, migration, API, Production data/configuration, branch protection, or
Project field was changed. Rollback is limited to reverting these documentation
edits; reverting documentation cannot reverse any external operation.
