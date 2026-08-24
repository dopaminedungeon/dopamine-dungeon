# ADR 0004: Firebase Identity and Email Verification

Status: Proposed

Date: 2026-08-24

Decision owner: Magda

Audit classification: Proposed for Iteration 3/#256; not current behavior on
`dev`

## Scope

This proposal records the security direction for the Iteration 3
authentication feature work associated with #256. The #256 implementation is
not merged into `dev`; this ADR must not be read as proof that branded
verification pages, verification mail, Neon verification timestamps, or
invitation continuation currently exist.

## Current identity boundary

- Firebase Authentication remains the credential, session, provider, and
  email-ownership authority.
- Firebase UID is the canonical cross-system identity. Email must not merge or
  transfer profiles, memberships, workspaces, campaigns, roles, or content.
- Protected APIs validate Firebase ID tokens and server-side memberships.
- Authentication, onboarding, invitation administration, and persistence
  migration remain separate responsibilities.

## Proposed Iteration 3 direction

When #256 is re-evaluated, the implementation should use Firebase-generated
verification action codes, retain Firebase as the ownership authority, and
keep any DD result page or mail wrapper from becoming a second token system.
The action link must not act as a login credential. Invitation details and
membership assignment must remain behind verified authentication and
server-side UID validation.

Any future Neon `email_verified_at` reconciliation must be additive,
server-authenticated, idempotent, and separately migrated. It is not part of
the current #317 state.

## Required validation before acceptance

- Verify the real development or Preview inbox/action-link flow; emulator
  results alone cannot prove hosted domains, delivery, or provider settings.
- Cover same-email/different-UID isolation, concurrent first access, retry,
  invitation privacy, and verified-token enforcement.
- Document environment and sender configuration only after the implementation
  and provider setup are approved for Iteration 3.
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
