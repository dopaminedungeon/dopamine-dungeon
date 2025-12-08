# 🗺️ Dopamine Dungeon — Development Roadmap

This roadmap reflects the current strategic direction and priority ordering for the Dopamine Dungeon application. It is structured into tiers based on impact, dependencies, and the natural flow of how the world model and UX evolve.

---

## 🧭 TIER 1 — Core Gameplay Systems (Highest Priority)
These unlock everything else. They shape how the world **functions**, not just how it looks.

### ✅ 1. PC Profiles (#45)
Foundation for character‑centric data, linking, GM/player visibility, and future systems.

### ✅ 2. Campaigns Module (#23)
The umbrella structure that organizes the app:
**Campaign → Arcs → Sessions → NPCs/Items/Maps/Lore/etc.**

### ✅ 3. Bag of Holding (Player Inventory) (#30)
First major player‑facing tool. Small scope, high visibility, high satisfaction.

### ✅ 4. Player‑safe Sessions (#10)
Completes the triangle: **GM view + Player view + shared, linkable content.**

### ✅ 5. Cross‑linking System (#37)
Creates the world graph:
**PC ↔ NPC ↔ Item ↔ Session ↔ Arc ↔ Map ↔ Lore**
Transforms the app from a collection of isolated pages into a cohesive **world model**.

---

## 🧭 TIER 2 — Worldbuilding Expansion (High Priority)
Adds narrative depth and boosts GM creative power.

### 🔸 6. Tiny Profile Refinements (#31)
Micro‑polish across all profile pages:
- Severity colors
- Progress bar spacing
- Metadata strip consistency
- Hero layout refinements

### 🔸 7. Lore System Expansion & Dashboard (#6)
More lore types, relationships, metadata, and UI polish.

### 🔸 8. Bulk Import for NPCs/Items (#19)
Quality‑of‑life upgrade for rapid worldbuilding and wholesale migrations.

---

## 🧭 TIER 3 — UI & Experience Refinement (Medium Priority)
Makes the app feel **professional, cohesive, and intentional**.

### 🔸 9. Arcs & Timeline Visualization (#38)
A graphical timeline component for arcs, sessions, and events.
High dopamine; not blocking functionality.

### 🔸 10. Icon Amendments (#17)
Finalizes a consistent visual language.

### 🔸 11. Unify UI (#43)
One‑pass aesthetic standardization across the app:
- Title cards
- Two‑column profiles
- Metadata bars
- Spacing and rhythm
- Card iconography
- Consistent layout grid

### 🔸 12. Sidebar & Navigation redesign (#28)
Ensures all modules have a clear home and smooth navigation paths.

---

## 🧭 TIER 4 — Backend & Infrastructure (Lower Immediate Priority)
Important for data integrity and scale, but should follow UI and linking stability.

### 🔸 13. Firebase CRUD Migration (#7, #36)
Move from mock data → real backend.
This should begin **after** UI conventions and entity relationships solidify.

### 🔸 14. Error Boundaries for Firebase (#8)
Protects the app from explosions during network issues or invalid permissions.

---

## 🧭 TIER 5 — Future Candy / Optional Extras (Lowest Priority)
Not required for MVP. Pure delight, luxury, and chaos.

### 🔸 15. Reveal Automation (Fun Shit™) (#41)
Automated lore reveals, session‑triggered events, and dynamic unlocks.
A glorious future feature once the core loop is complete.

---

## 📌 Notes
- Tier numbers reflect **strategic priority**, not difficulty.
- The ordering inside each tier reflects **dependency flow**.
- This roadmap is meant to be reviewed after each major milestone.