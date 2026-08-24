# Iteration 3 Retrospective Preparation

Status: Preparation, not a completed retrospective

Updated: 2026-08-24

Authentication feature work, including the remaining #256 email-verification
scope, remains assigned to Iteration 3. These notes are preparation evidence,
not a claim that the #256 branch is merged or that its hosted behavior is
current on `dev`.

## Evidence to retain

- #255 demonstrated that authentication success and identity provisioning are
  separate operations. Concurrent `/api/me` and invitation acceptance exposed
  a Neon insert race that local UI checks did not reveal.
- Deleting and recreating a Firebase account can produce the same email with a
  different UID. UID-keyed lookup prevents accidental inheritance of the old
  profile, memberships, campaigns, roles, or player/GM data.
- The Auth Emulator provides deterministic action-code coverage but cannot
  certify hosted domains, Trigger Email configuration, real delivery, or Neon
  behavior.
- Preview QA and the #296 onboarding loop show that hosted runtime behavior and
  cross-store persistence need explicit validation.
- Passing mocked browser tests can still miss browser preferences, hosted
  runtime behavior, and cross-store failures.
- Iteration 2 corrected the stale Firestore-only architecture and obsolete
  iteration record; future docs must preserve that current-state boundary.

## Process improvements to evaluate

1. Add a Preview QA checklist naming the store read and written by each tested
   operation.
2. Require a real development inbox and a documented configuration owner for
   transactional-email features before accepting #256 scope.
3. Include same-email/different-UID, concurrent first access, and retry cases in
   every identity-lifecycle change.
4. Require emulator tests plus integration tests for Firebase-to-Neon
   reconciliation paths.
5. Treat project-board assignment, current-state docs, and ADR status as one
   release-close checklist.
6. Keep authentication, onboarding, invitation management, and persistence
   migration in separate issues even when one user journey crosses all four.

## Open decisions

- Which Neon API becomes canonical for workspace and campaign creation? See
  ADR 0006 and #296.
- Should transactional mail remain on Firebase Trigger Email after #256, or is
  a separately reviewed provider decision needed?
- What hosted smoke suite can cover Vercel functions and a development Neon
  branch without production data?
