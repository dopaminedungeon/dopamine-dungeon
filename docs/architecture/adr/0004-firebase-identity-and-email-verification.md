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
