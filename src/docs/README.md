# Dopamine Dungeon – System Diagrams

This folder contains **Mermaid diagrams** documenting the **TO-BE navigation, gating, and context flows** of the Dopamine Dungeon application.

These diagrams are used to:
- reason about current vs intended behavior
- identify gaps and inconsistencies
- derive future user stories and refactors

Diagrams are designed visually in MermaidChart and committed here as Markdown for long-term reference.

---

## Diagram index

### Global / compiled views
- **Master Flow** – overall application navigation, shells, and embedded page flows  
  `masterflow.md`

### Page-level flows (TO-BE)
- **Arcs** – GM-only access, cards list, and arc detail navigation  
  `arcs.md`

- **Arc Profiles** – GM-only access, edit mode and navigation  
  `arcprofile.md`

- **CampaignSettings** – GM-only campaign configuration, campaign selection gating  
  `campaignsettings.md`

- **TopBar – Campaign Chooser** – global campaign selection via TopBar dropdown  
  `topbar.md`

- **Conditions** – GM-only access, cards list, and conditions detail navigation  
  `conditions.md`

- **Condition Profile** – GM-only access, edit mode and navigation  
  `conditionprofile.md`

- **Items** – access for all, visibility based on ModeContext, cards list, and Items detail navigation  
  `items.md`

- **Lore** – access for all, visibility based on ModeContext, cards list, and lore detail navigation  
  `lore.md`

- **Maps** – access for all, visibility based on ModeContext, cards list, and maps detail navigation  
  `maps.md`

- **NPCs** – access for all, visibility based on ModeContext, cards list, and npcs detail navigation  
  `npcs.md`

- **PCs** – access for all, visibility based on ModeContext, cards list, and pcs detail navigation  
  `pcs.md`

- **Quests** – GM-only access, cards list, and quests detail navigation  
  `quests.md`

- **Relationships** – GM-only access, cards list, and relationships detail navigation  
  `relationships.md`

- **Sessions** – access for all, visibility based on ModeContext, cards list, and sessions detail navigation  
  `sessions.md`

_(More page-level diagrams will be added as the system is mapped.)_

---

## Conventions

Node prefixes used across all diagrams:

- `[P]` – Page (from `src/pages`)
- `[L]` – Layout / Shell (persistent UI structure)
- `[N]` – Navigation component (Sidebar, TopBar, etc.)
- `[C]` – UI component
- `[CTX]` – Context / state container (React Context)
- `[G]` – Gate / Decision (auth, mode, permissions)

---

## Diagram philosophy

- Diagrams represent **TO-BE behavior** (how the system should work).
- “AS-IS” behavior is compared against these diagrams to identify gaps.
- Contexts (`[CTX]`) represent state + side effects, not UI.
- Gates (`[G]`) represent explicit yes/no routing decisions.
- Master Flow embeds selected page flows as subgraphs for a complete system view.

These diagrams are **contracts**, not decorations.