# Dopamine Dungeon Roadmap

Last updated: 2026-10-12
Owner: Magda

## Product direction

Dopamine Dungeon is a campaign-management application for game masters and
players. The near-term product focus is reliability of existing workflows,
clear permission boundaries, useful cross-links, and a maintainable release
process. Broader platform, automation, and AI ideas remain directional until
they have a focused issue and are prioritized by the owner.

`CURRENT_STATE.md` is the operational snapshot of what is implemented. This
roadmap describes direction, not a guarantee of delivery or production state.

## Current release and iteration handoff

Iteration 4 — bugfixing (v0.6.1) implementation and closeout documentation
have merged to `dev`. The v0.6.1 candidate awaits its separate release review
and merge to `main`; this documentation does not claim a Production release.
The [Iteration 4 retrospective](../sprints/iteration-4-retrospective-notes.md)
records shipped work, learnings, limits, and the dated Project snapshot.

The Project showed Iteration 4 current through Oct 23, 2026 on 2026-10-12.
No next iteration name, dates, owner assignment, or committed scope was
confirmed at closeout. Candidate work below remains uncommitted until the
Project owner prioritizes it.

## Candidate near-term inputs

Existing focused issues were found; do not create duplicates merely to restate
these themes.

| Theme | Existing issue(s) | Current boundary |
|---|---|---|
| Responsive usability beyond the width audit | [#271](https://github.com/dopaminedungeon/dopamine-dungeon/issues/271) | The #389 width audit is delivered; remaining mobile/tablet behavior remains separately open. |
| Authorization and membership lifecycle | [#284](https://github.com/dopaminedungeon/dopamine-dungeon/issues/284), [#362](https://github.com/dopaminedungeon/dopamine-dungeon/issues/362), [#363](https://github.com/dopaminedungeon/dopamine-dungeon/issues/363), [#364](https://github.com/dopaminedungeon/dopamine-dungeon/issues/364) | Workspace roles, campaign roles, and mode checks are path-specific; safe role management/deletion is not claimed complete. |
| Relationship vocabulary and broader loading inventory | [#348](https://github.com/dopaminedungeon/dopamine-dungeon/issues/348), [#270](https://github.com/dopaminedungeon/dopamine-dungeon/issues/270) | #340 fixes its bounded canonical NPC–Location defect; broader type/wording and loading redesign remain out of scope. |
| Cross-tab data freshness | [#396](https://github.com/dopaminedungeon/dopamine-dungeon/issues/396) | Refresh/navigation restoration does not synchronize already-open views. |
| Release readiness and Production boundaries | [#322](https://github.com/dopaminedungeon/dopamine-dungeon/issues/322), [#375](https://github.com/dopaminedungeon/dopamine-dungeon/issues/375) | The broad security/domain audit and the Iteration 3 Production/Firestore gates are separate; #375 gates remain unverified where evidence is missing. |

These issues are inputs for triage, not next-iteration commitments. In
particular, unresolved Production gates must be handled by the prospective
release operator and must not be described as product implementation.

## Delivered product boundaries

- Core application state is persisted in Neon behind authenticated APIs;
  Firebase Authentication remains the identity authority and Brevo is the
  direct application mail transport.
- Current persisted campaign functionality includes PCs, Bag of Holding,
  Items, Sessions, NPCs, Locations, Lore, Quests, and typed entity links.
- The former standalone Relationships, Arcs, and Conditions screens remain
  retired. Quests now use persisted campaign records and protected APIs.
- Filters are user preferences, never access control. The selected mode and
  current workspace/campaign determine the authorized projection.
- Application-level Firestore runtime removal does not prove Production data
  migration, configuration retirement, rollback readiness, or physical
  decommission. See the [migration ledger](../architecture/FIRESTORE_TO_NEON_MIGRATION.md).

## Longer-term opportunities

These ideas remain exploratory unless tied to an accepted, prioritized issue:

- Friendship Index and relationship visualization built on the existing
  typed-link model;
- campaign timeline, encounter preparation, and session recap tooling;
- improved search and data import/export;
- audit history and player-facing refinements;
- AI-assisted retrieval and campaign consistency tools;
- external tabletop integrations and commercial onboarding.

No existing implementation should be displaced by speculative work without a
clear user need, a focused scope, and authorization/data-boundary review.

## Roadmap governance

- GitHub issues own acceptance criteria for bounded work.
- The organization Project owns iteration assignment and status.
- `CURRENT_STATE.md` records observed implementation state; the roadmap does
  not promote proposed behavior to current behavior.
- ADRs record major technical decisions. Production operations remain behind
  their evidence, approval, rollback, and retention gates.
