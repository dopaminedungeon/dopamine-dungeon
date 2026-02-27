# Cross-Linking System — Allowed Link Combinations (v1.1)

This document defines the **canonical, locked set of allowed entity link combinations** for Dopamine Dungeon v1.

The goal of this system is to represent **narrative memory and mechanical state** across the campaign without introducing graph noise, ambiguity, or premature complexity.

---

## Entity Types

- **Session** — timeline anchor (when)
- **Quest** — structured objective (what)
- **Arc** — long-term narrative driver (why)
- **Lore** — worldbuilding substrate
- **Map** — location anchor
- **NPC** — non-player actor
- **PC** — player character
- **Item** — object with mechanical and narrative meaning
- **Condition** — mechanical state tracker
- **BagOfHolding** — special container entity (inventory state)

---

## Universal Rule

✅ **Session ↔ everything**

Sessions are the timeline spine of the campaign.  
Any entity may be linked to a Session to indicate *when it mattered*.

Allowed:
- Session ↔ Quest
- Session ↔ Arc
- Session ↔ Lore
- Session ↔ Map
- Session ↔ NPC
- Session ↔ PC
- Session ↔ Item
- Session ↔ Condition
- Session ↔ BagOfHolding

---

## Quest (Mid-Level Narrative Object)

Quests represent concrete objectives that span Sessions and may belong to multiple Arcs.

### Allowed
- ✅ Quest ↔ Session *(mandatory)*
- ✅ Quest ↔ NPC
- ✅ Quest ↔ PC
- ✅ Quest ↔ Item
- ✅ Quest ↔ Map
- ✅ Quest ↔ Lore
- ✅ Quest ↔ Condition
- ✅ Quest ↔ Arc *(many-to-many)*

### Not Allowed (v1)
- 🚫 Quest ↔ Quest
- 🚫 Quest ↔ BagOfHolding

---

## Arc (Narrative Connective Tissue)

Arcs aggregate Quests, Sessions, and entities into long-term storylines.

### Allowed
- ✅ Arc ↔ Session
- ✅ Arc ↔ Quest
- ✅ Arc ↔ NPC
- ✅ Arc ↔ PC
- ✅ Arc ↔ Item
- ✅ Arc ↔ Map
- ✅ Arc ↔ Lore
- ✅ Arc ↔ Condition

### Not Allowed (v1)
- 🚫 Arc ↔ Arc

---

## Lore (Worldbuilding Substrate)

Lore explains origins, context, and hidden truths.

### Allowed
- ✅ Lore ↔ Session
- ✅ Lore ↔ Quest
- ✅ Lore ↔ Arc
- ✅ Lore ↔ NPC
- ✅ Lore ↔ PC
- ✅ Lore ↔ Item
- ✅ Lore ↔ Map
- ✅ Lore ↔ Condition

### Not Allowed (v1)
- 🚫 Lore ↔ Lore

---

## Map (Location Anchor)

Maps represent physical or conceptual locations.

### Allowed
- ✅ Map ↔ Session
- ✅ Map ↔ Quest
- ✅ Map ↔ Arc
- ✅ Map ↔ NPC
- ✅ Map ↔ PC
- ✅ Map ↔ Item
- ✅ Map ↔ Lore

### Not Allowed (v1)
- 🚫 Map ↔ Map

---

## NPC (Actor)

Non-player characters participate in story and mechanics.

### Allowed
- ✅ NPC ↔ Session
- ✅ NPC ↔ Quest
- ✅ NPC ↔ Arc
- ✅ NPC ↔ Lore
- ✅ NPC ↔ Map
- ✅ NPC ↔ Item
- ✅ NPC ↔ Condition
- ✅ NPC ↔ NPC
- ✅ NPC ↔ PC

---

## PC (Player Character)

Player characters are actors with mechanical state.

### Allowed
- ✅ PC ↔ Session
- ✅ PC ↔ Quest
- ✅ PC ↔ Arc
- ✅ PC ↔ Lore
- ✅ PC ↔ Map
- ✅ PC ↔ Item
- ✅ PC ↔ Condition
- ✅ PC ↔ NPC

