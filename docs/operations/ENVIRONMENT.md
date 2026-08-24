# Environment Configuration

Last verified: 2026-08-24

## Purpose

This document lists required environment variable names.

Never place actual secret values in this file.

## Client-side Firebase variables

These are used by the Vite frontend:

```VITE_FIREBASE_API_KEY```
```VITE_FIREBASE_AUTH_DOMAIN```
```VITE_FIREBASE_PROJECT_ID```
```VITE_FIREBASE_STORAGE_BUCKET```
```VITE_FIREBASE_MESSAGING_SENDER_ID```
```VITE_FIREBASE_APP_ID```

These are environment-specific client identifiers, not authorization. The
active Firebase project must match the target environment.

## Server-side Firebase Admin variables

These are used by API routes and server-side authentication:

```FIREBASE_PROJECT_ID```
```FIREBASE_CLIENT_EMAIL```
```FIREBASE_PRIVATE_KEY```

## Database variables

```DATABASE_URL```

Some local migration commands may use: 

```NEON_DATABASE_URL```

Verify the exact variable used by the repository before changing configuration.

## Isolated authentication test variables

The Playwright wrapper sets these values. Do not put them into normal
development, Preview, or production configuration:

```text
NODE_ENV=test
DD_AUTH_TEST_MODE=true
VITE_AUTH_TEST_MODE=true
FIREBASE_PROJECT_ID=demo-dopamine-dungeon
GCLOUD_PROJECT=demo-dopamine-dungeon
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

The test environment fails closed unless the exact demo project, fixed emulator
hosts, test mode, and absence of Vercel environment state agree. It must not
create Neon records.

## Environment boundaries

| Environment | Firebase | Neon | Runtime |
|---|---|---|---|
| Auth E2E | Local demo Auth emulator | No access | Vite test server with intercepted API fixtures |
| Local full stack | Development project | Development database | `pnpm vercel dev` |
| Feature Preview | Development resources configured for Preview | Development database/branch | Protected non-production deployment |
| Production | Production project | Production database | `main` production deployment |

Email-verification sender variables, branded verification routes, and related
provider configuration are Iteration 3/#256 scope and are not current
configuration requirements for #317.

## Proposed #256 transactional email variables

Verification email is queued through the existing Firebase Trigger Email
extension and its `mail` collection. Configure the extension separately for
each Firebase environment when #256 is deployed. The proposed implementation
accepts these optional server-only sender overrides:

```VERIFICATION_EMAIL_FROM```
```VERIFICATION_EMAIL_FROM_NAME```
```VERIFICATION_EMAIL_REPLY_TO```
```VERIFICATION_EMAIL_REPLY_TO_NAME```
```APP_ORIGIN```

`VERIFICATION_EMAIL_FROM` must be a sender accepted by the configured mail
transport. `APP_ORIGIN` fixes the public application origin used in verification
links; when omitted, the API derives the origin from its own request host.
When verification-specific sender variables are omitted, the existing
`INVITE_EMAIL_*` sender configuration is reused.
None of these variables may use the `VITE_` prefix when they contain secrets.

## Rules

- Use development values locally.
- Never commit .env files.
- Never expose production secrets to coding agents.
- Never print secret values in logs, issues, pull requests, or documentation.
- Verify the active environment before running migrations.
