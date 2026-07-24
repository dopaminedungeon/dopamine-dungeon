# ADR 0003: Transitional firestore postgres persistence

Status: Accepted
Date: 2026-07
Decision owner: Magda

## Context

TBD

## Decision

- Neon/Postgres is the target primary application store.
- Firebase Authentication remains.
- Some legacy/bootstrap application-data paths still use Firestore.
- No new Firestore persistence should be introduced.
- Existing Firestore paths must be treated as migration debt.
- Agents must inspect the persistence implementation for each domain rather than assuming all data is already in Postgres.

## Alternatives considered

TBD

## Consequences

TBD

## Implementation notes

TBD

## Revisit when

- the project gains multiple regular contributors;
- release frequency increases significantly;
- environment or deployment needs change.