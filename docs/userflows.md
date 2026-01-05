# User Flows

This document describes **all user journeys** in Dopamine Dungeon — both happy and unhappy paths.
Every flow begins with **App Open** and builds on shared system guarantees.

The foundational order is always:

**Authentication → Mode (GM / Player) → Campaign Context → App Shell → Route/Page**

---

## Flow 1 — App Open → Stable Entry

### Purpose
Establish a **stable, recoverable starting point** for every user, regardless of role, permissions, or campaign state.

This flow is the root of **all other flows** in the system.

---

### Actors
- Any user (GM or Player)

---

### System Guarantees After This Flow
After Flow 1 completes, the system guarantees:

- User identity is known (or explicitly not authenticated)
- User mode (GM / Player) is resolved
- Campaign context is either:
  - selected and valid, OR
  - explicitly missing/blocked with guidance
- UI is never partially rendered
- User always has a visible recovery action

---

### Happy Path — Authenticated, Campaign Selected

1. User opens the app.
2. Authentication state is resolved.
3. User is authenticated.
4. ModeContext resolves current mode:
   - GM or Player (based on role + last used mode).
5. CampaignContext resolves:
   - previously selected campaign exists and is accessible.
6. AppShell renders:
   - TopBar (with campaign selector & mode toggle)
   - Sidebar (pages filtered by mode)
7. Router loads default landing page:
   - Dashboard / Home (campaign-scoped).

Result:
- User is fully inside the app and can navigate freely within their permissions.

---

### Unhappy Path — Not Authenticated

1. User opens the app.
2. Authentication state resolves to **not authenticated**.
3. App renders **Login page only**.

Result:
- No AppShell
- No campaign context
- Clear CTA to authenticate

Recovery:
- After successful login, resume Flow 1 at Mode resolution.

---

### Unhappy Path — Authentication Loading / Delayed

1. User opens the app.
2. Authentication state is **loading**.
3. App renders **full-page loading state**.

Rules:
- No Login flicker
- No AppShell until auth resolves

Recovery:
- On resolve → continue Flow 1 normally.

---

### Unhappy Path — No Campaign Selected

1. User is authenticated.
2. ModeContext resolves successfully.
3. CampaignContext resolves to **no campaign selected**.
4. AppShell renders.
5. Main content shows **Campaign Required state**.

Result:
- Sidebar visible (navigation allowed but guarded)
- TopBar campaign selector highlighted
- Optional GM-only CTA: “Create campaign”

Recovery:
- User selects a campaign → continue to landing page.

---

### Unhappy Path — Campaign Missing or Access Denied

1. User is authenticated.
2. CampaignContext attempts to load last selected campaign.
3. Campaign does not exist OR user lacks access.
4. App renders **Campaign Access Error state**.

Result:
- AppShell remains visible
- Clear message explaining the issue
- Campaign selector available

Recovery:
- User selects another campaign
- System clears invalid campaign reference if needed

---

### Unhappy Path — Network / Backend Failure During Entry

Examples:
- Firestore unavailable
- Network offline
- Timeout during campaign fetch

1. User opens the app.
2. Authentication resolves (cached or online).
3. CampaignContext fails due to network error.
4. App shows **Non-destructive error state**.

Result:
- AppShell remains visible (if auth succeeded)
- Error banner or page-level error shown
- Retry action available

Recovery:
- Retry campaign fetch
- Continue flow once data is available

---

### Invariants Established by Flow 1

- AppShell is rendered **only after authentication**
- Campaign context is mandatory for meaningful interaction
- Users are never silently redirected
- Every blocked state includes:
  - explanation
  - visible recovery action

All subsequent flows assume these invariants.

### Flow 1 — App Open → Stable Entry (Diagram)

