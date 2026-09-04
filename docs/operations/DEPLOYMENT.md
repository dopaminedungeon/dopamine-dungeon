# Deployment

Last updated: 2026-07-24

Owner: Magda

## Hosting

Dopamine Dungeon is deployed through Vercel.

Repository branch, CI gate, release-branch, and hotfix policy is maintained in
[`REPOSITORY_POLICY.md`](./REPOSITORY_POLICY.md).

## Branch responsibilities

### Feature branches

- created from `dev`;

- used for isolated implementation;

- may receive Vercel preview deployments;

- must not be treated as production.

### `dev`

- integration branch;

- target for normal feature pull requests;

- used to validate the next release;

- must remain testable.

### `main`

- production branch;

- source of the production deployment;

- receives only reviewed and release-ready changes.

## Environment separation

Development and production must use separate resources where configured,

including:

- environment variables;

- Firebase projects or credentials;

- Neon databases or database branches;

- external integration credentials;

- email configuration.

Production secrets must not be copied into routine local or agent environments.

## Authentication email delivery

Before enabling branded verification or password-recovery email in an
environment, confirm all of the following:

- `AUTH_EMAIL_FROM=no-reply@dopamine-dungeon.com` and
  `AUTH_EMAIL_FROM_NAME=Dopamine Dungeon` are configured server-side;
- `AUTH_EMAIL_REPLY_TO=dopamine.dungeon.info@gmail.com` and
  `AUTH_EMAIL_REPLY_TO_NAME=Dopamine Dungeon` preserve a monitored reply path;
- `PASSWORD_RECOVERY_FINGERPRINT_SECRET` is configured with a high-entropy,
  environment-specific server-only value and is not exposed with a `VITE_`
  prefix;
- the documented `AUTH_EMAIL_*` rolling limits are configured or intentionally
  use their reviewed defaults;
- Firestore TTL policies for all three authentication-email limiter collection
  groups are active with the configured retention offset;
- Vercel supplies `x-vercel-forwarded-for` directly to the recovery function;
- the sanitized recovery-request alert is configured at 50 requests per hour;
- the Firebase Trigger Email extension and SMTP provider accept
  `Dopamine Dungeon <no-reply@dopamine-dungeon.com>`;
- `dopamine-dungeon.com` is verified with the configured transport;
- required SPF and DKIM DNS records are valid;
- `APP_ORIGIN` points to the matching deployed application and its Firebase
  authorized-domain configuration is correct;
- invitation delivery still uses the independent `INVITE_EMAIL_*` settings.

Use [`AUTH_EMAIL_RATE_LIMITING.md`](./AUTH_EMAIL_RATE_LIMITING.md) for the exact
TTL, monitoring, threshold-review, secret-rotation, and rollback checks. A Ready
deployment does not prove those external controls are active.

Repository code and environment variable names do not prove sender
authorization or successful production delivery. DNS, SMTP, Trigger Email, and
live production configuration changes require explicit authorization and must
be verified outside the repository.

## Feature deployment workflow

1. Create a branch from `dev`.

2. Implement the bounded issue.

3. Run required checks.

4. Open a draft pull request against `dev`.

5. Review the diff and validation evidence.

6. Test the Vercel preview where available.

7. Mark the pull request ready only after validation.

8. Merge into `dev` after approval.

9. Verify the integrated development deployment.

## Production release workflow

1. Confirm the intended release scope.

2. Confirm required issues and pull requests are complete.

3. Verify `dev` build and application behaviour.

4. Review database and environment impacts.

5. Confirm rollback readiness.

6. Promote the reviewed release from `dev` to `main`.

7. Monitor the Vercel production deployment.

8. Perform production smoke testing.

9. Record the released version and significant changes.

10. Update `CURRENT_STATE.md` where needed.

## Production smoke test

At minimum verify:

- application loads;

- authentication works;

- campaign selection works;

- one core read workflow;

- one core write workflow;

- no obvious console or network errors;

- the expected version is deployed.

Select non-destructive records for production verification.

## Database migrations

A release containing a migration must document:

- migration order;

- whether application code is backward-compatible;

- whether the migration is destructive;

- expected runtime;

- verification query or behaviour;

- rollback or forward-fix strategy.

Do not apply destructive production migrations automatically.

### Email verification migration

`0014_brief_mac_gargan.sql` adds the nullable `users.email_verified_at`
timestamp. It is additive and preserves existing users, memberships, campaigns,
roles, modes, preferences, and profile data.

Apply this migration to the target Neon environment before deploying code that
reconciles verified Firebase users. Verify by authenticating a Firebase-verified
development user and confirming `/api/me` returns successfully and the matching
Firebase UID row receives one timestamp. Repeated requests must preserve that
original timestamp.

Rollback is not normally required because the nullable column is backward
compatible. Prefer a forward fix. Drop the column only after reverting all code
that reads or writes `email_verified_at`; never delete or reassign user rows.

### v0.6 Google-only verification migration

The v0.6 Google-only verification migration is an operator-only Firebase Admin
and Neon reconciliation operation. It is not a deployment side effect and must
not run from a browser, an API route, or a routine application startup.

Use the runbook in
[`GOOGLE_ONLY_VERIFICATION_MIGRATION.md`](./GOOGLE_ONLY_VERIFICATION_MIGRATION.md).
The required sequence is:

1. Prove the Firebase project, Neon host, and database target using non-secret
   runtime metadata.
2. Confirm `0014_brief_mac_gargan.sql` is present on that Neon target.
3. Run a dry run and review the sanitized UID-scoped report.
4. Freeze the reviewed manifest outside the repository.
5. Obtain explicit environment-specific approval.
6. Run the guarded apply with that manifest; Production requires an additional
   explicit Production confirmation.
7. Capture the post-run report and perform the manual verification steps.

The operation may only update Firebase `emailVerified` and a null
`users.email_verified_at` timestamp for revalidated, exact Google-only
Firebase/Neon UID pairs. It must not send verification mail or modify
credentials, providers, DD users, memberships, roles, preferences, invitations,
campaigns, workspaces, or content. Firebase-success/Neon-failure is a recorded
partial completion; preserve the manifest and use a separately approved forward
retry rather than reverting verified users.

Feature Preview currently has a documented Development-resource topology in
`ENVIRONMENT.md`. Resolve that operational decision and prove the actual target
before treating a Development or Preview migration run as isolated.

## Agent restrictions

Coding agents may:

- inspect deployment documentation;

- create implementation branches;

- run development checks;

- prepare draft pull requests.

Coding agents must not:

- deploy production;

- merge into `main`;

- use production secrets;

- apply production migrations;

- modify Vercel production configuration;

- claim a deployment succeeded without verification.

## Failed deployment

When a deployment fails:

1. do not repeatedly redeploy without identifying the cause;

2. inspect build and runtime logs;

3. determine whether the failure is code, configuration, dependency, or service-related;

4. decide whether to fix forward or roll back;

5. document the result.
