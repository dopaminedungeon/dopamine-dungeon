# Iteration 3 — Authentication, Onboarding, and Persistence

Owner: Magda (`magdysia`)
Evidence reviewed: 2026-09-05
Issue: [#328](https://github.com/dopaminedungeon/dopamine-dungeon/issues/328)
Status: Documentation audit complete; human closeout and operational follow-ups remain

This replaces the preparation notes in this existing file. Repository evidence is anchored to `fbb61c1b33d548e5de747f1ba388f45f4701f566`, the audited branch base and live `dev` tip. GitHub Project 1 lists Iteration 3 from 2026-08-23 for 14 days, with #328 assigned to Magda and In progress. All 14 dependencies listed in #328 are closed and their Project items are Done. No issue status or Project field was changed by this audit.

## Intended and delivered outcome

The intended outcome was the authentication/onboarding refactor and Firestore
retirement. Application implementation is delivered: Firebase owns credentials
and verified identity; authenticated APIs own Neon application state; direct
Brevo replaces the Firestore mail queue; Neon owns authentication-email limits.
The public shell is separate from application bootstrap. Invitation resolution
precedes independent-user onboarding, and credential setup remains optional.

The wider Firestore retirement programme is **requiring follow-up**, not fully
certified. [PR #365](https://github.com/dopaminedungeon/dopamine-dungeon/pull/365)
explicitly closes Development implementation and defers Production operations.
[PR #372](https://github.com/dopaminedungeon/dopamine-dungeon/pull/372) merged to
`main` on 2026-09-04. [PR #373](https://github.com/dopaminedungeon/dopamine-dungeon/pull/373)
reports sanitized Production audit capture and claim revocation, and removes
the temporary reader from `main`. Its private operator reports were unavailable
to this audit. The reader remains on `dev`; [#374](https://github.com/dopaminedungeon/dopamine-dungeon/issues/374)
tracks that return-to-integration fix. Merging the release does not prove
schema, limiter import, provider readiness, deny-all canary, or physical retirement.

### Dependency evidence

Closed/Done below means delivered repository work and GitHub disposition, not
independent repetition of every historical manual acceptance test.

| Dependencies | Status | Delivery evidence and implementation checked |
| --- | --- | --- |
| #325 | Completed | [PR #326](https://github.com/dopaminedungeon/dopamine-dungeon/pull/326); `.github/ISSUE_TEMPLATE/iteration-closeout.yml`, `create-iteration-closeout.yml`, and the actual #328 marker/checklist |
| #319 | Completed | [PR #324](https://github.com/dopaminedungeon/dopamine-dungeon/pull/324); `FEATURE_SURFACE_AUDIT.md`, feature flags/routes, and the updating quality-gate comment in `pr-checks.yml` |
| #255 | Completed | [PR #297](https://github.com/dopaminedungeon/dopamine-dungeon/pull/297); `AuthContext.jsx`, `userIdentity.test.js`, UID-keyed provisioning |
| #256 | Completed | [PR #323](https://github.com/dopaminedungeon/dopamine-dungeon/pull/323), [PR #371](https://github.com/dopaminedungeon/dopamine-dungeon/pull/371); `auth.ts`, verification screens, ADR 0004 and guarded Google-only migration runbook |
| #257 | Completed | [PR #333](https://github.com/dopaminedungeon/dopamine-dungeon/pull/333); `passwordRecoveryEmail.ts`, recovery/reset screens and tests |
| #259, #258 | Completed | [PR #341](https://github.com/dopaminedungeon/dopamine-dungeon/pull/341), [PR #370](https://github.com/dopaminedungeon/dopamine-dungeon/pull/370); `PasswordManagement.jsx`, `api/auth/identity-continuity.ts`, UID-only continuity and historical verification proof |
| #298, #296 | Completed implementation; operations require follow-up | [PR #365](https://github.com/dopaminedungeon/dopamine-dungeon/pull/365); workspace/campaign creation handlers and tests, Campaign Settings handler, retired Firestore repositories, `transactionalMail.ts`, Neon limiter; [#375](https://github.com/dopaminedungeon/dopamine-dungeon/issues/375) carries release gates |
| #260 | Completed | #372 explicitly records delivery through the Iteration 3 state-based auth/onboarding work; `AppGate` and `AppProviders` resolve auth, invitation acceptance, and memberships before bootstrap |
| #261 | Completed | [PR #366](https://github.com/dopaminedungeon/dopamine-dungeon/pull/366); `App.jsx`, `PublicSiteShell.jsx`, public navigation and smoke scenarios in `e2e/auth.spec.ts` |
| #262, #263 | Completed | [PR #367](https://github.com/dopaminedungeon/dopamine-dungeon/pull/367), [PR #368](https://github.com/dopaminedungeon/dopamine-dungeon/pull/368); bootstrap pages and atomic, idempotent API creation; owner-only campaign creation |
| #295 | Completed | [PR #369](https://github.com/dopaminedungeon/dopamine-dungeon/pull/369); invitation handlers/tests, Campaign Settings people view, relational assignments and migration `0022` |

Supporting Project items #331, #332, #336, #337, and #352 are also Done: bootstrap
sign-out/workspace switching, auth-email abuse controls, Google linking, and
approved creation design. Release PR #372 is Done. These support the outcome
without redefining #328's original dependency list.

## Actionable retrospective

| Topic | Evidence-backed lesson | Action / disposition |
| --- | --- | --- |
| What went well | Explicit UID ownership and scoped handler tests made authentication, identity provisioning, and campaign permission boundaries independently reviewable. Creation tests cover retries, concurrent-key conflict and membership failure. | Retain the API boundary, transactional creation and caller-scoped idempotency; add cases when those predicates change. |
| What went well | #319 retired low-value mock surfaces while preserving typed links and narrative entities; #261 separates public entry without requiring campaign bootstrap. | Preserve meaningful relationships and low cognitive load; future Arcs/Quests/Friendship Index stay focused backlog work, not placeholder product claims. |
| Friction / rework | #296 exposed a successful Firestore write followed by a Neon read with no workspace. #365 eliminated that split path. | Name the write store, read store, and refresh behavior in each persistence QA record; canonical APIs are now settled by ADR 0006. |
| Friction / rework | #370 records Firebase verification dropping after Google-first password linking. Emulator compatibility could not prove that real-provider transition. | Pair deterministic identity/negative tests with real Preview provider QA; never weaken verification or infer identity from email. |
| Wrong assumption | An authenticated session is not necessarily provisioned, verified, or finished accepting an invitation. `AppProviders` blocks while acceptance and membership refresh are pending. | Keep delayed/error/retry invited-user scenarios; never show independent bootstrap while invite resolution is unresolved. |
| Wrong assumption | Green smoke/build results do not prove all release UI behavior: #372 recorded 70 passed/3 failed full E2E, while smoke passed. `fbb61c1` subsequently changes accessibility/credential-error regressions. | Keep full release results distinct from advisory smoke. Historical counts are not current validation; this audit records its own checks below. |
| Wrong assumption | A successful documentation workflow is not a complete canonical audit. Run 33967972810 inspected only the two configured security passes; operations and persistence documents remained stale. | [#377](https://github.com/dopaminedungeon/dopamine-dungeon/issues/377) tracks explicit audit coverage. Manual closeout still reads the complete issue checklist. |
| Wrong assumption | Naming a test in a package command does not guarantee discovery. Vitest excludes the browser Firestore-retirement TypeScript test and targeted execution reports no tests. | [#378](https://github.com/dopaminedungeon/dopamine-dungeon/issues/378) tracks the confirmed coverage gap; no assertions or configuration were changed here. |
| Removed temporary decisions | Browser Firestore state, Trigger Email application writes, Firestore limiters, and fake/retired feature surfaces are gone from normal application paths. | Update ownership docs; do not copy legacy adapters or restore placeholder functionality. |
| Retained temporary decisions | Firestore historical data/configuration, invitation CSV read compatibility, advisory smoke, and private operator evidence remain operational constraints. #373's reader removal has not returned to dev. | Keep rollback/parity gates and track #374/#375. Never restore the retired audit casually. |
| Deferred decisions | Physical limiter housekeeping is explicitly absent; richer roles, safe deletion and account consolidation/unlinking remain separate work. | Track [#376](https://github.com/dopaminedungeon/dopamine-dungeon/issues/376); reuse existing focused issues below. |

## Full #328 checklist disposition

Statuses describe this documentation audit. Completed does not change GitHub
checkboxes, certify Production, or approve a future implementation.

| #328 item | Status | Evidence | Action taken |
| --- | --- | --- | --- |
| Major dependencies complete before closeout | Completed for implementation; wider #298 operations require follow-up | All 14 closed/Done; #365 explicitly scopes Development completion | Preserve the operational caveat and link #375 |
| Retrospective: delivery and intended outcome | Completed | Dependency table and release records above | Distinguish application migration from full decommission |
| Retrospective: what went well | Completed | Creation/identity tests, #319/#261 | Record practices worth retaining |
| Retrospective: friction/rework | Completed | #296, #370, #372 | Record persistence, provider and release-test lessons |
| Retrospective: wrong assumptions | Completed | Invite loading gate and two-pass reconciliation | Convert lessons into validation expectations and #377 |
| Retrospective: temporary decisions removed/retained/deferred | Completed | #365/#373 and current source | Explicit disposition table above |
| Reconcile Current State and Roadmap | Completed | `App.jsx`, APIs, merged dependencies | Update delivered state, public placeholders and handoff |
| Reconcile architecture/persistence/identity/authorization/ADRs | Completed | Creation/settings handlers, UID continuity, visibility tests | Correct ADR classifications and stale Firestore ownership; retain secrecy invariants |
| Reconcile testing/CI/branch/release/deployment/environment guidance | Completed repository audit; live settings require follow-up | Workflow YAML, package scripts, mail/limiter code, #372/#373 | Correct hosted runner/Mistral, four smoke journeys, direct Brevo/Neon and retired audit guidance |
| Reconcile iteration ownership and Project handoff | Completed snapshot | Project 1 read on 2026-09-05; #328 assigned to Magda/In progress | Record handoff without changing assignments, status or schedule |
| Link existing focused deferred issues | Completed | Existing issue search and scope checks | Reuse #264, #284, #290/#291, #322, #356/#357, #362–#364 |
| Create focused issues only when no suitable issue exists | Completed | Open/recently closed issue and PR searches | Create #374–#378; keep independent scopes |
| Do not implement discovered product work | Completed | Documentation-only diff | Track changes externally; no runtime/configuration changes |
| Final delivered/architectural state | Completed | Current State, System Overview, this record | Record API/Neon, Firebase identity, Brevo and visibility boundaries |
| Remaining risks and deferred work | Completed record; follow-up required | #374–#378 and existing focused work | Name verification/retirement and test-discovery limits |
| Next-iteration inputs and ownership | Completed handoff; scheduling requires human decision | Magda is #328/Iteration 3 owner; Project remains authoritative | Proposed inputs below; no invented next-iteration commitments |
| AC: actionable lessons rather than PR diary | Completed | Lesson/action table | PR table is evidence, not the retrospective narrative |
| AC: canonical docs reconciled / obsolete contradictions resolved explicitly | Completed for audited scope | Updated canonical and intended-state boundaries | Preserve historical Iteration 2; correct current operational claims |
| AC: deferred work linked or explicitly declined | Completed | Handoff register | No duplicate bug for already-tracked Campaign Settings or public-copy work |
| AC: final state and next-iteration handoff recorded | Completed | This file and index links | Reuse existing retrospective location |
| AC: future behavior not presented as current | Completed | Coming-soon/retired labels and operational caveats | Keep roadmap and intended diagrams distinct from implementation |
| AC: no product behavior changed | Completed | Only documentation changes | No product code, migrations, CI, dependencies or configuration edited |

No checklist item is wholly not applicable. Production/provider verification
is outside this documentation task and remains explicitly unverified; it is
not silently counted as a passed check.

## Handoff and ownership

Magda owns triage and the final iteration decision. New issues were not assigned
to an iteration or given Project fields; implementation/operator ownership and
scheduling are human planning decisions.

| Input | Disposition / owner decision needed |
| --- | --- |
| [#374 — return audit removal to dev](https://github.com/dopaminedungeon/dopamine-dungeon/issues/374) | Integrate #373 before another release can restore its retired reader |
| [#375 — Production cutover and Firestore retirement evidence](https://github.com/dopaminedungeon/dopamine-dungeon/issues/375) | Release operator reconciles private evidence first; separately approve remaining windows |
| [#376 — expired limiter housekeeping](https://github.com/dopaminedungeon/dopamine-dungeon/issues/376) | Agree retention/maintenance owner; protect the active rolling horizon |
| [#377 — documentation audit coverage](https://github.com/dopaminedungeon/dopamine-dungeon/issues/377) | Align supplied pass inputs and advertised coverage; no automation changes in #328 |
| [#378 — browser retirement test discovery](https://github.com/dopaminedungeon/dopamine-dungeon/issues/378) | Make the existing regression run in its intended unit layer; current include patterns exclude it |
| [#322 — go-live security/domain audit](https://github.com/dopaminedungeon/dopamine-dungeon/issues/322) | Live rulesets, domains, sender alignment, cross-scope QA and monitoring; does not replace #375's retirement programme |
| [#264 — Campaign Settings persistence](https://github.com/dopaminedungeon/dopamine-dungeon/issues/264) | API persistence is now implemented by #365; owner should validate original refresh/isolation/failure criteria before changing issue status |
| [#284](https://github.com/dopaminedungeon/dopamine-dungeon/issues/284), [#362](https://github.com/dopaminedungeon/dopamine-dungeon/issues/362), [#363](https://github.com/dopaminedungeon/dopamine-dungeon/issues/363), [#364](https://github.com/dopaminedungeon/dopamine-dungeon/issues/364) | Authorization refinement, workspace/campaign role management, and safe campaign deletion remain separate accepted scopes |
| [#290](https://github.com/dopaminedungeon/dopamine-dungeon/issues/290), [#291](https://github.com/dopaminedungeon/dopamine-dungeon/issues/291) | Public shell delivery does not close public design/copy acceptance; retain Magda's item-level decisions |
| [#356](https://github.com/dopaminedungeon/dopamine-dungeon/issues/356), [#357](https://github.com/dopaminedungeon/dopamine-dungeon/issues/357) | Account consolidation and provider unlinking are not delivered by same-identity linking |

The preparation question about canonical creation is resolved by ADR 0006 and #365; the mail transport question is resolved by direct Brevo. A real hosted database test service is not introduced here: retain manual release QA and the isolated emulator/API layers until a separately justified test requirement exists. No speculative testing-platform issue is created.

## Reconciliation process and validation

The existing rubric's source precedence and documentation-drift versus
implementation-risk distinction guided this audit. The manifest is unchanged:
no files were moved/added to the canonical inventory, and closeout policy does
not require changing automation configuration for a manual audit. Its coverage
limitation is tracked by #377. The [existing workflow run](https://github.com/dopaminedungeon/dopamine-dungeon/actions/runs/33967972810)
succeeded with no findings in its two security passes at main `c387e6e7`;
it is not validation of this uncommitted documentation diff.

Validation performed on this working tree:

| Check | Result |
| --- | --- |
| `node --test scripts/dd-doc-reconcile.test.mjs` | 6 passed; structured findings/filtering/rendering contract, no model request |
| Targeted Vitest, thread pool (commands below) | 62 passed across 9 files: invitation context, creation/settings, mode, legacy retirement, mail, reconciliation and handler/identity continuity |
| Browser retirement discovery command below | Exit 1: no test files found; confirmed config gap tracked as #378 |
| `node /private/tmp/dd328-check-docs.mjs` (temporary read-only checker) | 25 existing documentation files, 68 local Markdown destinations, balanced fences and 72 manifest paths checked; zero failures |
| `git diff --check` and final diff review | Passed; only existing documentation files changed; no unsupported live-validation claims added |
| Authenticated GitHub issue/PR/Project reads and issue read-back | Dependency dispositions, #372/#373 branch evidence and #374–#378 issue bodies/labels verified |

Successful targeted commands:

```sh
pnpm test src/auth/invitationContext.test.js src/server/api-handlers/workspace-create.test.ts src/server/api-handlers/campaign-create.test.ts src/server/api-handlers/campaign-settings.test.ts src/server/viewer-mode.test.ts --pool=threads
pnpm test src/server/legacy-firestore-retirement.test.ts src/server/transactionalMail.test.ts scripts/firestore-reconciliation.test.ts api/auth/identity-continuity.test.ts --pool=threads
pnpm test src/server/api-handlers.integration.test.ts --pool=threads
```

The middle command passed 17 tests in three existing files. Its additional
`api/auth/identity-continuity.test.ts` filter was a mistaken path, not executed
coverage; the corrected final command ran the actual handler/continuity suite
(18 tests). The first command passed 27 tests.

```sh
pnpm test src/firebase/browserFirestoreRetirement.test.ts --pool=threads
```

This last command deliberately confirmed #378, not a product failure.
Two earlier broader `pnpm test` attempts with the default worker pool stalled
without test results and were interrupted (one inside the sandbox and one
outside). The outside retry reached the Vitest banner but did not complete.
The thread-pool fallback passed without a repository configuration change;
the default-worker stall's cause remains undiagnosed, so it is not asserted
as a product defect.

No dependencies were installed. Per `ITERATION_CLOSEOUT.md`, `pnpm quality`
(lint, typechecks, build and aggregate suites) is reserved for executable
workflow/script/configuration closeout changes; none occurred here. No dedicated
Markdown formatter/link-check script is configured, so the temporary checker
validated local targets/fences without adding a dependency. External links were
checked through the relevant authenticated GitHub records, not a generic web
crawler. Mermaid visual rendering was not performed.

No full-stack manual, real inbox, Production, or browser E2E run was performed.
The original full release E2E failures in #372 are historical evidence, not a
current failure assertion; the later fix was inspected but full E2E was not
rerun here. The architecture-guardian review preserved UID identity and
server-side secrecy invariants while correcting descriptive ownership claims.

## Manual verification and rollback

For human acceptance, review all #328 dispositions, resolve #264 against its
original scenarios, and reconcile operator evidence through #375/#322. Relevant
future QA uses the canonical `pnpm vercel dev` full-stack URL or approved
Preview, synthetic GM/Player fixtures, refresh/sign-in persistence, denied
cross-scope access and real inbox/provider checks. Never put campaign secrets
or credential material into audit artifacts.

Architectural impact: documentation corrections only; no schema/API/permission
change, and no migration is required. Rollback is to reverse only this task's
documentation hunks. The focused GitHub issues remain normal tracked work;
editing/closing them is a deliberate owner action. No commit, push, PR, merge,
deployment, production operation, or issue-status change was performed here.