```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart TB
    A0(["Start (App Load)"]) --> A1{"[G] Authenticated?"}
    A1 -- No --> L0["[P] Login"]
    L0 --> L1{"[G] Auth success?"}
    L1 -- No --> L2["[S] AuthFailed</br>(show error + retry)"]
    L2 --> L0
    L1 -- Yes --> CTX_AUTH["[CTX] AuthContext resolved"]
    A1 -- Yes --> CTX_AUTH
    CTX_AUTH --> W0{"[G] Accessible workspaces?"}
    W0 -- None --> W1["[P] NoWorkspace</br>(CTA: Request access / Create tenant later)"]
    W0 -- Some --> W2{"[G] Exactly 1 workspace?"}
    W2 -- Yes --> CTX_WS["[CTX] WorkspaceContext set (auto)"]
    W2 -- No --> TB0["[N] TopBar</br>WorkspacePicker shows ONLY accessible workspaces"]
    TB0 -- select workspace --> CTX_WS
    CTX_WS --> C0{"[G] Accessible campaigns</br>in this workspace?"} & WP0["[CTX] WorkspacePermission resolved</br>(WorkspaceAdmin | WorkspaceMember)"]
    C0 -- None --> C1["[P] NoCampaign</br>(CTA depends on WorkspacePermission)"]
    C0 -- Some --> C2{"[G] Exactly 1 accessible campaign?"}
    C2 -- Yes --> CTX_CAMP["[CTX] CampaignContext set (auto)"]
    C2 -- No --> TB1["[N] TopBar</br>CampaignPicker shows ONLY accessible campaigns"]
    TB1 -- select campaign --> CTX_CAMP
    CTX_CAMP --> CR0["[CTX] CampaignRole resolved</br>(CampaignGM | CampaignPlayer)"]
    CR0 --> M0{"[G] Mode resolved?"}
    M0 -- "role=CampaignPlayer" --> M1["[CTX] Mode=Player (locked)"]
    M0 -- "role=CampaignGM" --> M2["[CTX] Mode=GM (default) + toggle available"]
    M1 --> SHELL["[L] AppShell"]
    M2 --> SHELL
    SHELL --> UI0["[N] Sidebar</br>(mode-filtered nav)"] & UI1["[N] TopBar</br>(workspace/campaign always reachable)"] & R0["[L] Routes (guarded)</br>(load Dashboard default)"]
    R0 --> NOTE["[S] Default route = Dashboard</br>Fallback = NotFound for unknown URL"]
  ```

---

#### Clarifications for your bullet points (so the diagram is “self-explaining”)

##### 1) “Auth failed” — what is it?
That’s when:
- Firebase/Auth provider errors out
- token refresh fails
- auth request returns an error
- user session is corrupted

We show **AuthError** with:
- Retry
- Re-login
- (optional) log-out cleanup

##### 2) What replaced “fallback/default” for mode?
Instead of “fallback/default” arrows, we made it explicit:

**ModeContext resolves mode**:
- if user has a stored `lastMode` → use it
- else derive from role:
  - GM → GM mode
  - Player → Player mode

So Mode resolve always succeeds unless the app is truly broken.

##### 3) Campaign list assumption fixed
We now have a proper split:
- **0 accessible campaigns** → NoCampaignAccess
- **1 accessible campaign** → Auto-select (no picker)
- **2+ campaigns** → CampaignPicker

##### 4) Picker shows only campaigns you can access
This is now baked in as a rule via:
> `Load accessible campaigns`

Meaning: the picker isn’t a “browse all campaigns” screen — it’s a “your campaigns” screen.

Same rule for GM: a GM sees only campaigns they’re a member/owner of.

---

#### About “commercial mode” / multi-tenant (“Chinese wall”)

You’re not crazy for thinking about this now — but we should **treat it as a requirement stub**, not a design rabbit hole.

##### What we do *now* (lightweight, correct)
We add one concept into requirements:

- **Tenant / Workspace boundary**
  - every campaign belongs to a tenant/workspace (`tenantId`)
  - every membership is scoped to tenant
  - campaign listing is filtered by tenant membership

This prevents:
- GM A seeing GM B’s campaigns
- cross-party leakage
- accidental “global admin” assumptions

##### When do we fully design it?
During **Architecture design / Data ownership map deep dive**, not during userflows.

So: **yes, we include a Tenant node in Flow #1 (done)**, and later we’ll formalize it in:
- Data model
- Security rules
- Query patterns

---

## Flow 2 — Campaign Selection & Switching (Diagram)

