# Dopamine Dungeon — System Diagrams (TO-BE)

This folder contains **Mermaid diagrams** documenting the **intended (TO-BE) architecture** of Dopamine Dungeon:
- navigation & routing
- guards (auth / tenant / campaign / role / mode)
- page flows + profile flows
- permissions
- data ownership (Firestore)
- error & empty state behaviour
- multitenant / multirole foundational rules

> Diagrams are designed visually (MermaidChart) and committed as Markdown so GitHub can render them.

---

## Folder structure (source of truth)

All diagrams live here:

- `src/docs/`

Key entry points:
- `masterflow.md` — compiled “whole app” view
- `SYSTEMSDIAGRAMS.md` — this index

---

## Legend / Naming convention (used across all diagrams)

- `[P]` — Page (route)
- `[L]` — Layout / Shell
- `[N]` — Navigation component
- `[C]` — UI component
- `[CTX]` — Context / state container (React Context)
- `[G]` — Gate / Decision (auth, tenant, campaign, role, mode)

---

## Diagram index

### Foundational architecture (read first)
- **Multitenant & multirole spec** (tenant/workspace, campaign roles, permission levels, role vs mode invariants)  
  `multitenant-multirole-management.md`

- **Context & state architecture map** (how Auth/Tenant/Campaign/Mode contexts compose)  
  `context-architecture.md`

---

### Global system views
- **Master Flow** (global navigation backbone + embedded subgraphs)  
  `masterflow.md`

- **Routing Map** (route graph + guard points; URL structure contract)  
  `routing-map.md`

---

### Permissions
- **Permission matrix (graph)** (GM vs Player; page-level capabilities & guard logic)  
  `permissions-graph.md`

- **Permission matrix (table)** (authoritative, boring, explicit)  
  `permissions-table.md`

---

### Data layer
- **Data Ownership Map (Firestore)** (scope, ownership, reads/writes, write paths, open decisions)  
  `dataownership-map.md`

---

### UX contracts
- **User Flows** (happy + unhappy paths; recovery behaviours; invariants)  
  `userflows.md`

- **Error & Empty State Matrix** (canonical handling; recovery actions; shell visibility rules)  
  `error-emptystate-matrix.md`

---

## Page flows (list pages)
> Each page file documents the TO-BE gate(s) + list view behaviour + navigation to profile.

- **Arcs** (GM-only; cards → profile)  
  `arcs.md`

- **Campaign Settings** (GM-only; requires campaign selection)  
  `campaignsettings.md`

- **Conditions** (GM-only UX; special “entered via GM then switched” behaviour)  
  `conditions.md`

- **Items** (read-only list; Player can “assign to self” per permissions)  
  `items.md`

- **Lore** (read-only)  
  `lore.md`

- **Maps** (read-only)  
  `maps.md`

- **NPCs** (read-only)  
  `npcs.md`

- **PCs** (mixed mode; Player sees own PC(s) + Bag of Holding tab; GM sees all)  
  `pcs.md`

- **Quests** (GM-only; cards → profile)  
  `quests.md`

- **Relationships** (GM-only; cards → profile)  
  `relationships.md`

- **Sessions** (read-only; cards → profile)  
  `sessions.md`

---

## Profile flows (detail routes)
> Each profile file documents the TO-BE gate(s) + view/edit toggles + back navigation.

- **Arc Profile**  
  `arcprofile.md`

- **Condition Profile**  
  `conditionprofile.md`

- **Item Profile**  
  `itemprofile.md`

- **Lore Profile**  
  `loreprofile.md`

- **Map Profile**  
  `mapprofile.md`

- **NPC Profile**  
  `npcprofile.md`

- **PC Profile**  
  `pcprofile.md`

- **Bag of Holding** (PCs section tab; no “back” — tab-based)  
  `bagofholding.md`

- **Quest Profile**  
  `questprofile.md`

- **Relationship Profile**  
  `relationshipprofile.md`

- **Session Profile**  
  `sessionprofile.md`

---

## Navigation components
- **TopBar** (campaign picker + mode switching entrypoint, per spec)  
  `topbar.md`

---

## Diagram philosophy (why these exist)

- Diagrams represent **TO-BE behavior** (how the system should work).
- “AS-IS” is compared against these diagrams to derive refactors + user stories.
- Contexts (`[CTX]`) represent state + side effects, not UI.
- Gates (`[G]`) represent explicit yes/no decisions enforced before render/fetch.
- Master Flow embeds selected page/profile subgraphs so we can reason end-to-end.

These diagrams are **contracts**, not decorations.