# Dopamine Dungeon — Agent Instructions

## Product

Dopamine Dungeon is a multi-tenant web application for managing
tabletop role-playing campaigns.

The authenticated user may belong to multiple workspaces and campaigns.
Campaign data must never leak across campaign or workspace boundaries.

## Repository workflow

- `dev` is the integration and preview branch.
- `main` is the production branch.
- Never commit directly to `main`.
- Feature branches should be created from `dev`.
- Open pull requests against `dev` unless explicitly instructed otherwise.
- Never merge a pull request.
- Never deploy production changes.
- Do not alter production data.

## Before changing code

1. Read `docs/product/CURRENT_STATE.md`.
2. Read `docs/architecture/SYSTEM_OVERVIEW.md`.
3. Inspect the existing implementation before proposing a solution.
4. Search for existing patterns before creating new abstractions.
5. State assumptions when repository evidence is incomplete.

## Scope discipline

- Implement only the requested issue.
- Do not perform unrelated refactoring.
- Do not change schemas or API contracts unless the issue requires it.
- Do not add a new dependency without explaining why it is necessary.
- Prefer the smallest reversible change that satisfies the acceptance criteria.
- Preserve existing player/GM visibility rules.
- Preserve tenant and campaign isolation.
- Do not replace persisted functionality with mock state.
- Do not claim persistence exists unless it is backed by the API and database.

## Architecture

Current core technologies include:

- React
- Vite
- Tailwind CSS
- React Router
- Neon PostgreSQL
- Drizzle ORM
- Firebase Authentication
- Vercel
- pnpm

Treat repository code as the source of truth when this list becomes stale.

## Required validation

Before completing a coding task:

1. Install dependencies only when required.
2. Run the relevant existing tests.
3. Run linting.
4. Run type checking if configured.
5. Run the production build.
6. Report every command run and its result.
7. If a check cannot run, explain why.
8. Review the final diff for unrelated changes.

Use the commands documented in `docs/operations/TESTING.md`.

## Database safety

- Never run destructive migrations against production.
- Never print, commit, or expose secrets.
- Do not change environment files containing secrets.
- Migration changes must include rollback or mitigation notes.
- Identify whether a change is backward-compatible.
- Preserve existing data unless explicitly instructed otherwise.

## Completion report

Every completed task must include:

- Summary
- Files changed
- Architectural impact
- Tests and checks run
- Results
- Risks or unresolved questions
- Manual verification steps
- Rollback approach