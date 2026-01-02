# 🔐 Permission Matrix — GM vs Player

> **Scope:** Campaign-scoped content  
> **Legend:**  
> - **Full** – view, create, edit, assign, admin  
> - **Read-only** – view only  
> - **Limited** – view + explicitly allowed action  
> - **Blocked** – not visible / `NotAuthorized`

---

## 📄 Pages

| Page | GM | Player | Notes |
|----|----|----|----|
| **Dashboard** | Full | Full | Entry point, campaign-aware |
| **Arcs** | Full | ❌ Blocked | Narrative control is GM-only |
| **Conditions** | Full | ❌ Blocked | Hidden entirely from players |
| **Items** | Full | 🟣 Limited | Player can *self-assign* items |
| **Lore** | Full | 🟡 Read-only | Campaign lore browsing |
| **Maps** | Full | 🟡 Read-only | No editing, view only |
| **NPCs** | Full | 🟡 Read-only | Player-facing NPC info |
| **PCs – Characters tab** | Full | Full (own only) | Player sees only assigned PC(s) |
| **PCs – Bag of Holding** | Full | Full | Shared party inventory |
| **Quests** | Full | ❌ Blocked | GM-facing structure |
| **Relationships** | Full | ❌ Blocked | GM narrative tooling |
| **Sessions** | Full | 🟡 Read-only | Session logs / summaries |
| **Campaign Settings** | Full | ❌ Blocked | Admin-level config |

---

## 🧬 Profiles

| Profile | GM | Player | Notes |
|----|----|----|----|
| **ArcProfile** | Full | ❌ Blocked | GM-only editing |
| **ConditionProfile** | Full | ❌ Blocked | Not visible to players |
| **ItemProfile** | Full | 🟣 Limited | Player: assign item to self |
| **LoreProfile** | Full | 🟡 Read-only | |
| **MapProfile** | Full | 🟡 Read-only | |
| **NpcProfile** | Full | 🟡 Read-only | |
| **PCProfile** | Full | Full (own only) | Guarded by assignment |
| **QuestProfile** | Full | ❌ Blocked | |
| **RelationshipProfile** | Full | ❌ Blocked | |
| **SessionProfile** | Full | 🟡 Read-only | |

---

## 🧠 Special Rules

### PCs (Player Characters)
- Player sees **only assigned PC(s)**
- **0 PCs assigned** → `NotAuthorized`
- **1 PC assigned** → auto-open `PCProfile`
- **>1 PC assigned** → card list view

### Items
- Player **cannot create/edit/delete**
- Player **can assign item to self**
- All other mutations are GM-only

### Bag of Holding
- Always visible to **GM and Player**
- Shared, party-level inventory

---

## 🎯 Why this matters
This matrix is the **single source of truth** for:
- Route guards (`RequireGM`, `RequireAssignedPC`)
- Firestore rules (read/write scopes)
- Navigation visibility
- `NotAuthorized` / EmptyState logic
- QA scenarios & regression tests