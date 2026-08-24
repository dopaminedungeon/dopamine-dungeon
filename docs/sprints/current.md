# Iteration 2 - Code Quality, Testing, and Repository Hygiene

Status: Completed
Owner: Magda
Period: 2026-07-24 to 2026-08-24

This is the final Iteration 2 record. The earlier agent-workflow pilot record
is superseded by this document; its implementation history remains in Git.

## Intended outcome

Close the iteration by reducing repository noise, establishing a trustworthy
automated testing and CI baseline, completing necessary administration and
backlog hygiene, and reconciling documentation with the final repository.

## Delivered outcome

- Authentication work was included in the repository work reviewed during
  Iteration 2, including verification and race-safe Firebase-UID-based profile
  provisioning. Its
  feature ownership and remaining work remain assigned to Iteration 3; this
  retrospective does not move those backlog items into Iteration 2.
- Neon is the primary store for core campaign entities. Transitional
  Firestore paths are documented rather than treated as invisible exceptions.
- Workspace and campaign boundaries, GM/player visibility, selected mode, and
  hidden-link non-disclosure have explicit server-side and regression-test
  coverage as inputs to the quality gate.
- #315 established Vitest unit/API/boundary layers, Playwright PR smoke
  coverage, the `pnpm quality` command, and the DD Quality Gate.
- #316 made lint blocking and clean, investigated the Vite bundle signal,
  removed obsolete workflows and dead feature surfaces, and documented branch,
  release, hotfix, and runner policy.

## Significant decisions

- Firebase Authentication remains the identity provider. The Firebase UID is
  the identity boundary; email is not an identity merge key.
- Neon owns core relational campaign data. Firebase/Firestore remains only on
  documented transitional paths such as bootstrap, membership, invitations,
  settings, mail, and legacy assignments. See ADR 0001 and ADR 0003.
- A dual-role account's selected mode is part of the server request contract;
  GM visibility is fail-closed and cannot be inferred from capability alone.
- The standalone Relationships module and DebugPanel wiring were retired.
  Typed entity links remain, with future relationship behavior belonging to
  cross-linking and Friendship Index work.
- `dev` is the integration/preview branch and `main` remains the production
  deployment source. Optional release branches are short-lived stabilization
  branches, not a full GitFlow process.

## Retrospective

### What went well

- Deterministic emulator-backed browser tests and isolated Vitest suites made
  authorization failures inspectable without production services or data.
- A focused audit exposed dead workflows, stale mocks, the obsolete
  Relationships surface, and the oversized PDF import path before they became
  ongoing CI or bundle noise.
- The final local commands and branch policy are now documented in one place
  and referenced by the testing and deployment documentation.

### Friction and rework

- The historical Node test runner could not provide useful coverage for the
  current TypeScript API boundaries, so the focused suites moved to Vitest.
- The lint baseline, self-hosted emulator environment, Java/port prerequisites,
  and initial Vite chunk warning required repository-level cleanup before the
  quality signal could be trusted.
- The persistence migration and dual-role mode contract were easy to describe
  too broadly. Source and handler audits were needed to distinguish capability
  from selected visibility mode and Neon ownership from transitional Firestore.

### Assumptions corrected

- "Neon stores all application data" was too broad while legacy Firestore paths
  remain active.
- UI mode selection alone is not an authorization boundary; the server must
  receive and validate the selected mode.
- Full Playwright E2E is valuable regression evidence but is not a stable PR
  blocking signal for this solo-developed repository.
- Unused mocks and disabled feature surfaces still have maintenance cost and
  should not be preserved without an active owner.

## Removed, retained, and deferred decisions

Removed: the standalone Relationships page/profile, DebugPanel wiring, dead
workflows, obsolete mocks, and the static PDF import that caused avoidable
initial-load pressure.

Retained: Firebase's transitional persistence paths until their replacements
are verified; the Arcs, Conditions, and Quests dev/demo seeds; advisory PR
smoke tests; full E2E as release/manual evidence; and manual branch-ruleset
configuration documented in `docs/operations/REPOSITORY_POLICY.md`.

Deferred: React Testing Library until a useful component/provider behavior
exists; full E2E as a required PR check; completion of the Firestore-to-Neon
retirement tracked by #298; and Friendship Index behavior built on stable
typed cross-links and entity persistence.

## Outcome and next-iteration inputs

Iteration 2 met its intended outcome: repository cleanup, automated testing,
CI administration, and backlog/documentation hygiene are materially more
reviewable. Authentication remains a documented repository dependency, but
authentication feature work remains assigned to Iteration 3. The persistence
migration and product relationship model are also explicit follow-up work
rather than hidden assumptions.

Iteration 3 should retain ownership of the authentication feature backlog,
prioritize the #298 persistence retirement with a module-by-module cutover and
rollback plan, and complete the active feature-surface and narrative-value
audit in [#319](https://github.com/dopaminedungeon/dopamine-dungeon/issues/319).
It should also verify the documented GitHub branch rules in repository settings
and continue core entity reliability before starting Friendship Index work.
Keep the quality gate small and add component tests only when they cover real
provider or UI behavior.
