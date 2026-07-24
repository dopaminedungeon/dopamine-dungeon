# Dopamine Dungeon Roadmap

Last updated: 2026-07-24
Owner: Magda

## Product direction

Dopamine Dungeon is evolving from a campaign-specific management tool into a
multi-campaign platform for game masters and players.

The current priority is completing reliable, persistent campaign foundations
before expanding into advanced relationship, timeline, automation, and
AI-assisted systems.

## Current stage

The product currently supports core campaign-management foundations including:

- authentication;
- workspaces and campaigns;
- memberships and invitations;
- sessions;
- items and inventory;
- selected campaign entities;
- GM and player modes;
- development and production environments.

Some modules remain incomplete, transitional, or partially implemented.
`CURRENT_STATE.md` is the authoritative operational snapshot.

## Near-term priorities

### 1. Complete persistent campaign entities

Focus areas:

- NPCs;
- Lore;
- Locations;
- consistent persistence;
- visibility enforcement;
- timestamps;
- loading and error states;
- consistent create and edit flows.

Expected outcome:

Core campaign records behave as reliable first-class entities rather than
isolated or mocked screens.

### 2. Improve cross-linking and navigation

Focus areas:

- links between sessions, NPCs, locations, lore, quests, and items;
- consistent entity references;
- navigation between related records;
- reduced duplication.

Expected outcome:

Campaign information becomes an interconnected knowledge system.

### 3. Relationship foundations

Potential scope:

- relationship scores;
- relationship direction;
- NPC-to-party and NPC-to-character relationships;
- relationship history;
- faction relationships;
- GM-controlled visibility.

This work must not begin until the underlying NPC and persistence foundations
are reliable.

### 4. Product consistency and quality

Focus areas:

- shared interaction patterns;
- responsive behaviour;
- accessible controls;
- predictable empty states;
- sorting and filtering;
- test coverage;
- error handling;
- rollback safety.

## Medium-term opportunities

These are directional opportunities, not committed scope:

- campaign timeline;
- advanced search;
- relationship visualisation;
- faction systems;
- encounter preparation;
- quest and clue tracking;
- session recap tooling;
- structured campaign onboarding;
- import and export;
- audit history;
- improved player-facing views.

## Long-term opportunities

These remain exploratory:

- AI-assisted lore retrieval;
- campaign consistency checks;
- session preparation assistance;
- automatic recap generation;
- contradiction detection;
- recommendation systems;
- integrations with external tabletop tools;
- public or commercial onboarding.

## Explicit non-goals for the current stage

- autonomous production changes;
- replacing the game master's creative judgment;
- enforcing one campaign methodology;
- premature enterprise infrastructure;
- large-scale AI features before core data is reliable;
- rebuilding stable systems without a verified user need.

## Prioritisation criteria

Work should be prioritised based on:

1. user value during real campaign use;
2. reliability and data integrity;
3. dependencies unlocked for future features;
4. implementation effort;
5. architectural risk;
6. frequency of the problem;
7. reversibility.

## Roadmap governance

- GitHub issues describe individual work items.
- Milestones or iterations describe committed delivery scope.
- This roadmap describes direction rather than guaranteed dates.
- `CURRENT_STATE.md` records what actually exists.
- ADRs record major technical decisions.