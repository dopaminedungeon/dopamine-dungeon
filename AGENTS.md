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

## Local development environments

- Run the complete application with `pnpm vercel dev`. This is the canonical
  local development command and serves both the Vite frontend and Vercel API
  functions using the repository's local Vercel configuration.
- Do not run a separate `pnpm dev` process beside `pnpm vercel dev`. Vercel uses
  the repository `devCommand` to run the existing Vite script on its assigned
  port and exposes one public local URL.
- Use the full-stack command for authentication, protected API, persistence,
  Neon-backed, and end-to-end manual verification. Confirm relevant `/api/*`
  routes are served and inspect both browser and server errors.
- `pnpm dev` starts only the Vite frontend. It is suitable for isolated frontend
  work, but it is not evidence that authentication, API, database-backed, or
  complete application workflows work.
- Emulator-backed Playwright tests are a separate, fail-closed test environment.
  Do not substitute development or production Firebase or Neon services for the
  isolated test services configured by the test runner.

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

## Browser and authentication testing

- Run unit tests with `pnpm test`.
- Run emulator-backed browser tests with `pnpm test:e2e`; do not invoke
  Playwright directly because the wrapper supplies the guarded test environment.
- Use `pnpm test:e2e:headed` for local visual debugging.
- Use `pnpm firebase:emulators:auth` only when a persistent local Auth emulator
  is needed. Emulator tests must use the `demo-dopamine-dungeon` project and
  generated users; never point test mode at development, preview, or production.
- Install the pinned browser once with `pnpm exec playwright install chromium`.
- UI behaviour changes require relevant Playwright coverage where the workflow
  can be exercised locally.
- Authorization or visibility changes require explicit GM and player Playwright
  coverage, including the denied or hidden case.
- Do not weaken assertions, mark failing tests skipped/fixme, or bypass emulator
  safety checks to make a test pass.

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
