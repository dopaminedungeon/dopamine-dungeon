# ADR 0002: Use `dev` for Integration and `main` for Production

Status: Accepted
Date: 2026-06
Decision owner: Magda

## Context

Dopamine Dungeon requires a safe separation between ongoing development and the
production application used by the active campaign.

Changes must be reviewable and testable before reaching production.

The repository currently uses Vercel for deployments and GitHub for source
control.

## Decision

Use the following branch responsibilities:

### `dev`

- integration branch;
- target for feature pull requests;
- source for development or preview validation;
- may contain work intended for the next release;
- must remain testable.

### `main`

- production branch;
- source of the production deployment;
- contains only reviewed and release-ready work;
- must not receive direct implementation commits.

Feature work must:

1. branch from `dev`;
2. be implemented on a dedicated feature or fix branch;
3. open a pull request against `dev`;
4. pass applicable checks;
5. be reviewed before merge.

Production releases must:

1. validate the accumulated work on `dev`;
2. prepare release notes where appropriate;
3. merge or promote reviewed changes from `dev` into `main`;
4. verify the production deployment;
5. retain a rollback path.

## Alternatives considered

### Develop directly on `main`

Rejected because:

- incomplete work could deploy directly to production;
- review and preview validation would be bypassed;
- rollback and release boundaries would be unclear.

### Use only feature branches and `main`

Rejected for the current workflow because:

- multiple changes need an integration point before production;
- a stable shared development environment is useful;
- release validation should occur before changes reach `main`.

### Use a more complex GitFlow model

Rejected for now because release, hotfix, and support branches would add process
overhead disproportionate to the size of the project.

## Consequences

### Positive

- development and production remain separated;
- changes can be validated together before release;
- production deployments remain intentional;
- agent-generated changes have a controlled target;
- rollback boundaries are clearer.

### Negative

- `dev` may drift from `main`;
- merge conflicts can accumulate;
- release promotion requires discipline;
- urgent fixes require care to avoid branch divergence.

### Risks

- accidentally targeting a pull request at `main`;
- direct pushes bypassing review;
- `dev` containing broken integration work;
- fixes applied only to one branch;
- environment configuration differing unexpectedly.

## Implementation notes

- Agent-created pull requests must target `dev`.
- Agents must never merge pull requests.
- Agents must never deploy production.
- Direct pushes to `main` should be prevented where repository settings allow.
- Production secrets must not be exposed to coding agents.
- Hotfixes must be reconciled back into `dev`.

## Revisit when

- the project gains multiple regular contributors;
- release frequency increases significantly;
- environment or deployment needs change;
- trunk-based development becomes demonstrably simpler;
- the current model causes repeated branch divergence.