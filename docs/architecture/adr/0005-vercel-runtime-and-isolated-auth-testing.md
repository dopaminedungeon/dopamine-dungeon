# ADR 0005: Vercel Runtime and Isolated Authentication Testing

Status: Accepted

Date: 2026-08-24

Decision owner: Magda

Audit classification: Current

## Decision

- Vercel is the application runtime. Feature branches may receive Preview
  deployments, `dev` is integration, and `main` is production under ADR 0002.
- `pnpm vercel dev` is the canonical local full-stack command. Vercel owns the
  single public local URL and routes `/api/*` to local functions.
- `pnpm dev` is frontend-only and cannot certify authentication, protected API,
  Neon persistence, or complete workflows.
- Playwright authentication tests run through the repository wrappers. The
  wrapper starts the Firebase Auth emulator with project
  `demo-dopamine-dungeon`, applies explicit test flags, starts the test server,
  and tears processes down.
- Emulator activation fails closed unless test mode, fixed emulator hosts, the
  demo project, and the absence of Vercel environment state agree.
- Isolated auth browser tests do not access Neon or real Firebase; application
  APIs are intercepted with deterministic fixtures. Full-stack local and
  Preview QA remain necessary for Vercel routing, server credentials, Neon,
  Firestore transitional paths, and provider settings.

## Consequences

- Full-stack manual verification exercises one application URL.
- Auth browser tests are repeatable and isolated from development and
  production data.
- Java and the pinned Playwright browser remain local prerequisites.
- Emulator E2E cannot validate Neon round trips or hosted email/provider
  configuration; those concerns belong to API tests and release/manual QA.

## Operational rules

- Run `pnpm test:e2e:smoke` or `pnpm test:e2e` through the package wrappers;
  do not invoke Playwright directly.
- Never point emulator tests at development, Preview, or production Firebase
  or Neon services.
- Use `pnpm vercel dev` for protected API, authentication, and persistence
  manual checks.

## Related records

- [ADR 0002](0002-dev-main-deployment-flow.md)
- [Testing](../../operations/TESTING.md)
- [Deployment](../../operations/DEPLOYMENT.md)
- [Environment](../../operations/ENVIRONMENT.md)