```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart TB
    S0["[L] AppShell (already running)"] --> TB["[N] TopBar<br>(workspace/campaign always reachable)"]
    TB --> W0{"[G] User switches workspace?"} & MS0{"[G] User toggles mode?"}
    W0 -- No --> C0{"[G] User switches campaign?"}
    W0 -- Yes --> W1["[CTX] WorkspaceContext updated<br>(activeWorkspaceId)"]
    W1 --> W2["[CTX] CampaignContext cleared"]
    W2 --> W3{"[G] Accessible campaigns in new workspace?"}
    W3 -- None --> W4["[P] NoCampaign<br>(CTA depends on WorkspacePermission)"]
    W3 -- Some --> W5{"[G] Exactly 1 accessible campaign?"}
    W5 -- Yes --> W6["[CTX] CampaignContext set (auto)"]
    W5 -- No --> W7["[N] CampaignPicker<br>(shows ONLY accessible campaigns)"]
    W7 -- select --> W6
    W6 --> R0["[CTX] CampaignRole resolved for new campaign"]
    R0 --> M0{"[G] Mode allowed?"}
    M0 -- "role=CampaignPlayer" --> M1["[CTX] Mode=Player (locked)"]
    M0 -- "role=CampaignGM" --> M2["[CTX] Mode stays as-is<br>(if GM previously, keep)<br>(toggle still available)"]
    M1 --> ROUTES["[L] Routes re-evaluated<br>(guards rerun)"]
    M2 --> ROUTES
    C0 -- No --> END0["[S] No change"]
    C0 -- Yes --> C1["[CTX] CampaignContext updated<br>(activeCampaignId)"]
    C1 --> C2["[CTX] CampaignRole resolved<br>for selected campaign"]
    C2 --> C3{"[G] Mode compatible with role?"}
    C3 -- "role=CampaignPlayer" --> C4["[CTX] Force Mode=Player<br>(lock toggle)"]
    C3 -- "role=CampaignGM" --> C5["[CTX] Keep current Mode<br>(GM or Player)"]
    C4 --> ROUTES
    C5 --> ROUTES
    MS0 -- No --> END1["[S] Continue"]
    MS0 -- Yes --> MS1{"[G] Role allows toggle?<br>(CampaignGM only)"}
    MS1 -- No --> MS2["[S] No-op<br>(toggle hidden/disabled)"]
    MS1 -- Yes --> MS3["[CTX] ModeContext toggled<br>(GM &lt;-&gt; Player)"]
    MS3 --> ROUTES
  ```

---

### Key Rules (these matter later)

#### Campaign switching **never**
- preserves the current page blindly
- assumes permissions stay the same
- keeps edit state alive

#### Campaign switching **always**
- resets routing to a safe landing page
- re-evaluates permissions
- re-renders page content
- keeps AppShell mounted

---

### Unhappy / Edge Paths (Explicit)

#### Campaign deleted while user is inside it
- CampaignContext fails validation
- User is redirected into Flow 2 automatically
- CampaignAccessError is shown
- Picker opens (if alternatives exist)

---

#### Access revoked mid-session
- Same behavior as deletion
- No silent failures
- No stale data shown

---

#### Network failure during switch
- AppShell remains visible
- Current campaign context is **not destroyed**
- Retry does not force logout or reload

---

#### GM vs Player differences
- GM may see “Create campaign” CTA when count = 0
- Player never sees campaigns they don’t belong to
- Picker contents are always filtered by access

---

### Invariants Established by Flow 2
- CampaignContext is **the single source of truth**
- Route safety beats convenience
- No page owns campaign state
- Switching campaigns is reversible and recoverable

---

## Flow 3 — Route Access & Guarding

### Purpose
Define what happens when a user navigates to any route:
- via Sidebar
- via URL/deep link
- via refresh
- after switching mode (GM ↔ Player)
- after switching campaign

This flow ensures:
- no forbidden content leaks
- users always land somewhere safe
- errors are recoverable (not dead ends)

---

### Core Inputs (what guards decide with)
- **Auth state** (authenticated / not authenticated / failed)
- **Mode** (GM / Player)
- **CampaignContext** (selected / missing / invalid)
- **Membership** (user has access to this campaign)
- **Route policy** (GM-only / Player-allowed / read-only / hidden)
- **Entity access** (e.g., player’s assigned PC)

