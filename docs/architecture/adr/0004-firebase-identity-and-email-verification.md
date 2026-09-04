# ADR 0004: Firebase Identity and Email Verification

Status: Accepted

Date: 2026-08-24

Decision owner: Magda

Audit classification: Current for implemented #256 verification behavior;
future authentication changes remain subject to this identity boundary

## Scope

This ADR records the security boundary for the implemented authentication email
verification work associated with #256. The repository currently contains
Firebase-generated verification action links, verification mail delivery,
Firebase-authoritative verification checks, Neon verification timestamp
reconciliation, and invitation continuation. The implementation details remain
subject to the identity constraints below.

## Current identity boundary

- Firebase Authentication remains the credential, session, provider, and
  email-ownership authority.
- Firebase UID is the canonical cross-system identity. Email must not merge or
  transfer profiles, memberships, workspaces, campaigns, roles, or content.
- Protected APIs validate Firebase ID tokens and server-side memberships.
- Authentication, onboarding, invitation administration, and persistence
  migration remain separate responsibilities.

## Decision

Verification uses Firebase-generated action codes, retains Firebase as the
ownership authority, and keeps any DD result page or mail wrapper from becoming
a second token system.
The action link must not act as a login credential. Invitation details and
membership assignment must remain behind verified authentication and
server-side UID validation.

Neon `email_verified_at` reconciliation is additive, server-authenticated,
and idempotent. It records application history without replacing Firebase as
the current verification authority.

### v0.6 historical Google-only verification migration

The v0.6 release has one narrow exception to the general rule that a provider
name alone must not establish verification. A trusted, one-time, server-only
migration may treat an **existing enabled DD user** as verified only when all
of these conditions hold for the same Firebase UID:

- the Firebase account has a non-empty email;
- its complete provider set is exactly `google.com`;
- no password or other provider is linked; and
- exactly one existing Neon `users.firebase_uid` record resolves for that UID.

The operator tool must re-check those conditions at apply time, set Firebase
`emailVerified` only when it is false, then write `users.email_verified_at`
only when it is null. Existing non-null timestamps remain unchanged. The tool
must never select, merge, or repair an identity by email, and browser clients
cannot invoke or assert this migration state. Firebase remains the live
verification authority after the migration.

## Ongoing validation

- Verify the real development or Preview inbox/action-link flow; emulator
  results alone cannot prove hosted domains, delivery, or provider settings.
- Cover same-email/different-UID isolation, concurrent first access, retry,
  invitation privacy, and verified-token enforcement.
- Keep environment and sender configuration documented and review it when
  delivery infrastructure changes.
- Keep a rollback or forward-fix plan that preserves valid Firebase accounts
  and never merges identities by email.

## Related records

- Issues [#255](https://github.com/dopaminedungeon/dopamine-dungeon/issues/255),
  [#256](https://github.com/dopaminedungeon/dopamine-dungeon/issues/256),
  [#295](https://github.com/dopaminedungeon/dopamine-dungeon/issues/295), and
  [#296](https://github.com/dopaminedungeon/dopamine-dungeon/issues/296)
- [System Overview](../SYSTEM_OVERVIEW.md)
- [Environment](../../operations/ENVIRONMENT.md)
- [Iteration 3 preparation](../../sprints/iteration-3-retrospective-notes.md)