### Not Allowed (v1)
- 🚫 PC ↔ PC  
  *(PC-to-PC social bonds may be handled by a dedicated Relationships module later.)*

---

## Item (Object)

Items have both mechanical and narrative importance.

### Allowed
- ✅ Item ↔ Session
- ✅ Item ↔ Quest
- ✅ Item ↔ Arc
- ✅ Item ↔ Lore
- ✅ Item ↔ Map
- ✅ Item ↔ NPC
- ✅ Item ↔ PC
- ✅ Item ↔ Condition
- ✅ Item ↔ BagOfHolding *(required)*

### Not Allowed (v1)
- 🚫 Item ↔ Item

---

## Condition (Mechanical State Tracker)

Conditions represent gameplay-affecting states.

### Allowed
- ✅ Condition ↔ Session
- ✅ Condition ↔ Quest
- ✅ Condition ↔ Arc
- ✅ Condition ↔ Lore
- ✅ Condition ↔ Item
- ✅ Condition ↔ NPC
- ✅ Condition ↔ PC

### Not Allowed (v1)
- 🚫 Condition ↔ Condition

---

## Bag of Holding (Special Container)

The Bag of Holding represents **inventory state**, not narrative presence.

### Allowed
- ✅ BagOfHolding ↔ Item *(required)*
- ✅ BagOfHolding ↔ Session *(recommended for inventory history)*

### Not Allowed (v1)
- 🚫 BagOfHolding ↔ NPC
- 🚫 BagOfHolding ↔ PC
- 🚫 BagOfHolding ↔ Map
- 🚫 BagOfHolding ↔ Lore
- 🚫 BagOfHolding ↔ Arc
- 🚫 BagOfHolding ↔ Quest
- 🚫 BagOfHolding ↔ Condition

---

## Hard “No” List (v1 Summary)

The following combinations are explicitly disallowed in v1:

- 🚫 Item ↔ Item
- 🚫 Map ↔ Map
- 🚫 Arc ↔ Arc
- 🚫 Lore ↔ Lore
- 🚫 Quest ↔ Quest
- 🚫 Condition ↔ Condition
- 🚫 BagOfHolding ↔ anything except Item / Session

---

## Design Notes

- All links are **symmetric**.
- All links imply **importance** (no strength/weight metadata).
- Visibility is handled per-link (`GM` / `Player`).
- Players never see hidden or redacted links.
- This specification is intentionally conservative and extensible.

---

**Status:** Locked for v1  
**Next Step:** Define relationship labels per allowed combination

---

---

## Relationship Labels (v1)

This section defines the **canonical relationship labels** used to describe *why* two entities are linked.

Labels are:
- **required** for every link
- **symmetric** (the same link, read differently per entity)
- **semantic**, not decorative
- used to determine **profile subsections and headings**

There is intentionally **no concept of relationship strength**.  
If a link exists, it is meaningful.

---

## General Rules

- Each allowed entity pair has a **restricted label set**
- Labels describe **function**, not flavor
- UI wording may adapt per entity (e.g. “Appears in” vs “Includes”)
- Labels are stable identifiers (safe for Firebase + filtering)

---

## Session Relationship Labels

### Session ↔ NPC
- `present`
- `mentioned`
- `antagonist`
- `ally`

### Session ↔ PC
- `present`
- `spotlighted`

### Session ↔ Item
- `introduced`
- `used`
- `consumed`
- `lost`

### Session ↔ Map
- `visited`
- `revealed`

### Session ↔ Lore
- `revealed`
- `hinted`

### Session ↔ Quest
- `started`
- `advanced`
- `completed`
- `failed`

### Session ↔ Arc
- `advanced`
- `pivoted`

### Session ↔ Condition
- `applied`
- `worsened`
- `improved`
- `removed`

### Session ↔ BagOfHolding
- `inventory_changed`

---

## Quest Relationship Labels