---

### Route Policies (TO-BE)
Routes declare their policy explicitly:

- **Public**: no auth required (Login only)
- **AuthOnly**: requires auth (Dashboard, etc.)
- **CampaignRequired**: requires selected campaign
- **GMOnly**: requires GM mode (and/or GM role)
- **PlayerScoped**: player may access only scoped entities (e.g., own PC)
- **ReadOnly**: allowed, but no mutation actions visible

> Note: “Hidden in Sidebar” is UI-only. Guards must still protect the URL.

---

### Flow 3 — Diagram

```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart TB
    U0(["[E] User attempts navigation<br>(link / URL / deep-link / refresh)"]) --> G0["[L] RouteGuard pipeline"]
    G0 --> G1{"[G] Authenticated?"}
    G1 -- No --> A0["[P] Login<br>(+ returnUrl stored)"]
    G1 -- Yes --> G2{"[G] Workspace resolved & accessible?"}
    G2 -- No --> W0["[P] WorkspaceAccessDenied<br>(CTA: Switch workspace / Go Home)"]
    G2 -- Yes --> G3{"[G] Campaign resolved & accessible?"}
    G3 -- No --> C0["[P] CampaignRequiredOrAccessDenied<br>(CTA: Pick campaign via TopBar)"]
    G3 -- Yes --> G4{"[G] CampaignRole allows route?"}
    G4 -- No --> NA0["[P] NotAuthorized<br>(CTA: Go Home / Dashboard)"]
    G4 -- Yes --> G5{"[G] Mode compatible with route?"}
    G5 -- No --> MR0["[P] NotAuthorized or Redirect<br>(reason: wrong mode)<br>(CTA: Go Dashboard)"]
    G5 -- Yes --> G6["[S] Policy passed → proceed to route"]
    G6 --> E0{"[G] Route targets entity?<br>(/:id)"}
    E0 -- No --> OK0["[S] Render page (safe)"]
    E0 -- Yes --> E1["[DATA] Fetch entity<br>(scoped workspaceId+campaignId)"]
    E1 --> E2{"[G] Network ok?"}
    E2 -- No --> NET0["[P] NetworkError<br>(non-destructive)<br>(CTA: Retry)"]
    NET0 -- Retry --> E1
    E2 -- Yes --> E3{"[G] Entity exists?"}
    E3 -- No --> NF0["[P] NotFound<br>(CTA: Go Home + Back to list)"]
    E3 -- Yes --> OK1["[S] Render entity page"]
    S1["[E] Player opens GM-only route"] --> G0
    S2["[E] Player opens PCs (Characters tab)<br>with no assigned PC"] --> PC0{"[G] Assigned PC(s) exist?"}
    PC0 -- No --> PC1["[P] Characters tab shows<br>No character assigned yet"]
    PC0 -- Yes --> PC2["[S] Show player PC view"]
    PC1 --> PC3["[S] Bag of Holding tab remains available"]
    PC2 --> PC3
    S3["[E] User toggles mode on GM-only route"] --> M0["[CTX] ModeContext updates"]
    M0 --> G0
    S4["[E] Campaign missing/invalid"] --> C0
    S5["[E] Deep-link to missing entity"] --> E1
    OK0 --> I0["[S] Invariants:<br>- Guards protect URLs, not only sidebar<br>- UI hiding ≠ security<br>- Policy checks happen before fetch<br>- No forbidden content flashes<br>- Every block has recovery CTA"]
    OK1 --> I0
    NA0 --> I0
    NF0 --> I0
    NET0 --> I0
    C0 --> I0
    W0 --> I0
```

### Unhappy Paths (Explicit Behaviours)

#### Player opens a GM-only page (URL or sidebar glitch)
- Route guard blocks access
- **NotAuthorized** page is shown with GM-only messaging
- Clear CTA provided: **“Go Home”** (Dashboard)

---

#### Player opens PCs page but has no assigned character
- If the route is **PlayerScoped**:
  - Access is blocked
  - **NotAuthorized** is shown
- If the PCs page itself is allowed:
  - **Characters** tab shows:
    - “No character assigned yet”
  - **Bag of Holding** tab remains accessible

