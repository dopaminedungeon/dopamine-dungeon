# Email And Password Authentication Test Plan

**Seed:** `e2e/seed.spec.ts`

## Registration And Verification

1. Register a generated email/password user through the browser.
2. Confirm protected application content remains unavailable before verification.
3. Confirm the server rejects the unverified emulator token.
4. Retrieve and apply the verification code from the Auth emulator.
5. Confirm the verified user reaches the protected application and the server
   accepts the refreshed token.

## Sign-In Errors

1. Sign in a verified generated user and confirm normal protected routing.
2. Confirm the authenticated identity remains available in both GM and player mode.
3. Submit incorrect credentials and confirm the generic message does not reveal
   whether the email exists.

## Password Recovery

1. Open password recovery from email/password sign-in and reject malformed
   email addresses locally.
2. Submit existing and nonexistent addresses and confirm both receive the same
   status, response shape, and non-identifying confirmation state.
3. Confirm a verified password user queues the branded Trigger Email template,
   while disabled, provider-only, unverified, and nonexistent accounts remain
   indistinguishable and do not receive a reset action.
4. Verify a Firebase password-reset code and keep all DD workspace and campaign
   providers out of the recovery route.
5. Enforce the shared Firebase password policy and matching confirmation before
   calling `confirmPasswordReset`.
6. Confirm invalid, expired, malformed, and already-used codes lead to a
   recoverable request-another-reset action.
7. Confirm a successful reset does not sign the browser in automatically, the
   old password stops working, the new password works, and the Firebase UID is
   unchanged.
8. Confirm an unverified Firebase account remains unverified and receives no
   password-reset action, preventing reset completion from bypassing verification.
9. Confirm service failures remain retryable without revealing account or
   provider existence.

## Sign-Out And Protection

1. Sign in a verified generated user.
2. Sign out through the application UI.
3. Navigate directly to a protected URL and confirm the authentication screen is
   shown without protected campaign content.
