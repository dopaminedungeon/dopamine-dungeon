# Testing and Validation

Last updated: 2026-08-24
Owner: Magda

## Purpose

Every code change must be validated using the strongest checks currently
available in the repository.

Passing a production build does not prove that user behaviour is correct.
Automated checks and manual verification are both required.

## Package manager

Use:

```sh
pnpm
```

Do not use npm or Yarn unless explicitly required.

## #315 test-layer audit

The audit was performed before changing the runner or adding dependencies.

### Existing Node runner

Before #315, `pnpm test` used Node's built-in test runner over six files and 16
tests. Coverage was concentrated in authentication state and messages, emulator
safety, Firebase UID identity provisioning, and API error mapping. The tests
were deterministic and valuable, but the runner could not load the TypeScript
Vercel handlers: those modules correctly use emitted `.js` import specifiers,
while the repository executes TypeScript source directly during tests.

### Existing Playwright and emulator setup

Playwright already had 12 authentication-focused specs in `e2e/`. The wrapper
in `scripts/auth-test-runner.mjs` starts only the Firebase Auth emulator, pins
the fail-closed `demo-dopamine-dungeon` project, creates generated users, starts
Vite in test mode, and tears the emulator down. The fixture intercepts `/api/*`,
returns deterministic `/api/me` and invitation responses, and aborts unexpected
API calls. These are browser plus Firebase Auth tests, not Vercel API or Neon
persistence tests.

Before #315, all Playwright specs ran through one command. There was no separate
PR smoke selection, and Playwright did not run in `PR Checks`.

### Existing API and server coverage

The server suite covered sanitized error mapping and the Firebase-UID-keyed user
upsert query. No Vercel handler was executed, no GM write denial was asserted at
the handler boundary, and item or relationship create/update flows were not
covered. There was no disposable Neon test database, so no automated database
round trip existed.

### Missing unit and component coverage

Pure domain coverage remains selective rather than comprehensive. Several link,
normalization, and context behaviors have no focused unit tests. There were no
component tests and no React Testing Library dependency. Existing browser tests
cover authentication UI behavior, but using Playwright for every provider or
component state would be unnecessarily slow.

### Runner decision

#315 adopts Vitest as the single unit, API, and boundary test runner. Its Node
environment preserves the existing deterministic assertions while adding the
TypeScript resolution and ESM module mocking needed to execute real API handler
modules with isolated dependencies. The migration does not add snapshots,
coverage thresholds, a DOM environment, or a second unit runner.

React Testing Library is intentionally deferred because #315 does not change a
component with behavior that merits DOM-level integration coverage. Add it with
the first focused component or provider test that must assert rendered state,
accessible interaction, focus, or context behavior and would be excessive in
Playwright. Do not add it only to establish an empty convention.

## Retained test layers

| Layer | Purpose and ownership | Command | Data source | CI role | Do not test here |
|---|---|---|---|---|---|
| Unit/domain | Pure auth, identity, normalization, domain rules, and small utilities | `pnpm test:unit` | In-process fixtures; no services | Blocking | HTTP handler orchestration, DOM behavior, or database round trips |
| API/integration | Real Vercel handlers with controlled auth/access/database adapters; authorization calls, response projection, and create/update/link persistence intent | `pnpm test:api` | Deterministic module mocks plus Drizzle SQL generation; no network | Blocking | Browser behavior, production services, or claims about a real Neon commit |
| Boundary/security regression | Workspace and campaign scoping, membership predicates, GM denial, player-visible queries, and hidden entity/relationship non-disclosure | `pnpm test:boundary` | Actual access functions, query helpers, lightweight Drizzle schemas, and fixed payloads | Blocking | General feature breadth, visual UI, or exhaustive CRUD permutations |
| Playwright PR smoke | A minimal auth journey set across the browser and Firebase Auth emulator | `pnpm test:e2e:smoke` | Generated emulator users and deterministic intercepted API fixtures | Advisory until repeated self-hosted runner runs are trusted | Detailed layout checks, lower-level authorization logic, Vercel APIs, or Neon persistence |
| Release/regression E2E | The broader authentication, accessibility, onboarding, error, and browser-history regression set | `pnpm test:e2e` | Same isolated Auth emulator and API fixtures | Manual/release; deferred from PR CI | Logic already owned by Vitest or any production/development data |

`pnpm test` runs all Vitest files for convenience. Use the focused commands
while iterating so failures identify the owning layer. Every command used by CI
also exists as a package script.

