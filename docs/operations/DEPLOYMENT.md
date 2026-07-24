# Deployment

Last updated: 2026-07-24

Owner: Magda

## Hosting

Dopamine Dungeon is deployed through Vercel.

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