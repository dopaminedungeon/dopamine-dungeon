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