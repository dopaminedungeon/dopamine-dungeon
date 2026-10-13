# Iteration 4 — Bugfixing (v0.6.1)

Status: Implementation dependencies merged to `dev`; documentation closeout in progress
Owner: Magda (observed Project assignment)
Period: 2026-10-03 to 2026-10-23 (Project view observed 2026-10-12)
Planning snapshot: 2026-10-12

## Focus and intended outcome

Stabilize existing campaign workflows after Iteration 3: reliable persistence,
meaningful entity relationships, predictable navigation, and usable interfaces.
Resolve the release and validation follow-ups without expanding product scope.

Scope and status come from [GitHub Project 1](https://github.com/orgs/dopaminedungeon/projects/1),
iteration “Iteration 4 - bugfixing (v0.6.1)”. On 2026-10-12, the visible
iteration view showed 17 matching items (the 16 #407 dependencies plus #407)
under “Ready for merge.” The 16 dependency implementation PRs are merged to
`dev`; #407 is the documentation closeout. Neither board grouping nor merged
implementation means the release is merged to `main` or deployed. The Project
owns assignment/status; each issue owns acceptance criteria. The Project view
did not establish a next iteration name, dates, owner, or committed scope.

## Goals and scoped work

| Goal | Assigned issues |
|---|---|
| Restore trustworthy persistence and navigation | [#264](https://github.com/dopaminedungeon/dopamine-dungeon/issues/264) Campaign Settings save/reload; [#265](https://github.com/dopaminedungeon/dopamine-dungeon/issues/265) refresh/direct-route restoration; [#360](https://github.com/dopaminedungeon/dopamine-dungeon/issues/360) user-specific filter persistence |
| Make existing content and relationships consistent | [#340](https://github.com/dopaminedungeon/dopamine-dungeon/issues/340) NPC–Location relationship lookup/search; [#266](https://github.com/dopaminedungeon/dopamine-dungeon/issues/266) Markdown rendering and saved-content preservation |
| Improve usability from measured evidence | [#268](https://github.com/dopaminedungeon/dopamine-dungeon/issues/268) performance/loading baseline; [#267](https://github.com/dopaminedungeon/dopamine-dungeon/issues/267) NPC modal stacking; [#342](https://github.com/dopaminedungeon/dopamine-dungeon/issues/342) Profile Settings width; [#389](https://github.com/dopaminedungeon/dopamine-dungeon/issues/389) application responsive-width audit |
| Close release and maintenance gaps | [#374](https://github.com/dopaminedungeon/dopamine-dungeon/issues/374) return retired audit removal to dev; [#375](https://github.com/dopaminedungeon/dopamine-dungeon/issues/375) reconcile cutover/Firestore retirement evidence; [#376](https://github.com/dopaminedungeon/dopamine-dungeon/issues/376) expired limiter housekeeping |
| Make validation coverage explicit | [#378](https://github.com/dopaminedungeon/dopamine-dungeon/issues/378) discover the existing browser retirement regression; [#377](https://github.com/dopaminedungeon/dopamine-dungeon/issues/377) documentation audit coverage; [#407](https://github.com/dopaminedungeon/dopamine-dungeon/issues/407) Iteration 4 closeout |

## Original sequencing and current handoff

The following was the suggested execution sequence, not a Project priority
order or a claim that every item blocked the next. The listed #407
implementation dependencies have since merged to `dev`; the closeout status
and evidence are in [the retrospective](iteration-4-retrospective-notes.md).

1. Establish release and test safety: address #374 before another release can
   restore the retired reader, and #378 so the intended regression is executed.
   Start #375 by locating existing operator evidence rather than repeating
   completed operations.
2. Reproduce and measure before implementation: use #268's baseline to guide
   loading work in #265. Revalidate #264 against the Campaign Settings API
   already delivered in Iteration 3 before deciding what remains to fix.
   Diagnose #340's canonical relationship lookup before changing stored links.
3. Make focused fixes to persistence, route/filter restoration, Markdown, and
   layout. Coordinate #267/#342 with #271's broader viewport checks; preserve
   saved content and test GM/Player and cross-scope behavior where affected.
4. Complete maintenance and documentation handoff: #376's application
   housekeeping work is delivered by PRs #394 and #397. #375's Production
   operations remain behind environment-specific evidence and approval. #377
   improves scoped documentation reconciliation; #407 records this closeout.

The [Iteration 3 retrospective](iteration-3-retrospective-notes.md) supplies
historical handoff context. The [Iteration 4 retrospective](iteration-4-retrospective-notes.md)
records delivered PRs and current limitations. Neither authorizes Production
changes.
Use [Testing](../operations/TESTING.md) and the
[migration inventory](../architecture/FIRESTORE_TO_NEON_MIGRATION.md) for
validation and operational gates. Merged implementation evidence does not
certify release promotion or Production operations.

## Explicit non-goals

- New Arcs, Quests, Friendship Index, AI, payment, or other product modules.
- A general relationship redesign, duplicate directional relationship records,
  router rewrite, or rich-text editor replacement without issue-specific need.
- Changing Firebase UID identity, tenant/campaign isolation, or GM/player secrecy.
- Treating UI preferences as authorization, or replacing API persistence with
  mock/local-only state.
- Production deployment, destructive retirement, or provider/configuration
  changes without their separate operational authority.
- Pulling unassigned Iteration 3 follow-ups into scope automatically.

## Historical records

- [Iteration 2 retrospective](iteration-2-retrospective-notes.md)
- [Iteration 3 retrospective](iteration-3-retrospective-notes.md)

This file records the last observed current iteration snapshot. Completed
iteration evidence belongs in its dedicated retrospective. A Project view is a
time-bound status snapshot, not release or Production evidence.
