# Iteration 4 — Bugfixing (v0.6.1)

Status: Current iteration; assigned work is Backlog, not delivered
Owner: Magda
Period: 2026-09-06 to 2026-09-19 (14 days)
Planning snapshot: 2026-09-06

## Focus and intended outcome

Stabilize existing campaign workflows after Iteration 3: reliable persistence,
meaningful entity relationships, predictable navigation, and usable interfaces.
Resolve the release and validation follow-ups without expanding product scope.

Scope comes from [GitHub Project 1](https://github.com/orgs/dopaminedungeon/projects/1),
iteration “Iteration 4 - bugfixing (v0.6.1)”. All 14 assigned items were Backlog
at this snapshot. The Project owns assignment/status; each issue owns acceptance
criteria. Some older issue bodies still name v0.7+; the current iteration label
is a planning target, not evidence that those fixes have shipped.

## Goals and scoped work

| Goal | Assigned issues |
|---|---|
| Restore trustworthy persistence and navigation | [#264](https://github.com/dopaminedungeon/dopamine-dungeon/issues/264) Campaign Settings save/reload; [#265](https://github.com/dopaminedungeon/dopamine-dungeon/issues/265) refresh/direct-route restoration; [#360](https://github.com/dopaminedungeon/dopamine-dungeon/issues/360) user-specific filter persistence |
| Make existing content and relationships consistent | [#340](https://github.com/dopaminedungeon/dopamine-dungeon/issues/340) NPC–Location relationship lookup/search; [#266](https://github.com/dopaminedungeon/dopamine-dungeon/issues/266) Markdown rendering and saved-content preservation |
| Improve usability from measured evidence | [#268](https://github.com/dopaminedungeon/dopamine-dungeon/issues/268) performance/loading baseline; [#267](https://github.com/dopaminedungeon/dopamine-dungeon/issues/267) NPC modal stacking; [#342](https://github.com/dopaminedungeon/dopamine-dungeon/issues/342) Profile Settings width; [#271](https://github.com/dopaminedungeon/dopamine-dungeon/issues/271) mobile/tablet pass |
| Close release and maintenance gaps | [#374](https://github.com/dopaminedungeon/dopamine-dungeon/issues/374) return retired audit removal to dev; [#375](https://github.com/dopaminedungeon/dopamine-dungeon/issues/375) reconcile cutover/Firestore retirement evidence; [#376](https://github.com/dopaminedungeon/dopamine-dungeon/issues/376) expired limiter housekeeping |
| Make validation coverage explicit | [#378](https://github.com/dopaminedungeon/dopamine-dungeon/issues/378) discover the existing browser retirement regression; [#377](https://github.com/dopaminedungeon/dopamine-dungeon/issues/377) documentation audit coverage |

## Sequencing and active dependencies

This is a suggested execution sequence based on the issue scopes, not a new
Project priority order or a claim that every item blocks the next.

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
4. Complete the maintenance and documentation handoff: #376 depends on an
   agreed retention policy and maintenance owner; #375's remaining operations
   depend on environment-specific evidence and approval. #377 improves the
   next closeout audit. Record actual results and remaining work at closeout.

The [Iteration 3 retrospective](iteration-3-retrospective-notes.md) supplies the
handoff evidence. Its completion record does not authorize Production changes.
Use [Testing](../operations/TESTING.md) and the
[migration inventory](../architecture/FIRESTORE_TO_NEON_MIGRATION.md) for
validation and operational gates. No implementation success is claimed here.

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

This file always describes current iteration focus. Completed iteration
evidence belongs in its dedicated retrospective.