---

#### User deep-links to an entity that doesn’t exist
- **NotFound** page is shown
- CTAs provided:
  - **“Go Home”**
  - **“Back to list”** (if applicable)

---

#### User switches to Player mode while on a GM-only route
- Route policy is re-evaluated immediately on mode change
- User is:
  - blocked with **NotAuthorized**, or
  - redirected to **Dashboard**
- No GM-only content remains visible or cached

---

#### Campaign missing or invalid during navigation
- Guard blocks navigation with:
  - **CampaignRequired**, or
  - **CampaignAccessError**
- Campaign picker remains reachable via **TopBar**
- User can recover without reload

---

#### Network failure during entity fetch
- **NetworkError** is shown (non-destructive)
- AppShell remains visible
- **Retry** action re-attempts the fetch
- Original route intent is preserved

---

### Invariants Established by Flow 3

- Route guards protect **URLs**, not just sidebar navigation
- UI hiding is **never** treated as a security mechanism
- Policy checks occur **before** entity fetching
- Forbidden content never flashes on screen
- Every blocked state includes a visible recovery action

---

## Flow 4 — Player Happy Path (Session Night)

### Purpose
Describe the ideal, low-friction experience for a **Player** during a game session.

This flow prioritizes:
- clarity over power
- reading over editing
- zero permission anxiety
- minimal navigation decisions

---

### Actor
- Player (authenticated, non-GM)

---

### Preconditions
- User is authenticated
- Player mode is active
- Campaign is selected and accessible
- Player is a member of the campaign

---

### Success Result
Player can:
- immediately see their character
- access shared party resources
- read session-related information
- exit without confusion or accidental changes

---

### Happy Path — Primary Flow

1. Player opens the app.
2. Authentication and campaign resolution complete (Flow 1).
3. AppShell renders with Player-filtered navigation.
4. Player lands on **Dashboard / Home**.

---

### Characters & Inventory

5. Player navigates to **PCs**.
6. PCs page loads in **Player view**.

#### Characters tab behaviour
- If player has **exactly one assigned character**:
  - Character profile loads automatically
  - No card selection required
- If player has **multiple assigned characters**:
  - Character cards are shown
  - Player selects one to view

7. Character profile is shown:
   - All fields are **read-only**
   - No edit actions are visible

#### Bag of Holding tab
8. Player switches to **Bag of Holding** tab.
9. Shared party inventory is displayed.
10. Player may:
    - view items
    - (optionally) assign items to themselves if allowed
11. No destructive actions are available.

---

### Session Awareness

12. Player navigates to **Sessions**.
13. Sessions list is displayed (read-only).
14. Player opens the **current or most recent session**.
15. Session details are shown:
    - notes
    - summary
    - outcomes
16. No editing or GM-only controls are visible.

---

### World Reference (Optional)

17. Player may navigate to:
    - **Maps**
    - **Lore**
    - **Items**
    - **NPCs**

18. All content is displayed in **read-only mode**.
19. Navigation between these pages does not change context or permissions.

---

### Exit

20. Player closes the app or navigates away.
21. No unsaved changes exist.
22. No confirmation dialogs are required.

---

### UX Principles Enforced by This Flow

- Player never wonders:
  - “Am I allowed to be here?”
  - “Can I break something?”
- Read-only is the default.
- The player’s own character is always easy to find.
- Shared resources are visible but safe.
- The system never exposes GM affordances accidentally.

---

### Recovery / Edge Behaviours (Still Happy)

- If assigned character is removed mid-session:
  - Characters tab updates
  - Message shown: “Your character is no longer assigned”
  - Bag of Holding remains accessible
- If network hiccup occurs:
  - AppShell remains visible
  - Retry banner appears
  - No loss of navigation context

### Flow 4 — Player Happy Path (Session Night) — Diagram

