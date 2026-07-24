# Dopamine Dungeon Product Principles

Last updated: 2026-07-24
Owner: Magda

## Purpose

Dopamine Dungeon exists to reduce the administrative burden of running
tabletop role-playing campaigns while preserving the creativity, flexibility,
and controlled chaos of the table.

The product should help game masters remember, connect, prepare, and retrieve
information without forcing them into a rigid campaign-management methodology.

## 1. The campaign belongs to the game master

Dopamine Dungeon supports the game master's process rather than prescribing one.

Features should:

- provide structure without forcing unnecessary structure;
- allow incomplete information;
- allow information to evolve over time;
- support both preparation and improvisation;
- avoid requiring excessive setup before the product becomes useful.

A feature that creates more administrative work than it removes must justify
that cost clearly.

## 2. Information should be connected, not duplicated

Campaign entities such as sessions, NPCs, locations, lore, items, quests, and
relationships should reference one another where appropriate.

Prefer:

- one authoritative record;
- reusable entity references;
- visible relationships between records;
- navigation between related information.

Avoid:

- copying the same information into multiple modules;
- separate implementations of the same concept;
- hidden synchronization requirements.

## 3. The game master controls visibility

The application must respect the distinction between information intended for
game masters and information visible to players.

Player-hidden information must not be exposed through:

- API responses;
- client state;
- direct URLs;
- cached responses;
- alternate views.

UI hiding alone is not authorization.

## 4. Campaigns and workspaces are isolated

Data belonging to one workspace or campaign must never appear in another.

Every persisted feature must consider:

- authenticated identity;
- workspace membership;
- campaign membership;
- role and visibility;
- server-side authorization.

Tenant isolation is a product requirement, not merely a technical preference.

## 5. The interface should support retrieval during play

During a session, the game master may need information immediately.

Prioritize:

- clear hierarchy;
- predictable navigation;
- fast search and filtering;
- readable layouts;
- meaningful empty states;
- mobile usability;
- low interaction cost.

Avoid interfaces that require several unnecessary clicks to retrieve commonly
used information.

## 6. Progressive complexity

A user should be able to use a simple version of a feature before configuring
its advanced behaviour.

Prefer:

- useful defaults;
- optional detail;
- gradual enrichment;
- advanced controls only when needed.

Avoid making the complete data model mandatory for basic use.

## 7. Preserve user data and intent

Campaign data may represent months or years of work.

Changes must prioritize:

- backward compatibility;
- safe migrations;
- clear deletion behaviour;
- recoverability;
- explicit destructive actions;
- minimal risk of silent data loss.

## 8. Consistency across modules

Similar actions should behave similarly throughout the application.

This includes:

- create and edit flows;
- loading states;
- validation;
- empty states;
- deletion confirmation;
- sorting;
- filtering;
- timestamps;
- GM/player visibility;
- mobile layouts.

A new pattern should not be introduced when an adequate existing pattern exists.

## 9. Accessibility and clarity over decoration

The application may be atmospheric and visually distinctive, but usability
comes first.

Visual decisions must preserve:

- readable contrast;
- clear labels;
- keyboard accessibility where practical;
- meaningful focus states;
- understandable icons;
- responsive layouts.

Decoration must not obscure important information or interaction.

## 10. Build for actual table use before hypothetical scale

Prioritize verified needs from active campaign use.

Do not add complexity solely for:

- imagined enterprise scale;
- speculative future integrations;
- abstract architectural purity;
- features without a clear user outcome.

The architecture should remain extensible, but present value comes first.

## Decision test

When choosing between solutions, prefer the option that:

1. preserves data and authorization;
2. creates the clearest user outcome;
3. follows an established pattern;
4. requires the least unnecessary complexity;
5. remains reversible;
6. supports future extension without prematurely building it.