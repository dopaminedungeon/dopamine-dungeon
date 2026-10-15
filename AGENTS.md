# Dopamine Dungeon — Agent Instructions

## Product

Dopamine Dungeon is a multi-tenant web application for managing
tabletop role-playing campaigns.

The authenticated user may belong to multiple workspaces and campaigns.
Campaign data must never leak across campaign or workspace boundaries.

Design for narrative importance, low cognitive load, explicit entities and meaningful
typed relationships. Prefer understandable, reversible solutions over clever
abstractions. GM mode may access secrets; Player mode must be spoiler-safe.
Mode-specific data access must be enforced server-side, not only hidden in the UI.

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

- For code changes, implement only the requested issue or explicitly authorized task.
- Do not perform unrelated refactoring.
- Do not change schemas or API contracts unless the issue requires it.
- Do not add a new dependency without explaining why it is necessary.
- Prefer the smallest reversible change that satisfies the acceptance criteria.
- Preserve existing player/GM visibility rules.
- Preserve tenant and campaign isolation.
- Do not replace persisted functionality with mock state.
- Do not claim persistence exists unless it is backed by the API and database.
- Do not create GitHub issues unless explicitly requested. Search for duplicates
  first; if one is created, verify it once and report its number and title.
- Do not create commits, branches, or PRs during design/documentation-only work
  unless explicitly instructed.

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

## Repository skills

Skills are stored under `.agents/skills/` and provide task-specific workflows.
Follow the relevant skill when its activation criteria match; an explicit
`$skill-name` request also activates it. The repository and accepted decisions
remain authoritative over outdated skill assumptions.

- **`dd-architecture-guardian`**: use for architecture-impacting planning,
  implementation, or reviews (persistence, access control, tenant boundaries,
  APIs, migrations, environments). It assesses architectural integrity and
  determines when an explicit architectural decision or ADR is needed.
- **`design-decision-keeper`**: use for product/feature/UX design discussions,
  explicit requirement corrections, mockups, and updating existing design issues.
  It records clearly confirmed decisions and reconciles relevant existing issues;
  it does not turn tentative suggestions into requirements.

When both apply, check architecture with the Guardian and manage confirmed
product decisions with the Keeper. Neither skill overrides authorization rules,
accepted ADRs, or the user's explicit approval boundaries. Do not interpret
an architectural review verdict as approval for an architectural change.

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

Every completed coding/implementation task must include:

- Summary
- Files changed
- Architectural impact
- Tests and checks run
- Results
- Risks or unresolved questions
- Manual verification steps
- Rollback approach

For design-only work, documentation updates, or existing-issue edits, use a
compact report of decisions, files/issues updated, verification, and unresolved
questions. Do not imply GitHub updates or commits occurred without confirmation.


## Project skill routing

Use relevant repository-local skills automatically within the current task.
Do not wait for an explicit $skill invocation when the task matches.
Read each selected SKILL.md and briefly announce which skill is being used.

### Design Decision Keeper

Path: .agents/skills/design-decision-keeper/SKILL.md

Use for product or UX discussions, mockup reviews, requirement corrections,
confirmed design decisions, and reconciliation of existing GitHub issues.

Distinguish exploratory proposals from confirmed decisions.
Record clear decisions and reconcile clearly affected existing issues
according to the Keeper's operating rules without requesting approval again.
Clarify ambiguous decisions or targets before dependent updates.

Use existing authoritative records:
- Feature requirements: their owning issue or requirement document.
- Cross-cutting product/UX standards: reusable product documentation.
- Architectural decisions: the Guardian and existing ADR process.

Create issues only when explicitly requested. Check for duplicates first,
create only the requested issue, and never add issues opportunistically.

### DD Architecture Guardian

Path: .agents/skills/dd-architecture-guardian/SKILL.md

Use when a task affects architecture, authorization, GM/Player projection,
tenant or campaign isolation, persistence boundaries, data models,
API contracts, or architectural implementation planning and review.

Ground reviews in repository evidence and follow the Guardian's existing
verdict and escalation rules.

### UI Consistency Scout

Path: .agents/skills/ui-consistency-scout/SKILL.md

Use when implementing or changing UI, reviewing mockups, or investigating
visual or interaction inconsistencies.

Automatically review the affected UI against applicable approved patterns.
Keep the review scoped to the current task; inspect other pages as references.
Do not initiate an app-wide audit unless requested.

Report findings by default. Implement corrections only when explicitly
requested, including requests such as “fix the inconsistencies,” and only
within the authorized scope.

Locate the canonical UI pattern library through repository documentation.
Issue #418 owns its initial audit, approval, and review method; its suggested
document path is docs/product/ui-patterns.md.

Distinguish observed, proposed, and approved patterns.
Do not treat common implementations as approved standards or override
documented exceptions.

### Coordination and boundaries

Use multiple skills when their responsibilities apply to the same task:
- Scout identifies and verifies visual/interaction differences.
- Keeper records confirmed decisions and reconciles requirements/issues.
- Guardian assesses architectural and authorization implications.

Do not duplicate records or repeat the same review under multiple skills.
Route unresolved product choices to the user and architectural concerns
to the Guardian; do not silently convert either into approved requirements.

Explicit task restrictions apply to every skill. A read-only task permits
no writes. Automatic skill selection does not expand implementation scope
or authorize commits, branches, PRs, deployments, or issue creation.

If a required skill is unavailable, report that limitation rather than
claiming it was used.