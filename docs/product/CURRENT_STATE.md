# Current State

Last updated: 2026-07-24
Maintainer: Magda

## Current release

Development version: v0.6
Production version: v0.5

## Current product focus

- Resolving Tech debt and bugs in currently available functionalities
- Enhancement of multiple functionalities (e.g. Bag of Holding, Character sheet upload)
- Enhancement of performance and loading/error states

## What currently works

- Multi-workspace and multi-campaign foundation
- Firebase authentication
- Neon-backed core data
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
- Quests & friendship meter (mocked)

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

See `docs/sprints/current.md`.

## Do not change without an explicit decision

- Firebase Authentication
- Neon as the relational data store
- `dev` → preview and `main` → production deployment model
- Tenant and campaign boundaries