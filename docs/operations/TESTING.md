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
| Development server | pnpm dev | Manual UI testing |
| Lint | pnpm lint | Every code change, if configured |
| Type checking | pnpm typecheck:api | Every code change, if configured |
| Production build | pnpm build | Every code change |

Commands that do not exist in package.json must not be claimed as available.

## Minimum validation

Every coding task must:

1. inspect the relevant existing tests;
2. run the relevant test suite where available;
3. run linting where configured;
4. run type checking where configured;
5. run the production build;
6. perform manual verification;
7. inspect the final diff.

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