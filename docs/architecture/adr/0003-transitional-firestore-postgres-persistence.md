# ADR 0003: Transitional Firestore and PostgreSQL Persistence

Status: Accepted
Date: 2026-07-24
Decision owner: Magda

## Context

Historical decision context follows. Implementation status was reconciled on
2026-09-05; the current boundary is recorded below.

Dopamine Dungeon is migrating application data from Firestore to Neon PostgreSQL.

Neon PostgreSQL is the intended primary application database.

However, some existing application paths still use Firestore, including
workspace bootstrap, selected membership and invitation flows, settings, mail
delivery, and legacy user or character-assignment repositories.

This creates a transitional state where different parts of the application may
persist data in different systems.

## Decision

Neon PostgreSQL is canonical for Dopamine Dungeon application data. This is
the destination architecture, not merely an intended direction.

Firebase Authentication remains responsible for user authentication.

Existing Firestore-backed application-data paths are treated as migration debt.

[ADR 0006](0006-canonical-workspace-and-campaign-creation.md) defines the
canonical server-API creation path for workspaces and campaigns. [#298](https://github.com/dopaminedungeon/dopamine-dungeon/issues/298) owns the complete
Firestore retirement programme, including environment exports, authorization
parity, reconciliation, canary, and retirement gates.

No new application-data persistence should be added to Firestore unless an
explicit architecture decision approves it.

Before changing a feature, developers and agents must inspect its actual
persistence path rather than assuming it already uses PostgreSQL.

## Current implementation audit

Core campaign entity repositories for sessions, items, inventory, NPCs,
locations, lore, PCs, and typed entity links use the API and Neon. Arc, Quest,
and Condition are reserved typed-link concepts without active standalone pages.
Firebase Authentication remains the identity provider. Bootstrap, profile,
membership, invitation, assignment, and campaign settings paths now use Neon
through authenticated APIs. Authentication-email limiters use Neon and mail
uses direct Brevo. The browser Firestore repositories and initialization are
retired (PR #365).

Firestore remains an explicit historical input for operational tooling and
retention/recovery. The temporary Production audit reader remains on `dev`
but was removed from `main` by PR #373. Environment exports, limiter cutover,
deny-all canary, and physical retirement require separate evidence and authority;
see the [migration inventory](../FIRESTORE_TO_NEON_MIGRATION.md).

## Consequences

### Positive

- The intended architecture is explicit.
- Agents are less likely to create new Firestore persistence accidentally.
- Existing migration debt is visible.
- Features can be migrated gradually.

### Historical transition costs

- The application temporarily has two persistence systems.
- Some creation and loading paths may behave inconsistently.
- Developers must verify each feature individually.

## Risks

The following motivated the migration and remain regression risks when copying
legacy code; they are not claims that bootstrap still uses split stores.

- A record may be written to Firestore but loaded from PostgreSQL.
- A feature may appear to save successfully but not appear after refresh.
- Authorization or tenant scoping may differ between legacy and migrated paths.
- New code may accidentally copy outdated Firestore patterns.

## Rules during the transition

- Do not introduce new Firestore application-data writes.
- Do not remove legacy Firestore paths without verifying replacement behaviour.
- Keep Firebase Authentication separate from application-data persistence.
- Document migrated and non-migrated modules in CURRENT_STATE.md.
- Treat cross-database behaviour as high risk.
- Re-check `docs/architecture/SYSTEM_OVERVIEW.md` when a module is migrated so
  the ownership boundary stays canonical.
- Follow the [Firestore to Neon migration inventory](../FIRESTORE_TO_NEON_MIGRATION.md)
  before changing a Firestore dependency.

## Revisit when

- All application-data persistence has moved to PostgreSQL.
- Legacy Firestore repositories have been removed.
- Workspace and campaign creation are fully PostgreSQL-backed.
