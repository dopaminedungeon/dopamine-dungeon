# Testing and Validation

Last updated: 2026-07-24
Owner: Magda

## Purpose

Every code change must be validated using the strongest checks currently
available in the repository.

Passing a production build does not prove that user behaviour is correct.
Automated checks and manual verification are both required.

## Package manager

Use:

```pnpm```

Do not use npm or Yarn unless explicitly required.

## Repository scripts

Replace this section with the exact scripts from package.json.

| Purpose | Command | Required |
|-----|-----|-----|
| Install dependencies | pnpm install --frozen-lockfile | Clean environments |
| Full-stack development server | pnpm vercel dev | Authentication, API-dependent, persistence, and complete manual verification |
| Frontend-only Vite server | pnpm dev | Isolated frontend work only; not full application verification |
| Unit tests | pnpm test | Every code change with relevant unit coverage |
| Auth E2E tests | pnpm test:e2e | Authentication and relevant UI changes |
| Auth E2E tests (headed) | pnpm test:e2e:headed | Manual browser debugging |
| Auth emulator | pnpm firebase:emulators:auth | Persistent local auth testing |
| Lint | pnpm lint | Every code change, if configured |
| Type checking | pnpm typecheck:api | Every code change, if configured |
| E2E type checking | pnpm typecheck:e2e | Playwright and E2E infrastructure changes |
| Production build | pnpm build | Every code change |

Commands that do not exist in package.json must not be claimed as available.
`pnpm vercel dev` invokes the repository's installed Vercel CLI directly and is
therefore intentionally not a package script.

## Validation environments

### Unit and static checks

Run `pnpm test` for unit tests, `pnpm lint` for linting,
`pnpm typecheck:api` and `pnpm typecheck:e2e` for the applicable TypeScript
surfaces, and `pnpm build` for the production build. These checks do not start
the application and do not replace browser or API verification.

### Isolated Firebase Emulator and Playwright tests

The authentication E2E wrapper starts the Firebase Authentication Emulator on
`127.0.0.1:9099`, uses the hard-coded `demo-dopamine-dungeon` project, starts
Vite in explicit test mode on `127.0.0.1:4173`, and tears the emulator down.
Do not run the auth Playwright specs with a plain `playwright test` command.
Install the pinned Chromium build once with:

```sh
pnpm exec playwright install chromium
```

Firebase Local Emulator Suite requires Java 11 or newer.

This environment is intentionally isolated from the full development stack.
The browser and Firebase Admin SDK must both use the Auth emulator in explicit
test mode. The runner must fail closed rather than fall back to development,
preview, or production Firebase, and these tests must not create Neon records.

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

```Commands run:
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