```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart TB
    P0(["Player opens Dopamine Dungeon"]) --> A1{"[G] Authenticated?"}
    A1 -- No --> L0["[P] Login"]
    L0 --> L1{"[G] Auth success?"}
    L1 -- No --> L2["[S] AuthFailed<br>(show error + retry)"]
    L2 --> L0
    L1 -- Yes --> CTX_AUTH["[CTX] AuthContext resolved"]
    A1 -- Yes --> CTX_AUTH
    CTX_AUTH --> WS0{"[G] Accessible workspaces?"}
    WS0 -- None --> WS1["[P] NoWorkspace<br>(CTA: Request access)"]
    WS0 -- Some --> WS2{"[G] Exactly 1 workspace?"}
    WS2 -- Yes --> CTX_WS["[CTX] WorkspaceContext set (auto)"]
    WS2 -- No --> TB0["[N] TopBar WorkspacePicker<br>(shows only accessible)"]
    TB0 -- select --> CTX_WS
    CTX_WS --> C0{"[G] Accessible campaigns<br>in workspace?"}
    C0 -- None --> C1["[P] NoCampaign<br>(CTA: Ask GM)"]
    C0 -- Some --> C2{"[G] Exactly 1 accessible campaign?"}
    C2 -- Yes --> CTX_CAMP["[CTX] CampaignContext set (auto)"]
    C2 -- No --> TB1["[N] TopBar CampaignPicker<br>(shows only accessible)"]
    TB1 -- select --> CTX_CAMP
    CTX_CAMP --> ROLE0["[CTX] CampaignRole resolved = CampaignPlayer"]
    ROLE0 --> MODE0["[CTX] Mode=Player (locked)"]
    MODE0 --> SHELL["[L] AppShell"]
    SHELL --> SIDEBAR["[N] Sidebar (Player view)<br>(hides GM-only pages)"] & TOPBAR["[N] TopBar<br>(Campaign switch always reachable)"] & HOME["[P] Dashboard (Player)"]
    HOME --> PCS["[P] PCs (Player)"] & ITEMS["[P] Items"] & LORE["[P] Lore"] & MAPS["[P] Maps"] & NPCS["[P] NPCs"] & SESS["[P] Sessions"] & GMTRY["[E] Player tries GM-only URL"]
    PCS --> TAB0["[N] Tabs: Characters | Bag of Holding"]
    TAB0 --> CH0{"[G] Player has assigned PCs<br>in this campaign?"} & BAG["[P] Bag of Holding<br>(shared, campaign-scoped)"]
    CH0 -- No --> CH1["[P] Characters tab:<br>No character assigned yet"]
    CH0 -- Yes --> CH2{"[G] Exactly 1 assigned PC?"}
    CH2 -- Yes --> CH3["[P] PCProfile (auto-load)<br>(read-only + allowed actions)"]
    CH2 -- No --> CH4["[P] PC Cards list<br>(click to open)"]
    CH4 --> CH5["[P] PCProfile (:pcId)"]
    ITEMS --> ITEMP["[P] ItemProfile (:itemId)<br>(read-only)<br>+ optionally assign-to-self"]
    LORE --> LOREP["[P] LoreProfile (:loreId)<br>(read-only)"]
    MAPS --> MAPP["[P] MapProfile (:mapId)<br>(read-only)"]
    NPCS --> NPCP["[P] NpcProfile (:npcId)<br>(read-only)"]
    SESS --> SESP["[P] SessionProfile (:sessionId)<br>(read-only)"]
    GMTRY --> NA["[P] NotAuthorized<br>(CTA: Go Home)"]
    NA --> HOME
```
---

## Flow 5 — GM Happy Path (Prep + In-Session)

### Purpose
Describe the ideal experience for a **GM** preparing a session and running it live.

This flow prioritizes:
- fast scanning over deep editing
- intentional edits (no accidental changes)
- smooth switching between prep and play
- minimal UI friction during session time

---

### Actor
- GM (authenticated, GM mode active)

---

### Preconditions
- User is authenticated
- GM mode is active
- Campaign is selected and accessible

---

### Success Result
GM can:
- prepare content efficiently
- run a live session without UI friction
- update outcomes after the session
- never lose context or control

---

### Happy Path — Session Prep

1. GM opens the app.
2. Authentication, mode, and campaign resolve (Flows 1 & 2).
3. AppShell renders with GM navigation.
4. GM lands on **Dashboard / Home**.

5. GM navigates freely between:
   - **Sessions** (upcoming / past)
   - **NPCs**
   - **Arcs**
   - **Maps**
   - **Items**
   - **Conditions**
   - **Relationships**

