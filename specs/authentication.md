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

## Sign-Out And Protection

1. Sign in a verified generated user.
2. Sign out through the application UI.
3. Navigate directly to a protected URL and confirm the authentication screen is
   shown without protected campaign content.
