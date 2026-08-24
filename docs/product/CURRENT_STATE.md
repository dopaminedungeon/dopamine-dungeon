# Current State

Last updated: 2026-08-24
Maintainer: Magda

## Current release

- Development version: v0.6
- Production version: v0.5

## Current product focus

- Resolving Tech debt and bugs in currently available functionalities
- Enhancement of multiple functionalities (e.g. Bag of Holding, Character sheet upload)
- Enhancement of performance and loading/error states

## What currently works

- Multi-workspace and multi-campaign foundation
- Firebase authentication
- Neon-backed core campaign entities; transitional Firebase/Firestore paths
  remain for documented bootstrap, membership, invitation, settings, mail, and
  legacy assignment flows
- Sessions
- Items and inventory
- Campaign membership and invitations
- Existing GM/player mode behaviour
- Lore, Locations, NPCs

Verify this list against the repository before relying on it.

## Partially implemented or mocked

- Transitional upload of Location files
- Non-persistent Campaign metadata
- Placeholder links in multiple elements
- Search engine
- Friendship Index concepts (future; not implemented)

The former standalone Relationships page and profile are retired. Relationship-
like behavior remains available through typed entity cross-links, while future
Friendship Index work will cover intentional PC-NPC and NPC-NPC relationship
behavior.

## Current architecture risks

- Permission logic may be duplicated
- Some domains expose timestamps inconsistently
- Introduction of subscription / payment needs better design
- Application and "promotional" pages are not established and anyone with a link can enter

## Known technical debt

| Area | Debt | Consequence | Priority |
|---|---|---|---|
| Permissions | Logic may exist in multiple layers | Inconsistent access control | High |
| Documentation | Architecture knowledge is conversational | Agent confusion | Medium |
| Routing & Workflow | Current routing allows anyone with a link to enter and create a Workspace in DD | Inability to reliably track users | High |
| FE/UI bugs | Bugs that are already added ranging from wrong parsing of data to wrong interpretation of it | Data inconsistency | Urgent |

## Active iteration

Iteration 2 is closed. The final retrospective and next-iteration handoff are
in `docs/sprints/current.md`; roadmap priorities remain in `ROADMAP.md`.

## Do not change without an explicit decision

- Firebase Authentication
- Neon as the relational data store
- `dev` → preview and `main` → production deployment model
- Tenant and campaign boundaries
