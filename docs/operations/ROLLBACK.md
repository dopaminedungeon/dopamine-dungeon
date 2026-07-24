# Rollback and Recovery

Last updated: 2026-07-24
Owner: Magda

## Purpose

Every production-affecting change must have a credible recovery path.

Rollback planning should protect:

- availability;
- campaign data;
- tenant isolation;
- authentication;
- user trust.

## Preferred recovery order

Use the least disruptive safe option:

1. disable or isolate the affected feature where possible;
2. revert the responsible pull request or commit;
3. redeploy the last known-good application version;
4. apply a forward fix when rollback would create greater data risk;
5. restore data only when corruption or loss has occurred.

## Application rollback

For application-only changes:

1. identify the last known-good production commit;
2. confirm whether database or environment changes accompanied the release;
3. revert the responsible change or redeploy the known-good commit;
4. monitor the deployment;
5. perform production smoke testing;
6. record the incident and resolution.

A Vercel rollback does not reverse database changes.

## Database rollback

Database changes require special care.

Before reverting application code, determine:

- whether the schema changed;
- whether new data has already been written;
- whether older code can read the current schema;
- whether rollback would lose or misinterpret data.

Preferred database strategy:

- additive migrations;
- backward-compatible application changes;
- phased removal;
- forward fixes where destructive rollback is unsafe.

Never delete production data merely to restore compatibility without explicit
review and a verified backup.

## Environment rollback

For environment-variable or integration changes:

1. identify the exact changed value;
2. restore the previous verified configuration;
3. redeploy if required;
4. verify dependent services;
5. rotate credentials if exposure is suspected.

Do not record secret values in issues, pull requests, logs, or documentation.

## Feature-level rollback

Where practical, risky features should support:

- feature flags;
- disabled navigation;
- server-side rejection;
- reversible configuration;
- isolated rollout.

Feature flags are not a substitute for proper authorization or migration safety.

## Data recovery

If data loss or corruption is suspected:

1. stop further destructive writes where possible;
2. preserve logs and evidence;
3. identify affected tenants, campaigns, records, and time range;
4. verify available backups or provider recovery options;
5. test restoration outside production where possible;
6. restore only the affected scope;
7. verify referential and tenant integrity;
8. document the incident.

## Rollback information required in pull requests

Every pull request must state:

- whether it changes application code only;
- whether it changes schema or stored data;
- whether it changes environment configuration;
- whether reverting the code is sufficient;
- whether a forward fix would be safer;
- any manual recovery step required.

## Rollback decision

Prefer rollback when:

- the defect is severe;
- the responsible change is clear;
- rollback is data-safe;
- a fix cannot be verified quickly.

Prefer fixing forward when:

- data has already been migrated;
- older code is incompatible with the current schema;
- rollback would cause data loss;
- the correction is small and can be verified safely.

## Post-incident update

After a rollback or recovery:

- document the cause;
- update testing or deployment guidance;
- add missing safeguards;
- create an ADR if the incident reveals an architectural decision;
- update `AGENTS.md` if the agent workflow contributed.