The current API suite executes item, lore, location, NPC, relationship, session,
character, and character-assignment handlers. It proves unauthenticated early
rejection, campaign-scoped Player reads and spoiler projection, selected-mode
downgrade for dual-role users, GM write denial, campaign-scoped item upserts,
and relationship create/update selection. It deliberately does not claim a
real persistence round trip. Add a database-backed integration layer only when
the repository has a disposable, isolated Neon-compatible test database with
deterministic reset and no route to development or production data.

The boundary suite covers workspace lookup, campaign lookup within a workspace,
campaign-plus-user membership, Player-role GM denial, selected-mode fail-closed
behavior, public-only entity reads, Player-visible relationships, and GM-only
payload stripping. Keep this suite small and add cases when an access predicate
or spoiler projection changes.

### Selected mode security contract

Authenticated requests through the central API client send the selected
workspace-and-campaign mode in `X-DD-Mode`. Spoiler-bearing GET handlers grant
GM visibility only when both conditions hold:

1. persisted campaign membership is `gm`;
2. `X-DD-Mode` explicitly contains `gm`.

Player mode, a missing header, an invalid header, or unreadable client storage
all use Player visibility. The header is downgrade-only: it cannot elevate a
Player membership to GM. Membership remains the authority for mutations, so
this change does not broaden or replace existing write authorization.

API regressions execute the real item, lore, location, NPC, relationship,
session, character, and assignment handlers with a GM membership and an
explicit Player-mode request. They assert public or assignment-scoped queries
and responses with no GM notes, hidden item fields, GM session prep/secrets, or
hidden relationships. The browser fixture also rejects authenticated API
requests that omit a valid mode header.

This contract protects each server response at request time. Client-side data
stores must still refetch or invalidate GM-derived cached data when switching
to Player mode; manual dual-role verification should include switching modes
without a page reload and inspecting the visible state and subsequent network
requests.

## Repository scripts

| Purpose | Command | Required |
|---|---|---|
| Install dependencies | `pnpm install --frozen-lockfile` | Clean environments |
| All Vitest layers | `pnpm test` | General local validation |
| Unit/domain tests | `pnpm test:unit` | Relevant unit or domain changes |
| API/integration tests | `pnpm test:api` | Handler, authorization, or persistence-intent changes |
| Boundary/security tests | `pnpm test:boundary` | Access, isolation, visibility, or spoiler-safety changes |
| Playwright PR smoke | `pnpm test:e2e:smoke` | Relevant auth/browser changes; advisory CI |
| Release/regression E2E | `pnpm test:e2e` | Release regression or broad auth UI changes |
| Release/regression E2E headed | `pnpm test:e2e:headed` | Local visual debugging |
| Auth emulator | `pnpm firebase:emulators:auth` | Persistent local auth testing |
| API typecheck | `pnpm typecheck:api` | Every code change |
| E2E typecheck | `pnpm typecheck:e2e` | Every code change |
| Production build | `pnpm build` | Every code change |
| Lint | `pnpm lint` | Run and report; advisory until #316 cleanup |
| Trusted local quality gate | `pnpm quality` | Before opening or updating a PR |
| Full-stack manual server | `pnpm vercel dev` | API, auth, and persistence manual verification |
| Frontend-only server | `pnpm dev` | Isolated frontend work only |

`pnpm vercel dev` invokes the installed Vercel CLI directly and is intentionally
not a package script. Do not claim commands not present in `package.json`.

## Playwright environments

The wrapper starts Firebase Auth on `127.0.0.1:9099`, uses the hard-coded
`demo-dopamine-dungeon` project, starts Vite test mode on `127.0.0.1:4173`, and
tears both down. Never invoke these specs with plain `playwright test`; the
wrapper provides the safety environment. Install the pinned browser once with:

```sh
pnpm exec playwright install chromium
```

Firebase Local Emulator Suite requires Java 11 or newer. The test environment
must fail closed instead of falling back to development, preview, or production
Firebase. It must not create Neon records.

The PR smoke tag currently owns exactly these journeys:

- registration, blocked unverified access, emulator verification, and protected entry;
- switching an authenticated GM-capable account between GM and Player UI modes;
- sign-out followed by denied protected-route entry.

The full `pnpm test:e2e` command also retains layout, reduced-motion,
accessibility, history, credential-error, sign-in, onboarding, and retry
regressions. It is intentionally deferred from PR CI while the small smoke
subset establishes a stable self-hosted runner signal.

### Full-stack manual verification

Run the complete local application with:

```sh
pnpm vercel dev
```