### Quest ↔ NPC
- `given_by`
- `target`
- `ally`

### Quest ↔ PC
- `assigned_to`
- `personal`

### Quest ↔ Item
- `requires`
- `rewards`
- `unlocks`

### Quest ↔ Map
- `takes_place_in`
- `leads_to`

### Quest ↔ Lore
- `based_on`
- `reveals`

### Quest ↔ Condition
- `applies`
- `resolves`

### Quest ↔ Arc
- `advances`
- `belongs_to`

---

## Arc Relationship Labels

### Arc ↔ NPC
- `involved`
- `antagonist`
- `ally`

### Arc ↔ PC
- `central_to`
- `affected_by`

### Arc ↔ Item
- `key_item`

### Arc ↔ Map
- `set_in`

### Arc ↔ Lore
- `rooted_in`

### Arc ↔ Condition
- `driven_by`

---

## Lore Relationship Labels

### Lore ↔ NPC
- `describes`
- `origin_of`

### Lore ↔ PC
- `connected_to`

### Lore ↔ Item
- `explains`
- `origin_of`

### Lore ↔ Map
- `describes`
- `historical_site`

### Lore ↔ Condition
- `origin_of`

---

## Map Relationship Labels

### Map ↔ NPC
- `resides_in`
- `controls`

### Map ↔ PC
- `home`
- `current_location`

### Map ↔ Item
- `found_in`
- `hidden_in`

---

## NPC Relationship Labels

### NPC ↔ NPC
- `ally`
- `enemy`
- `family`
- `associate`

### NPC ↔ PC
- `ally`
- `enemy`
- `mentor`
- `patron`
- `romantic`

### NPC ↔ Item
- `owns`
- `uses`

### NPC ↔ Condition
- `affected_by`

---

## PC Relationship Labels

### PC ↔ Item
- `equipped`
- `carried`
- `attuned`

### PC ↔ Condition
- `affected_by`

---

## Item Relationship Labels

### Item ↔ Condition
- `applies`
- `prevents`
- `cures`

### Item ↔ BagOfHolding
- `contained_in`
- `removed_from`

---

## Condition Relationship Labels

### Condition ↔ PC / NPC
- `affects`

---

## Design Notes

- Labels are intentionally **non-exhaustive**; additions require design review
- Labels may drive:
  - UI grouping
  - filtering
  - future automation
- Narrative flavor belongs in **notes**, not labels

---

**Status:** Locked for v1  
**Next Section (Optional):** UI Authoring Flows & Defaults

---

## UI Sections & Link Presentation (v1)

This section defines **where and how cross-links are displayed in the UI**.

The goal is to make relationships:
- discoverable
- readable
- non-overwhelming
- consistent across entity types

Links are grouped into **explicit semantic sections**, not a generic “Connections” list.

---

## Core Principles

1. **Sections reflect player mental models**, not database structure
2. **Sessions are the narrative spine**
3. **Mechanical state is visually separated from narrative context**
4. **Symmetric links may appear under different section names**
5. **Players only see sections populated with player-visible links**

---

## Session Profile Sections

Sessions act as the **central aggregation point** for links.

### Sections (in order)

Session Profile
├─ Quests
├─ NPCs Present
├─ PCs Present
├─ Items Used / Introduced
├─ Conditions Changed
├─ Locations Visited
├─ Lore Revealed
├─ Arcs Advanced
├─ Inventory Changes (Bag of Holding)

### Notes
- This is where **most links are authored**
- Sections may be hidden if empty
- Session pages should feel like a **timeline snapshot**

---

## Quest Profile Sections

Quests represent structured objectives.

Quest Profile
├─ Sessions Involved
├─ NPCs Involved
├─ PCs Involved
├─ Items Required / Rewarded
├─ Locations
├─ Conditions Applied / Resolved
├─ Arcs This Quest Advances
├─ Lore Context

### Notes
- Quests are **stateful** (started / advanced / completed)
- Sections reinforce *what the quest touches*

---

## Arc Profile Sections

