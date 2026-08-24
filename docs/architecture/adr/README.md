# Architecture Decision Records

Architecture Decision Records, or ADRs, document significant technical
decisions made for Dopamine Dungeon.

They explain:

- the context that required a decision;
- the available options;
- the selected option;
- why it was selected;
- the consequences;
- when the decision should be reconsidered.

ADRs should record decisions that affect architecture, data, security,
deployment, or long-term development behaviour.

## File naming

Use the following format:

```NNNN-short-decision-title.md```

Example:

```0001-neon-as-primary-database.md```

Numbers are sequential and are never reused.

Status values

Each ADR must use one of these statuses:

- Proposed
- Accepted
- Superseded
- Deprecated
- Rejected

A superseded ADR should remain in the repository and link to the newer decision.

Each ADR also has an audit classification describing its relationship to the
current repository:

- Current
- Partially implemented
- Proposed
- Obsolete
- Contradicted

Status describes the decision lifecycle; classification describes whether the
repository implements it today. Do not mark a decision superseded merely
because its migration is incomplete.

## Index

| ADR | Status | Classification | Summary |
|---|---|---|---|
| [0001](0001-neon-as-primary-database.md) | Accepted | Partially implemented | Neon is primary for core relational campaign data; transitional Firestore paths remain. |
| [0002](0002-dev-main-deployment-flow.md) | Accepted | Current | Feature -> `dev` -> `main`, with lightweight release and hotfix exceptions. |
| [0003](0003-transitional-firestore-postgres-persistence.md) | Accepted | Current | Explicit Firestore/Neon ownership and migration constraints. |
| [0004](0004-firebase-identity-and-email-verification.md) | Proposed | Proposed | Iteration 3/#256 direction for verification UX and identity reconciliation; not current behavior. |
| [0005](0005-vercel-runtime-and-isolated-auth-testing.md) | Accepted | Current | Full-stack Vercel runtime and fail-closed emulator test boundary. |
| [0006](0006-canonical-workspace-and-campaign-creation.md) | Proposed | Proposed | Resolve the split Firestore bootstrap and Neon read/write path. |

## Template

```
# ADR NNNN: Decision title

Status: Proposed
Date: YYYY-MM-DD
Decision owner: Magda

## Context

What problem or constraint requires a decision?

## Decision

What has been decided?

## Alternatives considered

### Alternative 1

Why was it considered?

Why was it rejected?

### Alternative 2

Why was it considered?

Why was it rejected?

## Consequences

### Positive

- ...

### Negative

- ...

### Risks

- ...

## Implementation notes

- ...

## Revisit when

- ...
```

## When an ADR is required

Create or update an ADR when changing:

- the primary database;
- authentication;
- tenancy or authorization;
- deployment flow;
- environment strategy;
- major framework or runtime;
- API architecture;
- migration strategy;
- storage ownership;
- repository branching rules;
- major cross-cutting abstractions.
