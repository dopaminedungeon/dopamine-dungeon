# 🚨 Error & Empty State Matrix — Canonical UX Contract

> Purpose: define **every blocking, recoverable, and empty scenario** in the app  
> so that errors are:
> - predictable
> - recoverable
> - non-destructive
> - boring (in the best possible way)

This document is **authoritative** for:
- routing guards
- UI fallback components
- error boundaries
- empty-state copy
- recovery actions

---

## Core Principles (Non-Negotiable)

- Errors must **never destroy context** unless absolutely required
- Shell (TopBar + Sidebar) stays visible whenever possible
- Every error state provides **at least one recovery action**
- UI hiding ≠ security
- Guards protect **routes and data**, not just navigation links

---

## Error Categories (System-Level)

| Category | Description | Shell Visible |
|--------|------------|---------------|
| AuthError | User not authenticated | ❌ |
| TenantError | Tenant missing or inaccessible | ❌ |
| CampaignError | Campaign missing or inaccessible | ✅ |
| AuthorizationError | Role / permission violation | ✅ |
| NetworkError | Fetch failed / timeout | ✅ |
| NotFound | Entity does not exist | ✅ |
| EmptyState | Valid state, no data | ✅ |

---

## Blocking Errors (Hard Stops)

### Authentication Failed
**Scenario**
- User not logged in
- Token expired
- Auth provider failure

**Behaviour**
- Block all routes
- Redirect to `/login`

**UI**
- Full-page AuthError
- No app shell

**Recovery**
- Login
- Retry authentication

---

### Tenant Missing or Inaccessible
**Scenario**
- Tenant ID missing
- User not a member of tenant
- Tenant deleted

**Behaviour**
- Block immediately
- Redirect to Tenant Picker or Home

**UI**
- TenantAccessError
- No shell

**Recovery**
- Select another tenant
- Go Home

---

## Authorization Errors (Role / Mode Violations)

### GM-only Page Opened by Player
**Scenario**
- Player navigates to GM-only route (URL paste, stale link, sidebar glitch)

**Behaviour**
- Guard blocks before render
- No GM content flashes

**UI**
- NotAuthorized (GM-only messaging)
- Shell visible

**Recovery**
- CTA: “Go to Dashboard”

---

### Mode Switch Invalidates Route
**Scenario**
- User switches from GM mode → Player mode
- Current route is GM-only

**Behaviour**
- Re-evaluate permissions immediately
- Redirect or block

**UI**
- NotAuthorized or redirect to Dashboard

**Recovery**
- Dashboard
- Switch back to GM mode (if role allows)

---

## Campaign Context Errors

### Campaign Missing / Invalid
**Scenario**
- Campaign ID missing
- Campaign deleted
- User lost access

**Behaviour**
- Block entity fetch
- Do not render page content

**UI**
- CampaignRequired or CampaignAccessError
- Shell visible

**Recovery**
- Campaign picker (always reachable via TopBar)
- Go Home

---

### User Has Access to Exactly One Campaign
**Scenario**
- Campaign context not set
- User belongs to only one campaign

**Behaviour**
- Auto-select campaign
- No picker shown

**UI**
- Seamless transition (no empty or error state)

---

### User Has Access to Multiple Campaigns
**Scenario**
- Campaign context not set

**Behaviour**
- Require explicit campaign selection

**UI**
- Campaign Picker view

**Recovery**
- Select campaign

---

## Entity-Level Errors

### Entity Not Found
**Scenario**
- Deep link to non-existent PC / Item / Session / etc.

**Behaviour**
- Block entity render

**UI**
- NotFound
- Shell visible

**Recovery**
- Back to list
- Go Home

---

### Player Opens PCs Page Without Assigned Character
**Scenario**
- Player role
- No PC assigned

**Behaviour**
- Page allowed
- PC content empty

**UI**
- Empty State:
  - “No character assigned yet”
- Bag of Holding tab remains visible

**Recovery**
- Informational only
- No error CTA required

---

## Network & Fetch Errors (Non-Destructive)

### Network Failure During Entity Fetch
**Scenario**
- Firestore timeout
- Offline
- Temporary backend issue

**Behaviour**
- Keep route and shell
- Do not reset context

**UI**
- NetworkError (inline or page-level)
- Loading skeleton may remain

**Recovery**
- Retry action
- Automatic refetch on reconnect

---

## Empty States (Valid, Expected)

Empty states are **not errors**.

### Examples
- No sessions yet
- No items created
- No NPCs
- No lore entries

**UI**
- Friendly empty state
- Contextual CTA (GM-only):
  - “Create first session”
  - “Add item”

Player view:
- Read-only informational messaging

---

## Invariants Established by This File

- Guards protect URLs, not just UI
- No forbidden content ever flashes
- Shell persistence is intentional
- All blocked states offer recovery
- Empty ≠ error
- Network errors never destroy navigation state

---

## Explicit Non-Goals

This document does **not** define:
- Error copy wording
- Styling or illustration decisions
- Logging or monitoring implementation

These can evolve independently without breaking this contract.