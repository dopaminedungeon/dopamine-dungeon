# Multitenant & Multirole Management — Foundational Specification

This document defines how **tenancy**, **roles**, **modes**, and **permissions** work in Dopamine Dungeon.

It is a **source of truth** for:
- architecture decisions
- security rules
- routing & guards
- UI behaviour
- future commercial scaling

All diagrams, guards, and implementations **must conform** to this specification.

---

## 1. Core Concepts & Definitions

### Tenant (Workspace)
A **Tenant** (also referred to as a *Workspace*) is the highest-level isolation boundary in the system.

A tenant represents:
- one GM space, organisation, or table owner
- one or more campaigns owned by that space
- one or more users collaborating within that space

**Hard rule (Chinese wall):**
> Data belonging to one tenant must never be visible or accessible to users outside that tenant.

A user may belong to **multiple tenants**.

---

### Campaign
A **Campaign**:
- always belongs to exactly **one tenant**
- is the primary gameplay context
- contains all gameplay entities (PCs, NPCs, Sessions, Items, Arcs, etc.)

Campaigns **never cross tenant boundaries**.

---

### User
A **User** is a single authenticated identity.

A user:
- may belong to zero, one, or many tenants
- may have different permissions in different tenants
- may have different roles in different campaigns

Authentication is global.  
Authorization is **contextual**.

---

## 2. Naming Conventions (Canonical)

These names are used consistently across code, diagrams, and documentation.

| Concept        | Canonical Name | Notes |
|----------------|----------------|-------|
| Tenant         | `tenant` / `workspace` | Pick one term in code; both are equivalent conceptually |
| Campaign       | `campaign`    | Always scoped to a tenant |
| User           | `user`        | Global identity |
| Role           | `role`        | What the user *is allowed* to do |
| Mode           | `mode`        | What the user is *currently acting as* |
| Membership     | `membership`  | User ↔ Tenant ↔ Permission binding |

---

## 3. Tenant Permission Levels (Workspace Administration)

### What is a Tenant Permission Level?
A **Tenant Permission Level** defines what a user is allowed to do at the **tenant/workspace level**, independent of any specific campaign.

Tenant permission levels answer questions like:
- Can this user create a new campaign in this tenant?
- Can this user invite or remove members?
- Can this user manage tenant-wide settings?

Tenant permission levels are:
- assigned per **tenant**
- not global
- additive across tenants

A user may have different permission levels in different tenants.

---

### Supported Tenant Permission Levels (Initial)

#### WorkspaceAdmin
- Can create and manage campaigns within the tenant
- Can manage tenant membership (invite/remove users)
- Can manage tenant-level settings  
  *(future: billing, limits, branding)*

#### WorkspaceMember
- Can participate in campaigns they are added to
- Cannot manage tenant membership
- Cannot create campaigns (unless explicitly allowed later)

---

## 4. Campaign Roles (Authorization Inside a Campaign)

### What is a Campaign Role?
A **Campaign Role** defines what a user is allowed to do **within a specific campaign**.

Campaign roles answer questions like:
- Can this user edit campaign content?
- Can they see GM-only pages (Arcs, Quests, Relationships)?
- Can they assign PCs, items, or conditions?

Campaign roles are:
- assigned per **campaign**
- not global
- **exclusive per campaign**

A user has **exactly one role per campaign**.

---

### Supported Campaign Roles (Initial)

#### CampaignGM
- Full campaign management permissions
- Access to GM-only routes and features
- Can create and edit all campaign content
- Can assign PCs, items, conditions, etc.

#### CampaignPlayer
- Participates in the campaign
- Primarily read-only access to world content
- Has access to:
  - their assigned PC(s)
  - shared resources (e.g. Bag of Holding)
- Limited write access only where explicitly allowed  
  (e.g. assigning an item to themselves if enabled)

---

## 5. Multi-role Users (Across Campaigns)

A single user may hold different **campaign roles** across campaigns within the same tenant.

Examples:
- Tenant: “Magda’s Tables”
  - Campaign A → **CampaignGM**
  - Campaign B → **CampaignPlayer**

This is expected and supported.

**Hard rule:**
> A user has exactly one campaign role per campaign.

---

## 6. Mode (Active Context)

### What is Mode?
**Mode** represents the user’s **current operational context** in the UI.

Examples:
- GM mode
- Player mode

Mode:
- is a UI and routing concept
- does **not** grant permissions
- only restricts or exposes actions already allowed by roles

---

### Role vs Mode (Critical Rule)

- **Role** answers: *“Are you allowed to do this?”*
- **Mode** answers: *“Are you currently acting as this?”*

A user may:
- have a CampaignGM role
- but be currently in Player mode

In that case:
- GM-only routes are blocked
- GM-only actions are hidden
- Player UX applies

---

### Mode Switching
Mode switching:
- is explicit and user-controlled
- re-evaluates routing and permissions immediately
- never changes identity or roles

---

## 7. Permissions Model (High-Level)

Permissions are evaluated using **three dimensions**:

1. Tenant membership and permission level
2. Campaign role
3. Active mode

---

### Permission Evaluation Order (Conceptual)

1. Is the user authenticated?
2. Is the tenant resolved and accessible?
3. Does the user have access to the campaign?
4. Does the user have the required campaign role?
5. Is the active mode compatible with the action?
6. Is the entity accessible?

All checks must pass.

---

## 8. Visibility vs Access

A strict distinction is enforced:

- **Visibility (UI):**
  - controlled by mode
  - affects sidebar items, buttons, and actions

- **Access (Security):**
  - controlled by roles and membership
  - enforced at routing and data layers

UI hiding is **never** considered a security mechanism.

---

## 9. Campaign & Data Isolation

- Every campaign belongs to exactly one tenant
- All campaign queries are implicitly tenant-scoped
- Users only see campaigns they have access to
- Cross-tenant campaign discovery is impossible

This applies equally to:
- GMs
- Players
- multi-role users

---

## 10. Future Commercial Considerations (Explicitly Allowed)

This model explicitly supports:
- multiple GMs running independent campaigns
- agencies or groups managing multiple tables
- tenant-level billing and limits
- commercial scaling without redesign

---

## 11. Non-Goals (For Now)

The following are intentionally out of scope:
- billing implementation
- invitation UX details
- custom fine-grained roles
- platform-wide super-admin roles

These can be added later without violating this spec.

---

## 12. Invariants (Must Always Hold)

- Tenant boundaries are absolute
- Campaigns never cross tenants
- Roles grant permission; modes restrict behaviour
- UI visibility never replaces access control
- A user’s identity never changes when switching mode
- A user may safely belong to multiple tenants