# Current State

Last updated: 2026-09-05
Maintainer: Magda

## Current release

- Iteration 3 release PR [#372](https://github.com/dopaminedungeon/dopamine-dungeon/pull/372)
  merged to `main` on 2026-09-04. This snapshot describes repository behavior
  at `fbb61c1` on `dev`; deployed version, schema, and provider readiness were
  not independently verified during #328.

## Current product focus

- Resolving Tech debt and bugs in currently available functionalities
- Enhancement of multiple functionalities (e.g. Bag of Holding, Character sheet upload)
- Enhancement of performance and loading/error states

## What currently works

- Multi-workspace and multi-campaign foundation
- Firebase Google and email/password authentication, verification, recovery,
  and same-identity credential linking in Profile Settings; password setup is optional
- Neon-backed application state, including atomic workspace/campaign creation,
  memberships, invitations, profile preferences, and Campaign Settings
- Public site separated from application bootstrap; verified invitation
  acceptance resolves before independent-user onboarding
- Direct Brevo transactional mail and Neon authentication-email limiters
- Sessions
- Items and inventory
- Campaign membership and invitations
- Existing GM/player mode behaviour
- Lore, Locations, NPCs
- Typed entity links between active campaign entities

Verify this list against the repository before relying on it.

## Partially implemented or mocked

- Transitional upload of Location files
- Campaign deletion and role-management refinements remain deferred
- Dashboard status signals are static guidance rather than activity-derived data
- Global search is not implemented and no global search control is exposed
- Friendship Index concepts (future; not implemented)

The former standalone Relationships page and profile are retired. Relationship-
like behavior remains available through typed entity cross-links, while future
Friendship Index work will cover intentional PC-NPC and NPC-NPC relationship
behavior.

The former mock-backed Arcs, Quests, and Conditions screens are also retired.
Their typed entity-link endpoints and allowed labels remain infrastructure for
future, separately approved work.

## Current architecture risks

- Permission logic may be duplicated
- Some domains expose timestamps inconsistently
- Introduction of subscription / payment needs better design
- Public shell is implemented; About, Pricing, and Resources remain coming-soon
  surfaces. Public release copy/design acceptance remains in #290 and #291.
- Firestore operational retirement and Production cutover evidence must be
  distinguished from completed application migration; see the
  [migration inventory](../architecture/FIRESTORE_TO_NEON_MIGRATION.md).

## Known technical debt

| Area | Debt | Consequence | Priority |
| --- | --- | --- | --- |
| Permissions | Logic may exist in multiple layers | Inconsistent access control | High |
| Release operations | Cutover, retention, and live provider evidence need operator confirmation | Merged code alone does not establish live readiness | High |
| FE/UI bugs | Bugs that are already added ranging from wrong parsing of data to wrong interpretation of it | Data inconsistency | Urgent |

## Active iteration

Iteration 4 — bugfixing (v0.6.1) is current as of 2026-09-06. Its goals,
sequencing, dependencies, and non-goals are in [current.md](../sprints/current.md).
Assigned work is planned, not a claim of delivered fixes.

Historical evidence is preserved in the
[Iteration 2 retrospective](../sprints/iteration-2-retrospective-notes.md) and
[Iteration 3 retrospective](../sprints/iteration-3-retrospective-notes.md).

## Do not change without an explicit decision

- Firebase Authentication
- Neon as the relational data store
- `dev` → preview and `main` → production deployment model
- Tenant and campaign boundaries