6. GM opens relevant entities in **view mode by default**.
7. GM selectively enters **edit mode** where needed.
8. Changes are saved intentionally and locally scoped.

---

### Happy Path — In-Session Use

9. GM opens the **current Session**.
10. Session profile is visible:
    - notes
    - participants
    - outcomes
11. GM may:
    - reference NPCs
    - check Maps
    - inspect Conditions
    - review Relationships

12. GM switches between entities without losing session context.

---

### Happy Path — After Session

13. GM updates:
    - session summary
    - new conditions
    - item changes
    - relationship changes
14. GM saves changes.
15. GM exits session context.

---

### UX Principles Enforced by This Flow

- GM always starts in **view mode**
- Editing is explicit, never accidental
- Navigation is reference-first, not form-first
- No page reloads during session use
- Context (campaign + session) is never lost

---

### Calm Failure Handling (Still Happy)

- If a save fails:
  - error message shown inline
  - no data loss
- If network hiccup occurs:
  - AppShell remains visible
  - retry is available
- If GM switches mode accidentally:
  - Flow 3 rules apply immediately

---

### Flow 5 — GM Happy Path (Diagram)

```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart TB
    G0(["GM opens Dopamine Dungeon"]) --> A1{"[G] Authenticated?"}
    A1 -- No --> L0["[P] Login"]
    L0 --> L1{"[G] Auth success?"}
    L1 -- No --> L2["[S] AuthFailed<br>(show error + retry)"]
    L2 --> L0
    L1 -- Yes --> CTX_AUTH["[CTX] AuthContext resolved"]
    A1 -- Yes --> CTX_AUTH
    CTX_AUTH --> WS0{"[G] Accessible workspaces?"}
    WS0 -- None --> WS1["[P] NoWorkspace<br>(CTA: Create tenant later)"]
    WS0 -- Some --> WS2{"[G] Exactly 1 workspace?"}
    WS2 -- Yes --> CTX_WS["[CTX] WorkspaceContext set (auto)"]
    WS2 -- No --> TB0["[N] TopBar WorkspacePicker<br>(only accessible)"]
    TB0 -- select --> CTX_WS
    CTX_WS --> WPERM["[CTX] WorkspacePermission resolved<br>(WorkspaceAdmin | WorkspaceMember)"] & C0{"[G] Accessible campaigns<br>in workspace?"}
    WPERM --> CANCREATE{"[G] Can create campaigns?"}
    CANCREATE -- Yes --> CREATEC["[P] Create Campaign (TO-BE)<br>(from NoCampaign or Settings)"]
    CANCREATE -- No --> NOCAMP_CTA["[S] If no campaigns:<br>CTA = Ask Admin"]
    C0 -- None --> C1["[P] NoCampaign<br>(CTA: Create if Admin, else Ask Admin)"]
    C0 -- Some --> C2{"[G] Exactly 1 accessible campaign?"}
    C2 -- Yes --> CTX_CAMP["[CTX] CampaignContext set (auto)"]
    C2 -- No --> TB1["[N] TopBar CampaignPicker<br>(only accessible)"]
    TB1 -- select --> CTX_CAMP
    CTX_CAMP --> ROLE0["[CTX] CampaignRole resolved = CampaignGM"]
    ROLE0 --> MODE0["[CTX] Mode=GM (default)<br>(toggle available)"]
    MODE0 --> SHELL["[L] AppShell"]
    SHELL --> SIDEBAR["[N] Sidebar (GM view)<br>(shows GM-only pages)"] & TOPBAR["[N] TopBar<br>(workspace/campaign + mode toggle)"] & HOME["[P] Dashboard (GM)"]
    HOME --> CS["[P] CampaignSettings (GM-only)"] & ARCS["[P] Arcs (GM-only)"] & REL["[P] Relationships (GM-only)"] & QUESTS["[P] Quests (GM-only)"] & COND["[P] Conditions (GM-only)"] & PCS["[P] PCs (GM)"] & ITEMS["[P] Items"] & BAG["[P] Bag of Holding<br>(shared, campaign-scoped)"] & LORE["[P] Lore"] & MAPS["[P] Maps"] & NPCS["[P] NPCs"] & SESS["[P] Sessions"]
    CS --> CS_SAVE["[S] Save settings<br>(success/fail handled inline)"]
    ARCS --> ARCP["[P] ArcProfile (:arcId)<br>(view/edit toggle)"]
    REL --> RELP["[P] RelationshipProfile (:relId)"]
    QUESTS --> QUESTP["[P] QuestProfile (:questId)"]
    COND --> CONDP["[P] ConditionProfile (:conditionId)<br>(edit)"]
    PCS --> PC_CREATE["[A] Create New PC"] & PC_LIST["[P] PC Cards list<br>(all PCs in campaign)"]
    PC_LIST --> PCP["[P] PCProfile (:pcId)<br>(edit)"]
    PCP --> PC_ASSIGN["[A] Assign PC to player<br>(campaign membership link)"]
    ITEMS --> ITEMP["[P] ItemProfile (:itemId)"]
    ITEMP --> ITEM_ASSIGN["[A] Assign item to PC / Player<br>(allowed)"]
    LORE --> LOREP["[P] LoreProfile (:loreId)"]
    MAPS --> MAPP["[P] MapProfile (:mapId)"]
    NPCS --> NPCP["[P] NpcProfile (:npcId)"]
    SESS --> SESP["[P] SessionProfile (:sessionId)"]
    TOPBAR --> TOGGLE{"[G] Toggle mode?"}
    TOGGLE -- No --> END["[S] Continue in GM mode"]
    TOGGLE -- Yes --> MODEP["[CTX] Mode=Player (preview)"]
    MODEP --> GUARD["[L] Guards re-run<br>(block GM-only routes)"]
    GUARD --> HOME_P["[P] Dashboard (Player view)"]
    HOME_P --> P_ITEMS["[P] Items (Player)"] & P_PCS["[P] PCs (Player view)"] & P_SESS["[P] Sessions (Player)"]
```

