# DD architecture principles — bootstrap reference

> This file is intentionally a **bootstrap**, not a permanent source of truth. Sync it from the repository's accepted architecture/current-state documentation before relying on it for autonomous work.

Known current direction at the time this scaffold was created:

- Dopamine Dungeon is a multi-tenant application organized around workspaces, campaigns, memberships and role/permission boundaries.
- Application persistence is moving toward PostgreSQL/Neon behind server/API boundaries.
- Firebase Authentication remains an identity provider; authentication and application authorization are separate responsibilities.
- Firebase Storage may remain for storage where explicitly in scope.
- Direct browser-side application persistence should not be reintroduced where runtime persistence has been migrated behind APIs.
- Workspace/campaign creation and other retryable mutations should respect the repository's established idempotency and transaction conventions.
- Preview and Production cutovers are operational gates distinct from Development implementation completion.

Before enforcing any bullet above, verify it against the current repository. If the repository has moved on, update this reference instead of forcing old architecture back into the codebase.
