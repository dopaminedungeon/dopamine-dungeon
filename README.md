# Dopamine Dungeon 🐉✨

Dopamine Dungeon is a **campaign management app** for tabletop RPGs (D&D-first), designed to keep a whole campaign’s “living brain” in one place:
- NPCs, PCs, Items, Lore, Maps, Sessions
- GM-only vs Player views
- Campaign-scoped data + global navigation
- Cozy UI, fast lookup, and structured flows

**Live app:** https://dopamine-dungeon-final.vercel.app

---

## What’s in this repo

- **React + Vite** frontend
- Modular pages + profiles (e.g. `Items → ItemProfile`, `Sessions → SessionProfile`)
- Context-driven gating:
  - authentication
  - GM/Player mode
  - campaign selection
  - visibility rules
  - assignment rules (PCs)

---

## System navigation diagram (Master Flow)

> This is the **TO-BE contract** for how navigation + gating should work.
> It’s used to compare AS-IS vs TO-BE and derive user stories / refactors.

```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
    A(["Start (App Load)"]) --> n2["[G] Authenticated?"]
    n2 -- No --> n3["[P] Login"]
    n2 -- Yes --> n4["[L] AppShell"]
    n4 -- default --> n1["[P] DopamineDungeonDashboard"]
    n4 --> n5["[N] Sidebar"] & n6["[N] TopBar"]
    n5 --> n7["[P] Arcs"] & n8["[P] CampaignSettings"] & n9["[P] Conditions"] & n10["[P] DopamineDungeonDashboard"] & n11["[P] Items"] & n12["[P] Lore"] & n13["[P] Maps"] & n14["[P] Npcs"] & n15["[P] PCs"] & n16["[P] Quests"] & n17["[P] Relationships"] & n18["[P] Sessions"]

    %% -------- Arcs subgraph --------
    n7 --> AR_A
    subgraph ARCS_FLOW["Arcs – internal flow"]
      direction LR
      AR_A["[P] Arcs"] --> AR_G{"[G] GM Mode? (ModeContext)"}
      AR_G -- Yes --> AR_C["[C] Cards (src/components/Cards.jsx)"]
      AR_G -- No --> AR_NA["[P] NotAuthorized"]
      AR_C -- click arc card --> AR_AP["[P] ArcProfile (:arcId)"]
      AR_AP -- back --> AR_A
    end

  %% ---- ArcProfile subgraph (nested detail) ----
  subgraph ARC_PROFILE_FLOW["ArcProfile – TO-BE flow (GM-only)"]
    direction LR
    AR_AP --> AP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}
    AP_GM -- No --> AP_NA["[P] NotAuthorized"]
    AP_NA -- back --> AP_BACK["[P] DopamineDungeonDashboard / Arcs"]
    AP_GM -- Yes --> AP_VIEW["[P] ArcProfile (view)"]
    AP_VIEW -- toggle Edit/Done --> AP_EDIT["[C] Edit mode (inline fields)"]
    AP_EDIT -- Done --> AP_VIEW
  end
```
  %% (rest of Master Flow is maintained in `docs/masterflow.md`)

Full diagram (with all embedded flows): `docs/masterflow.md`

---

## Architecture & flow docs

All system diagrams live in docs/ and are authored in Mermaid (designed in MermaidChart, stored as Markdown).

👉 Diagram index: `docs/SYSTEMSDIAGRAMS.md`

---

## Dev setup
`pnpm install`
`pnpm dev`

Build: 
`pnpm build`
`pnpm preview`

---

## Conventions (diagram nodes)
- `[P]` – Page (from `src/pages`)
- `[L]` – Layout / Shell (persistent UI structure)
- `[N]` – Navigation component (Sidebar, TopBar, etc.)
- `[C]` – UI component
- `[CTX]` – Context / state container (React Context)
- `[G]` – Gate / Decision (auth, mode, permissions)