Arcs are long-term narrative drivers.

Arc Profile
├─ Quests in This Arc
├─ Sessions Advancing Arc
├─ NPCs Involved
├─ PCs Central to Arc
├─ Key Items
├─ Locations
├─ Lore Foundations
├─ Conditions Driving Arc

### Notes
- Arcs are **aggregators**
- Order emphasizes progression (Quests/Sessions first)

---

## NPC Profile Sections

NPCs are actors with narrative and mechanical presence.

NPC Profile
├─ Sessions Appeared In
├─ Quests Involved
├─ Related NPCs
├─ Related PCs
├─ Items Owned / Used
├─ Conditions Affecting NPC
├─ Known Locations
├─ Arcs Involved
├─ Lore References

### Notes
- Social relationships are explicit
- Mechanical effects (Conditions) are clearly separated

---

## PC Profile Sections

Player Characters are actors with mechanical state.

PC Profile
├─ Sessions Appeared In
├─ Quests Involved
├─ Related NPCs
├─ Items Equipped / Carried
├─ Conditions Affecting PC
├─ Known Locations
├─ Arcs Involved
├─ Lore Connections

### Notes
- PC ↔ PC relationships are intentionally excluded in v1
- Inventory and Conditions are emphasized

---

## Item Profile Sections

Items combine narrative meaning with mechanical impact.

Item Profile
├─ Sessions Used / Introduced
├─ Current Holder
├─ Previous Holders
├─ Conditions Applied / Prevented
├─ Related Quests
├─ Related Arcs
├─ Locations Found
├─ Lore Origins

### Notes
- **Holder** may be PC, NPC, or BagOfHolding
- History matters (not just current state)

---

## Map Profile Sections

Maps represent physical or conceptual locations.

Map Profile
├─ Sessions Visited
├─ Quests Occurring Here
├─ NPCs Present
├─ PCs Present
├─ Items Found Here
├─ Arcs Set Here
├─ Lore Associated

### Notes
- Map ↔ Map relationships are intentionally excluded
- Locations are narrative anchors

---

## Lore Profile Sections

Lore is contextual and explanatory.

Lore Profile
├─ Sessions Where Revealed
├─ Quests Based On Lore
├─ NPCs Described
├─ PCs Connected
├─ Items Explained
├─ Locations Mentioned
├─ Arcs Rooted in Lore
├─ Conditions Explained

### Notes
- Lore rarely drives action directly
- It contextualizes everything else

---

## Condition Profile Sections

Conditions are **mechanical state trackers**.

Condition Profile
├─ Applied To (PCs / NPCs)
├─ Sessions Where Changed
├─ Source (Item / Event / Quest)
├─ Related Arcs
├─ Lore Origin (if applicable)

### Notes
- Conditions should feel closer to **combat trackers** than lore
- Changes over time matter

---

## Bag of Holding Profile Sections

Bag of Holding is a **container with state**.

Bag of Holding
├─ Items Currently Contained
├─ Items Removed
├─ Sessions Where Inventory Changed

### Notes
- BagOfHolding does not participate in narrative links
- It is purely mechanical and stateful

---

## Visibility Behavior

- Sections render **only if at least one visible link exists**
- GM sees all sections
- Player sees only fully player-visible links
- No placeholder or redacted sections are shown

---

## Authoring Behavior (Preview)

- Most links are authored from:
  - Session creation / editing
  - Profile pages (secondary)
- Defaults:
  - New links → GM-only
  - Session-originated links preferred

(Full authoring rules defined in the next section.)

---

**Status:** Locked for v1  
**Next Section:** UI Authoring Flows & Defaults

---

## UI Authoring Flows & Defaults (v1)

This section defines **how cross-links are created, edited, and removed** in the UI.

The goal is to make authoring:
- fast during prep and post-session notes,
- safe (no invalid links),
- consistent across modules,
- and invisible to Players unless explicitly revealed.

---

## Authoring Priorities

