# Verified Authorization Checks (Path-Specific)

This is an implementation map, not a complete product permission contract or a
route allowlist. Membership role and selected GM/Player mode are separate. The
schema-declared role names and their known limitations are described in the
[workspace and campaign role guide](multitenant-multirole-management.md).

| Operation / boundary | Verified check in current code | Important limit |
|---|---|---|
| Workspace owner operations | `requireWorkspaceOwner` accepts only a membership with role exactly `owner`. Workspace creation grants `owner`; campaign creation and workspace people management require it. | The schema columns are text. Workspace role writers can persist `admin` or `member`; those values do not pass the owner check. This table does not establish a full workspace permission set for `gm` or `player`. |
| Campaign membership gate | `requireCampaignMember` requires a row for `(campaignId, userId)`. | It does not validate a role string or distinguish `gm` from `player`; endpoint behavior after this check varies. |
| Campaign GM gate | `requireCampaignGm` requires campaign role exactly `gm`. Several campaign content handlers use it for writes. | This helper does not inspect selected mode. Some handlers add a mode check; others do not. |
| GM-visible projection | `canViewAsGm` is true only for campaign role `gm` and selected request mode `gm`. Missing/invalid mode resolves to Player. | Applies only to handlers that call this helper; it is not a global middleware guarantee. |
| Campaign Settings | Requires campaign and workspace membership; GM fields/updates also require campaign role `gm` and explicit GM mode. | This path has its own response projection and is not evidence that all campaign routes match it. |
| Invitation creation | Resolves the campaign within the requested workspace, then requires workspace owner, campaign membership, and GM mode with campaign role `gm`. | Invitation acceptance currently writes workspace role `member`, despite the workspace schema comment; see the role guide. |
| Campaign people management | Requires campaign role `gm` and selected GM mode. Removal protects the last campaign GM or workspace owner who is a campaign member. | The people endpoint uses a slug-based campaign lookup before membership; do not generalize its resolver to all routes. |

`X-DD-Mode` controls selected projections and some endpoint actions; it never
changes stored membership. Do not claim that Player mode universally blocks
every GM-role mutation: route-level checks differ. Read-only UI filtering is
not security enforcement. For the broader access-boundary test inventory, see
[`TESTING.md`](operations/TESTING.md); for unresolved permission refinement,
see [#284](https://github.com/dopaminedungeon/dopamine-dungeon/issues/284).

The old page-by-page matrix asserted more than the current code establishes
(including “read-only everywhere else” and universal Player-mode route denial)
and has been removed rather than retained as a misleading contract. PC
assignment display rules should be documented with their feature behavior and
tests, not inferred from this shared helper map.
