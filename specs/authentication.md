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

## Optional Provider Linking

Profile Settings offers optional provider linking without gating bootstrap,
workspace access, campaign access, invitations, or GM/Player mode selection.
Provider detection uses the complete Firebase `providerData` list:

- Google-only verified users may add Email / Password.
- Email / Password verified users may connect Google.
- Users with both providers are shown both connected methods and are not asked
  to link again.

For password-first Google linking, the application calls Firebase provider
linking on the currently authenticated Firebase user and verifies the same
Firebase UID plus exact Neon user ID before showing completion. The flow never
looks up, provisions, merges, or mutates a Dopamine Dungeon user by matching an
email address.

Firebase's web account-linking documentation states that linked provider
credentials keep the same Firebase user ID, and that linking fails when the
credential is already attached to another account. Its Google sign-in
documentation states that Gmail and Google Workspace addresses are treated as
authoritative Google-hosted emails, while non-Gmail addresses attached to Google
accounts can produce `auth/account-exists-with-different-credential` depending
on the project sign-in method and account settings. Dopamine Dungeon handles
that conflict by keeping the pending Google credential in component memory only
for the immediate recovery flow, requiring password reauthentication on the
current Firebase user, and then linking the pending credential to that same
user. Credentials are not placed in URLs, persistent storage, logs, analytics,
or telemetry.

The Auth Emulator can exercise local password accounts, popup provider linking,
provider-list UI, exact-UID preservation, and continuity API calls. It cannot
prove native Google-hosted versus non-Gmail Google-account behavior with the
same fidelity as production Firebase and real Google accounts. Mocked unit
coverage owns popup cancellation, the
`auth/account-exists-with-different-credential` recovery state, and collision
classifications. Native Preview QA remains required when a suitable disposable
Google account is available.
