# v0.6 Google-only verification migration

## Status and scope

This runbook governs the one-time #256 migration for existing Dopamine Dungeon
accounts whose complete Firebase provider set is exactly `google.com`. It is a
trusted operator procedure, not an application endpoint. Code or a successful
build does **not** authorize execution against Development, Preview, or
Production.

Firebase remains the live credential and current verification authority. Neon
`users.email_verified_at` is a UID-keyed historical reconciliation timestamp;
it is never a second live verification flag.

## Prerequisites

- Explicit written approval for the named environment.
- A process-scoped environment injection method; do not export credentials or
  create environment files.
- Non-secret expected target declarations for Firebase project, Neon host, and
  Neon database. The CLI compares them with runtime metadata and fails closed.
- Confirmation that `0014_brief_mac_gargan.sql` has already added the nullable
  `users.email_verified_at` column to the selected Neon target.
- An external operator-controlled directory for manifests and reports. Do not
  put these files in the repository or commit them.

The current environment document records that Feature Preview may share
Development Firebase/Neon resources. That topology must be explicitly resolved
before any Preview execution is considered isolated.

## Eligibility

Each Firebase Admin account is inspected by its Firebase UID. It is eligible
only when all of the following are true:

1. It is enabled.
2. It has a non-empty account email.
3. Its complete provider set is exactly `google.com`.
4. Neon has exactly one existing `users.firebase_uid` row for that UID.

Disabled users, missing UID/email, extra/missing providers, password providers,
and missing, duplicate, malformed, or changed Neon mappings are skipped and
reported. Email is never a Neon lookup, join, identity fallback, or merge key.

## Dry run

Run only with `--dry-run`. It makes no Firebase or Neon mutation. A dry run may
write a mode-0600 frozen manifest outside the repository:

```text
pnpm exec tsx scripts/migrate-google-only-verification.ts \
  --dry-run \
  --target <development|preview|production> \
  --firebase-project <expected-project-id> \
  --neon-host <expected-neon-host> \
  --neon-database <expected-database> \
  --manifest-out <external-absolute-path>
```

The manifest contains only target metadata, Firebase UIDs, Neon user IDs,
provider/verification/timestamp preconditions, and an email continuity digest.
It contains no raw email, credential, token, password, membership, or campaign
content.

Review the report before any apply. Expected categories are: eligible,
completed, partial, failed, skipped, Firebase updated, and Neon timestamp
updated. Review every skipped, failed, and partial UID before proceeding.

## Apply

Apply requires the frozen manifest, a re-proven target, and the explicit guard:

```text
pnpm exec tsx scripts/migrate-google-only-verification.ts \
  --apply \
  --target <development|preview|production> \
  --firebase-project <expected-project-id> \
  --neon-host <expected-neon-host> \
  --neon-database <expected-database> \
  --manifest <external-absolute-path> \
  --confirm-apply APPLY_GOOGLE_ONLY_VERIFICATION_V06
```

Production additionally requires:

```text
--confirm-production MIGRATE_PRODUCTION_GOOGLE_ONLY_VERIFICATION_V06
```

Production execution requires separate explicit approval after a reviewed,
target-proven Production dry run. It is never implied by merging code, testing
Preview, or completing Development validation.

For every manifest UID, the apply re-reads Firebase Admin and Neon before each
mutation. It may:

1. call Firebase Admin `updateUser(uid, { emailVerified: true })` only when the
   revalidated account is currently unverified;
2. re-read Firebase and require unchanged UID, email continuity, enabled state,
   exact Google-only provider state, and `emailVerified === true`;
3. update `users.email_verified_at` only for that UID and only when the column
   remains null; and
4. re-read Neon to report the resulting timestamp state.

No verification email is sent. No password, provider, Firebase UID/email/display
name, DD user ID, membership, role, mode, preference, invitation, workspace,
campaign, or content may change.

## Idempotency and forward repair

- Firebase verified + Neon null: only the timestamp is written.
- Firebase verified + Neon timestamp present: no-op.
- Firebase unverified + Neon timestamp present: only Firebase verification is
  updated.
- Firebase success + Neon failure: report `partial`, retain the manifest, and
  perform a separately approved retry. A retry can fill only the still-null
  timestamp after all guards pass again.
- Firebase update failure: Neon is not written.
- Existing timestamps are never moved or overwritten.

Do not revert an account from verified to unverified as a rollback action.
Stop further application and use a forward fix for failed or partial UIDs.

## Required manual verification

After an approved Development or Preview run, verify a deliberately selected
account has the same Firebase UID and Neon user ID, the same email and Google
provider, Firebase `emailVerified === true`, and the expected timestamp rule.
Confirm it receives no verification email, remains in the application after a
refresh, and can later add a password through Profile Settings without entering
verification pending. Also confirm a newly registered email/password account
still requires ordinary Firebase verification.

The Firebase Auth Emulator cannot model the successful Google-only-to-password
link transition in this repository. It is not evidence for hosted Firebase
provider behavior; obtain Development/Preview evidence before Production.