This is the canonical command for manual verification. It uses the repository's
local Vercel configuration to serve the Vite frontend and Vercel API functions.
The configured Development Command is `pnpm dev --port $PORT`, so Vercel
invokes the existing Vite script internally on its assigned port. Do not start a
second `pnpm dev` process. Open the single URL printed by Vercel, normally
`http://localhost:3000`.
Use it for authentication, protected routes, `/api/*` behavior, persistence,
and Neon-backed workflows. Verify that relevant API routes return their expected
authentication or application response rather than a frontend fallback or 404,
and inspect both the browser console and Vercel server output.

`pnpm dev` runs Vite only. It may be used for isolated frontend rendering work,
but it cannot validate Vercel API functions, server-side authentication, Neon
persistence, protected API behavior, or the complete application.

## Minimum validation

Every coding task must:

1. inspect the relevant existing tests;
2. run the relevant test suite where available;
3. run linting where configured;
4. run type checking where configured;
5. run the production build;
6. perform applicable full-stack manual verification with `pnpm vercel dev`;
7. inspect the final diff.

`pnpm quality` is the trusted local blocking aggregate for PR readiness. It
runs, in order:

1. `pnpm test:unit`;
2. `pnpm test:api`;
3. `pnpm test:boundary`;
4. `pnpm typecheck:api`;
5. `pnpm typecheck:e2e`;
6. `pnpm build`.

Run `pnpm test:e2e:smoke` and `pnpm lint` separately and report their results.
They are not hidden inside `pnpm quality` while they remain advisory.

## GitHub quality gate

The `PR Checks` workflow exposes one stable job check named
`DD Quality Gate`. Its blocking steps mirror `pnpm quality`:

- `Unit and domain tests`;
- `API integration tests`;
- `Boundary and security regression tests`;
- `API typecheck`;
- `E2E infrastructure typecheck`;
- `Production build`.

The job also runs `Playwright PR smoke (advisory)` and
`Lint (advisory; cleanup tracked by #316)` with `continue-on-error`. A failure
in either advisory step is visible and must be reported, but does not make the
quality-gate job red. A failure in any blocking step makes the job red; later
steps still run so one failure does not hide other useful results.

The workflow writes one concise run summary to the GitHub step summary and
does not create PR comments. The DD AI review workflow updates its existing
marked comment instead of creating a new comment on every run.

Branch rules are not configured by workflow YAML. `DD Quality Gate` is the
only #315 check suitable to become required now because its blocking steps pass
on the healthy repository baseline. Enabling or auditing branch rules remains
#316 work. Do not make the advisory lint or smoke steps separately required.

Promote lint to blocking only after #316 resolves or intentionally configures
the existing baseline. Promote Playwright smoke only after Java and pinned
Chromium are managed on the self-hosted runner and repeated PR runs establish a
stable signal. The larger E2E suite remains release/manual until its cost and
stability justify a CI role.

#316 owns the complete workflow audit, branch/release rules, lint cleanup, and
investigation of Vite chunk warnings. #315 owns the automated test layers,
commands, smoke selection, and test-result contribution to the quality gate.
The production build remains blocking because it exits successfully today;
#315 does not silence or resolve its chunk warnings.

UI behaviour changes require relevant Playwright coverage when the workflow is
available locally. Authorization and visibility changes require both GM and
player scenarios, including denied or hidden behaviour. Failing tests must be
fixed rather than skipped, marked `fixme`, or weakened.

## Manual verification

Manual verification should cover:

- the changed behaviour;
- the primary success path;
- an error or edge state;
- a neighbouring unaffected workflow;
- GM and player behaviour where relevant;
- mobile layout for visible UI changes;
- persistence after refresh where relevant;
- campaign isolation where relevant.

## UI changes

For visible UI changes, verify:

- loading state;
- empty state;
- success state;
- validation errors;
- server errors;
- keyboard and focus behaviour where applicable;
- responsive layout;
- absence of console errors.

Before and after screenshots should be included in the pull request when useful.

## API changes

For API changes, verify:

- unauthenticated access is rejected;
- unauthorized access is rejected;
- workspace and campaign scoping;
- successful response;
- invalid input;
- missing records;
- no sensitive data is returned;
- existing clients remain compatible.

## Database changes

For database or migration changes, verify:

- migration applies successfully in development;
- existing data remains valid;
- rollback or mitigation is documented;
- the change is backward-compatible where possible;
- production credentials were not used;
- affected queries remain tenant-scoped.

## When checks cannot run

The task report must state:

- which check could not run;
- the exact reason;
- whether the failure is environmental or code-related;
- what alternative validation was performed;
- what risk remains.

A skipped check must never be described as passing.

## Completion report

Every implementation report must include:

```text
Commands run:
- command
- result

Manual verification:
- scenario
- result

Unverified:
- item
- reason
```

Then compare the table to `package.json` and delete nonexistent commands.
