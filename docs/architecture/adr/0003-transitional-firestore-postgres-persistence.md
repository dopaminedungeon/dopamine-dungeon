# ADR 0003: Transitional Firestore and PostgreSQL Persistence

Status: Accepted
Date: 2026-07-24
Decision owner: Magda

## Context

Dopamine Dungeon is migrating application data from Firestore to Neon PostgreSQL.

Neon PostgreSQL is the intended primary application database.

However, some existing application paths still use Firestore, including some
workspace and campaign bootstrap logic and legacy repositories.

This creates a transitional state where different parts of the application may
persist data in different systems.

## Decision

Neon PostgreSQL remains the target primary application database.

Firebase Authentication remains responsible for user authentication.

Existing Firestore-backed application-data paths are treated as migration debt.

No new application-data persistence should be added to Firestore unless an
explicit architecture decision approves it.

Before changing a feature, developers and agents must inspect its actual
persistence path rather than assuming it already uses PostgreSQL.

## Consequences

### Positive

- The intended architecture is explicit.
- Agents are less likely to create new Firestore persistence accidentally.
- Existing migration debt is visible.
- Features can be migrated gradually.

### Negative

- The application temporarily has two persistence systems.
- Some creation and loading paths may behave inconsistently.
- Developers must verify each feature individually.

## Risks

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

## Revisit when

- All application-data persistence has moved to PostgreSQL.
- Legacy Firestore repositories have been removed.
- Workspace and campaign creation are fully PostgreSQL-backed.