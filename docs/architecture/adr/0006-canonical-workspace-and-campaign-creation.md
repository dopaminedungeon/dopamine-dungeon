# ADR 0006: Canonical Workspace and Campaign Creation

Status: Proposed

Date: 2026-08-24

Decision owner: Magda

Audit classification: Proposed; current code has split write and read paths

## Context

Workspace and campaign bootstrap still has transitional Firestore paths while
`/api/me` and core authorization relationships are Neon-backed. A Firestore
write can therefore succeed while the application reads no workspace or
campaign from Neon. Issue #296 records the onboarding loop; #262 and #263 own
related onboarding experiences.

Same-email/different-UID records make an email-based bridge unsafe.

## Decision required

Select one canonical write/read path for workspace and campaign creation. The
decision must provide:

- authenticated Firebase UID to Neon user mapping;
- atomic workspace plus owner membership creation;
- atomic campaign plus GM membership creation;
- idempotent retry semantics and immediate `/api/me` consistency;
- explicit workspace/campaign authorization and isolation;
- a reviewed plan for legacy Firestore bootstrap records.

No option is accepted by this ADR yet. Do not simulate a resolution by copying,
deleting, or reassigning existing records.

## Alternatives to evaluate

1. Authenticated Neon creation APIs with transactional membership writes.
2. A coordinated migration of existing Firestore bootstrap records before
   enabling the onboarding path.
3. Cross-store reads from `/api/me`, only if a later architecture decision
   explicitly accepts the synchronization and authorization cost.

Bridging records by email is rejected. Firebase UID remains the only identity
bridge, and server-side GM/Player and cross-campaign boundaries remain
mandatory.

## Required validation and rollback

Preview QA must cover success, retry, timeout, invited/uninvited routing, and
same-email/different-UID isolation. Any implementation requires an inventory,
backup/recovery plan, dry run, validation queries, explicit environment
targeting, and a rollback or forward-fix strategy.

## Related records

- Issues [#296](https://github.com/dopaminedungeon/dopamine-dungeon/issues/296),
  [#262](https://github.com/dopaminedungeon/dopamine-dungeon/issues/262), and
  [#263](https://github.com/dopaminedungeon/dopamine-dungeon/issues/263)
- [ADR 0001](0001-neon-as-primary-database.md)
- [ADR 0003](0003-transitional-firestore-postgres-persistence.md)
- [System Overview](../SYSTEM_OVERVIEW.md)
