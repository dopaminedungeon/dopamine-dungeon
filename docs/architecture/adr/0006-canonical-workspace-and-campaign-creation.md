# ADR 0006: Canonical Workspace and Campaign Creation

Status: Accepted

Date: 2026-08-24

Decision owner: Magda

Audit classification: Current in repository (2026-09-05); implemented by PR #365

## Context

At the time of the decision, workspace and campaign bootstrap had Firestore paths while
`/api/me` and core authorization relationships are Neon-backed. A Firestore
write can therefore succeed while the application reads no workspace or
campaign from Neon. Issue #296 records the onboarding loop; #262 and #263 own
related onboarding experiences.

Same-email/different-UID records make an email-based bridge unsafe.

## Decision

Firebase Authentication remains authoritative only for authentication and
verified identity. Firebase UID is the canonical external identity key.
Neon/PostgreSQL is canonical for all Dopamine Dungeon application data.

Browser application code must not directly create canonical application records
in Firestore. Workspace creation occurs through an authenticated server API;
workspace creation and owner-membership creation are one atomic, idempotent
Neon operation. Campaign creation follows the same pattern: an authenticated
server API creates the campaign and initial GM membership as one atomic,
idempotent Neon operation.

Subsequent workspace and campaign resolution reads those same Neon records.
Authorization is performed server-side from the authenticated Firebase UID,
the resolved Neon user, workspace/campaign membership, and GM/Player visibility
rules. The server API is the data access boundary; this decision does not adopt
direct browser access to PostgreSQL or PostgreSQL RLS.

Existing Firestore bootstrap records are migration input, not an identity
bridge. Records must be reconciled using Firebase UID where identity mapping is
needed. Email-based linking, merging, or reassignment is prohibited.

## Context for #296

This resolves the architectural decision behind [#296](https://github.com/dopaminedungeon/dopamine-dungeon/issues/296): a Firestore bootstrap write may
otherwise succeed while `/api/me` reads no corresponding Neon workspace or
campaign. The implementation must eliminate that split path rather than mask
it with cross-store reads.

## Consequences

### Positive

- Workspace and campaign creation have one canonical persistence and read path.
- Owner and initial GM membership can be created atomically with their parent.
- Retry behavior can be idempotent without duplicate memberships or campaigns.
- Server-side authorization preserves tenant, campaign, and GM/Player
  visibility boundaries.

### Constraints

- Historical Firestore inputs remain until #298 migration gates and reconciliation
  are complete; this ADR does not authorize destructive data retirement.
- Creation APIs require explicit authorization, transaction, idempotency, and
  parity tests before replacing browser writes.
- No implementation may bridge records by normalized email.

## Required validation and rollback

`src/server/api-handlers/workspace-create.ts` and `campaign-create.ts` implement
the transaction and caller-scoped idempotency rules. Their adjacent tests cover
retry, membership insertion failure, and unauthorized/cross-workspace creation.
The browser uses those APIs and refreshes the same Neon-backed access projection.
Historical source data and operational configuration remain governed by #298's
release gates, not by the completed browser implementation.

Preview QA must cover success, retry, timeout, invited/uninvited routing, and
same-email/different-UID isolation. Any implementation requires the #298
inventory, environment export, backup/recovery plan, dry run, validation
queries, explicit environment targeting, and a rollback or forward-fix
strategy.

## Related records

- Issues [#296](https://github.com/dopaminedungeon/dopamine-dungeon/issues/296),
  [#262](https://github.com/dopaminedungeon/dopamine-dungeon/issues/262), and
  [#263](https://github.com/dopaminedungeon/dopamine-dungeon/issues/263), and
  [#298](https://github.com/dopaminedungeon/dopamine-dungeon/issues/298)
- [ADR 0001](0001-neon-as-primary-database.md)
- [ADR 0003](0003-transitional-firestore-postgres-persistence.md)
- [Firestore to Neon migration inventory](../FIRESTORE_TO_NEON_MIGRATION.md)
- [System Overview](../SYSTEM_OVERVIEW.md)
