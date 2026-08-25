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

## Authentication transactional email

Email verification and password recovery both use Firebase Admin to generate
Firebase-managed action links, Dopamine Dungeon HTML templates, and the existing
Firebase Trigger Email `mail` collection. Firebase still owns each one-time
code, expiry, validation, and account action. The application does not create or
persist custom verification or reset tokens.

Configure these server-only variables separately for each environment:

```text
AUTH_EMAIL_FROM=no-reply@dopamine-dungeon.com
AUTH_EMAIL_FROM_NAME=Dopamine Dungeon
AUTH_EMAIL_REPLY_TO=dopamine.dungeon.info@gmail.com
AUTH_EMAIL_REPLY_TO_NAME=Dopamine Dungeon
PASSWORD_RECOVERY_FINGERPRINT_SECRET=<high-entropy-server-only-secret>
APP_ORIGIN=https://<application-origin>
```

The `AUTH_EMAIL_*` variables are shared only by authentication messages.
Invitation messages retain their separate `INVITE_EMAIL_*` sender configuration.
Do not use the old verification-specific sender variables, and do not fall back
from authentication mail to invitation sender values.

`PASSWORD_RECOVERY_FINGERPRINT_SECRET` is required by the unauthenticated
recovery endpoint to HMAC normalized email addresses used as cooldown document
IDs. Use a high-entropy value unique to the environment. There is intentionally
no plain SHA-256 or hard-coded fallback because email-address hashes are
dictionary-guessable. Rotating the secret invalidates existing cooldown keys
but does not affect Firebase users, reset actions, or DD application data.
Accepted recovery outcomes also share a short minimum response window to reduce
practical timing differences; the server still performs extra Firebase and mail
work only for eligible verified password accounts.

`APP_ORIGIN` fixes the public origin used for the app-owned verification and
password-reset routes; when omitted, the API derives the origin from its own
request host. Keep development, Preview, and production origins aligned with
their corresponding Firebase projects. The origin must be present in Firebase
Authentication authorized domains when required by that project.

The Firebase Trigger Email extension and its SMTP provider must permit the
exact sender `Dopamine Dungeon <no-reply@dopamine-dungeon.com>`.
`dopamine-dungeon.com` must be verified with that email transport. Required DNS
authentication, including SPF and DKIM, is configured outside this repository.
Setting `AUTH_EMAIL_FROM` in application code does not prove that production
delivery is authorized.

Do not change live Firebase, Trigger Email, SMTP, DNS, or production environment
configuration without explicit authorization. None of these variables may use
the `VITE_` prefix when they contain secrets.

The Auth emulator exposes generated password-reset codes directly to the
guarded Playwright test runner, so local automated tests do not require Firebase
Console changes or real email delivery.

## Rules

- Use development values locally.
- Never commit .env files.
- Never expose production secrets to coding agents.
- Never print secret values in logs, issues, pull requests, or documentation.
- Verify the active environment before running migrations.
