# Workspace and campaign roles: implementation reference

This guide summarizes the role and mode behavior verified in the current
repository. It is a code-reading reference, not a guarantee that every legacy
handler follows one centralized permission policy. The schema and authorization
helpers are the implementation sources: [`memberships.ts`](../db/schema/memberships.ts),
[`access.ts`](../src/server/access.ts), and
[`viewer-mode.ts`](../src/server/viewer-mode.ts).

## Identity and scope

Firebase authentication resolves one application user. Memberships associate
that user with a workspace and, separately, with a campaign. A campaign has a
`workspace_id`; campaign resolution by the app's workspace-and-campaign IDs
constrains the lookup to that workspace. Membership checks use both the
resolved entity ID and user ID. Some older handlers resolve a campaign by slug
before checking campaign membership, so do not infer that every route uses the
same workspace-resolution helper. See [`SYSTEM_OVERVIEW.md`](architecture/SYSTEM_OVERVIEW.md)
for the broader ownership model.

## Roles represented by the membership schema

Both membership `role` columns are PostgreSQL `text`, not database enums or
check-constrained columns. The comments in the schema declare these values:

| Membership | Schema-declared roles | Verified role-based authorization |
|---|---|---|
| Workspace | `owner`, `gm`, `player` | `requireWorkspaceOwner` accepts only `owner`. Workspace creation grants `owner`; campaign creation and workspace people management require `owner`. Invitation creation additionally requires campaign GM membership and selected GM mode. The shared access helpers do not grant workspace-level privileges to `gm` or `player`. |
| Campaign | `gm`, `player` | `requireCampaignMember` accepts any existing membership row without validating its role string. `requireCampaignGm` accepts only `gm`. Campaign content write handlers using that helper require a campaign GM membership. |

These are the schema-declared role names, not guaranteed exhaustive values in
existing data. **Current write paths conflict with that declaration:** the
[`workspace-people` handler](../src/server/api-handlers/workspace-people.ts)
maps a requested `owner` or `admin` to that literal value and maps other values
to `member`; [invitation acceptance](../api/invitations/accept-pending.ts)
inserts the invitation workspace role, defaulting to `member`, into
`workspace_memberships`. The database column permits these strings.
Consequently this guide does not treat
`admin` or `member` as supported workspace roles, but their presence can be
produced by current code. The full persisted workspace-role set and the
intended migration/correction policy cannot be established from the schema
comments and authorization paths alone. These values do not satisfy
`requireWorkspaceOwner` unless the value is exactly `owner`.

`member` is also a workspace-people/invitation display fallback. In those
responses it may be a presentation default rather than a membership row; the
invitation-acceptance insert above is separately confirmed to persist it.

## Verified access behavior

| Operation / boundary | Check visible in current code |
|---|---|
| Workspace owner operation | `requireWorkspaceOwner` looks up the `(workspaceId, userId)` membership and accepts only role `owner`; otherwise it rejects. Workspace people management and campaign creation use this owner check. |
| Campaign member access | `requireCampaignMember` looks up `(campaignId, userId)` and rejects when no row exists. It does not distinguish `gm` from `player` or validate other role strings. |
| Campaign GM operation | `requireCampaignGm` uses the same campaign/user scope and accepts only role `gm`. Content handlers including NPCs, Locations, Items, Lore, Sessions, Characters, and entity links call it on their relevant writes. |
| Campaign settings | Requires both campaign and workspace membership. GM fields and updates additionally require campaign role `gm` **and** selected GM mode. |
| Invitations | Creation resolves the campaign within the supplied workspace, requires workspace role `owner`, then campaign GM membership in selected GM mode. |
| Removing campaign people | The campaign-people handler requires GM membership in selected GM mode. It prevents removal of the last campaign GM or a workspace owner who is a campaign member. |

These checks are path-specific rather than a complete permission matrix for
every endpoint. In particular, some campaign write handlers call
`requireCampaignGm` without consulting the selected mode, while other
operations (such as Campaign Settings and invitation management) check both.
Therefore the code does not establish that Player mode blocks every
GM-role-authorized API mutation. Do not use the mode description below as a
claim that it universally revokes server-side role permissions.

## Role is not active mode

Campaign role is persisted membership data. Active mode is a separate,
selected GM/Player viewing context; switching it does not change membership.
`getSelectedMode` recognizes the `X-DD-Mode: gm` header and otherwise resolves
to Player. `canViewAsGm` returns true only when both campaign role is `gm` and
selected mode is `gm`. Read projections that use this helper therefore give a
GM-role user Player visibility in Player mode. The `ModeContext` also derives
GM capability from the selected campaign role and downgrades stored GM mode
when the role is not GM; this is client behavior, not a replacement for API
authorization.

The names `WorkspaceAdmin`, `WorkspaceMember`, `CampaignGM`, and
`CampaignPlayer` in older versions of this document were conceptual labels,
not schema values. Use the lowercase membership values above when discussing
stored roles. “Tenant” is older terminology for workspace. Billing, limits,
branding, super-admin access, custom roles, and other fine-grained permissions
are future concepts, not verified current permissions.

## What this code review does not establish

- The database contains only the roles named in the schema comments; the text
  columns have no role constraint, and current workspace writers can insert
  other values.
- A complete permission set for workspace `gm` and `player` roles. The shared
  workspace helper grants only the owner check, while many application paths
  authorize by campaign membership.
- A universal rule that Player mode blocks all GM-role mutations. Some write
  handlers check campaign role without checking the mode header.
- A single tenant-scoping pattern across all routes. The workspace-and-campaign
  resolver is scoped, but some handlers resolve a campaign slug directly and
  then rely on membership checks.

Resolve these implementation inconsistencies before turning this reference
into a stronger permission contract. This documentation change does not alter
roles, stored data, authorization, or API behavior.