---


## Flow 6 - Operational Failure Mini-Flows

```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart TB
    O1["[E] User opens /campaign/:id route"] --> G0["[L] RouteGuard pipeline"]
    G0 --> A{"[G] Authenticated?"}
    A -- No --> L["[P] Login"]
    A -- Yes --> W{"[G] Workspace accessible?"}
    W -- No --> WDEN["[P] WorkspaceAccessDenied<br>(CTA: Switch workspace + Go Home)"]
    W -- Yes --> C{"[G] Campaign accessible in workspace?"}
    C -- No --> CDEN["[P] CampaignAccessDenied<br>(CTA: Pick campaign in TopBar)"]
    C -- Yes --> OK["[S] Continue"]
    O2["[E] App loads but backend/network unstable"] --> NET{"[G] Network ok?"}
    NET -- No --> NETUI["[P] NetworkError (non-destructive)<br>- Keep AppShell visible<br>- Retry button<br>- Preserve intended route"]
    NETUI -- Retry --> NET
    NET -- Yes --> RESUME["[S] Resume current route"]
    O3["[E] Data request rejected by rules"] --> PERM["[P] AccessDenied (data)<br>(CTA: Go Home + Report)"]
    PERM --> SAFE["[S] No sensitive data shown"] & INV["[S] Invariants:<br>- Shell stays visible on recoverable failures<br>- Guards before fetch<br>- Recovery CTA always present<br>- No forbidden data flashes"]
    O4["[E] GM switches to Player mode<br>while on GM-only route"] --> MODE["[CTX] ModeContext toggled"]
    MODE --> REEVAL["[L] Guards re-run immediately"]
    REEVAL --> BLOCK["[P] NotAuthorized<br>(CTA: Go Dashboard)"]
    O5["[E] Deep-link /items/:id"] --> FETCH["[DATA] Fetch entity (scoped)"]
    FETCH --> EXISTS{"[G] Exists?"}
    EXISTS -- No --> NF["[P] NotFound<br>(CTA: Back to list + Go Home)"]
    EXISTS -- Yes --> RENDER["[S] Render entity"]
    BLOCK --> INV
    NETUI --> INV
    NF --> INV
    CDEN --> INV
    WDEN --> INV
```