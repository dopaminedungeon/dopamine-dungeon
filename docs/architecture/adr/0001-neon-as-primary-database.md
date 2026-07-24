# ADR 0001: Use Neon PostgreSQL as the Primary Application Database

Status: Accepted

Date: 2026-04

Decision owner: Magda

## Context

Dopamine Dungeon originally used Firebase services for application data.

As the application evolved into a multi-user and multi-campaign product, the

domain became increasingly relational.

The application requires relationships between:

- users;

- workspaces;

- campaigns;

- workspace memberships;

- campaign memberships;

- sessions;

- items;

- NPCs;

- locations;

- lore;

- quests;

- related campaign entities.

The product also requires reliable joins, constraints, reporting, migration

history, and transactional behaviour.

Continuing to model increasingly relational information primarily in Firestore

would require significant denormalisation and duplicated state.

## Decision

Use Neon PostgreSQL as the primary application database.

Use Drizzle ORM for:

- schema definitions;

- typed database access;

- migrations;

- repository implementation.

Firebase remains responsible for authentication unless superseded by a later

ADR.

The application backend maps Firebase-authenticated identities to relational

application users and memberships.

## Alternatives considered

### Continue using Firestore as the primary database

Rejected because:

- the domain is increasingly relational;

- cross-entity queries would require denormalisation;

- membership and authorization relationships are easier to model relationally;

- duplicated state creates synchronization risks;

- reporting and transactional operations would become more difficult.

### Use a different hosted PostgreSQL provider

A different managed PostgreSQL provider could meet the technical requirements.

Neon was selected because it provided an appropriate hosted PostgreSQL

environment for the project and aligned with the existing deployment model.

Changing provider would create operational work without a current product

benefit.

### Self-host PostgreSQL

Rejected for the current stage because it would introduce unnecessary

infrastructure, backup, patching, and availability responsibilities.

## Consequences

### Positive

- relational constraints;

- explicit joins;

- typed schema access;

- migration history;

- transactional operations;

- better support for reporting and cross-linked campaign data;

- clearer modelling of workspace and campaign memberships.

### Negative

- additional backend complexity;

- database migrations must be managed carefully;

- authentication identity and relational users must remain synchronized;

- development and production databases must be separated;

- application authorization must be implemented explicitly.

### Risks

- accidental production migrations;

- incomplete tenant scoping;

- inconsistent transaction handling;

- schema and application code drifting apart;

- secrets being used in the wrong environment.

## Implementation notes

- Firebase Authentication establishes identity.

- Neon stores application and campaign data.

- Drizzle defines and accesses the relational schema.

- Production database credentials must never be used for routine development.

- Every campaign-owned query must enforce campaign and membership boundaries.

- Migration changes require validation and rollback or mitigation notes.

## Revisit when

- Neon no longer meets availability, pricing, or operational requirements;

- the application requires a materially different database architecture;

- authentication and data ownership are redesigned together;

- a verified product requirement changes the relational trade-off.