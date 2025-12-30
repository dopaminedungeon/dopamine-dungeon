# Dopamine Dungeon – System Diagrams

This folder contains Mermaid diagrams documenting the navigation and page-level flows of the Dopamine Dungeon application.

## Diagram index

- **Master flow** – overall application navigation and page hierarchy  
  `masterflow.md`

- **Arcs** – GM-only page flow, cards list, and arc detail navigation  
  `arcs.md`

_(More page-level diagrams will be added here as the system is mapped.)_

## Conventions
- `[P]` = Page (from `src/pages`)
- `[L]` = Layout / Shell
- `[N]` = Navigation component
- `[C]` = UI component
- `[G]` = Gate / Decision (auth, mode, permissions)

Each page flow lives in its own file and may also be embedded as a subgraph in `masterflow.md` for a complete system overview.