### Primary authoring surface: **Session editing**
Most links should be created from Sessions because Sessions are the campaign timeline spine.

### Secondary authoring surface: **Profile pages**
Profile pages may add links, but should feel like “cleanup and enrichment,” not the main workflow.

---

## Link Creation Rules

### Required fields
Every new link must have:
- **Entity A** (type + id)
- **Entity B** (type + id)
- **Label** (from the allowed label set for the pair)
- **Visibility** (`GM` or `Player`)

### Defaults
- **Visibility default:** `GM`
- **Label default:** none (must be selected)
- **Note default:** empty (optional)
- **Created-in-session:** set automatically when created from a Session editor

### Validation on create
A link can be created only if:
- the entity pair is in **Allowed Link Combinations (v1.1)**
- the chosen label is allowed for that pair (Relationship Labels v1)
- the link does not already exist in an equivalent form (see “Duplicate rules”)

---

## Symmetry & Duplicate Rules

Links are **symmetric**.

### Symmetry behavior
- Creating A ↔ B automatically makes it visible on **both** profiles.
- The link is stored once and rendered in both places.

### Duplicate prevention
Two links are considered duplicates if all of the following match:
- the same unordered entity pair (A,B) regardless of direction
- the same `label`
- the same `visibility`

If a user tries to add a duplicate:
- the UI should refuse and show a small inline message (no modal)

---

## Editing Links

### What can be edited
- `label`
- `visibility`
- `note`

### What cannot be edited
- the linked entity endpoints (A/B)

To change endpoints, the user must delete the link and create a new one.

---

## Visibility Workflow (GM vs Player)

### Creation defaults
- New links are `GM` by default.

### Revealing to players
- Changing a link’s visibility from `GM` → `Player` is considered a **reveal**.
- Players do **not** see placeholders for hidden links.

### Player-mode restrictions
- Players cannot create, edit, or delete links.
- Players only see links with `visibility = Player`.

---

## Deleting Links

### Delete behavior
- Deleting a link removes it from **both** entities (because links are symmetric).

### Safety
- Deletion should be confirmed (lightweight confirmation UI).

---

## Authoring Flows by Module

### Session editor (primary)
When editing a Session, provide dedicated selectors that create links:
- **Quests:** `started / advanced / completed / failed`
- **NPCs:** `present / mentioned / ally / antagonist`
- **PCs:** `present / spotlighted`
- **Items:** `introduced / used / consumed / lost`
- **Conditions:** `applied / worsened / improved / removed`
- **Maps:** `visited / revealed`
- **Lore:** `revealed / hinted`
- **Arcs:** `advanced / pivoted`
- **Bag of Holding:** `inventory_changed`

The Session editor should:
- pre-filter options to only valid entity types for that section
- enforce allowed labels for that section
- set `createdInSession = this session`
- default visibility to `GM`

### Profile pages (secondary)
On each profile page, allow adding links via an “Add Link” control that:
- limits selectable entity types to allowed combinations
- shows only allowed labels for that pair
- defaults visibility to `GM`

---

## Special Mechanical Rules

### Bag of Holding ↔ Item (stateful container)
The Bag of Holding relationship is mechanical and must remain focused.

Rules:
- An **Item can be contained in only one BagOfHolding at a time**.
- Adding an Item to a Bag:
  - creates `BagOfHolding ↔ Item` with label `contained_in`
- Removing an Item from a Bag:
  - updates the existing relationship to `removed_from` (or moves it to a “removed history” list)
- Inventory changes should optionally create `BagOfHolding ↔ Session` (`inventory_changed`).

### Condition links (mechanical tracker)
Condition links should support gameplay tracking.

Rules:
- Condition must always be linked to at least one **PC or NPC** (its target).
- Condition changes over time should be linked to Sessions using:
  - `applied / worsened / improved / removed`

---

## UX Guardrails

- Sections render only if they contain at least one **visible** link.
- GM-only link management UI is hidden in Player mode.
- Notes are optional and should be short; long narrative belongs in entity fields.

---

**Status:** Locked for v1