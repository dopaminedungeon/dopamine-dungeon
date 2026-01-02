# Error & Empty State Matrix

This document defines **expected error states, empty states, and recovery UX**
across the Dopamine Dungeon app.

Goal:
- No silent failures
- No blank screens
- Clear guidance without over-explaining
- Tone-aware (Player vs GM)

---

## Global Principles

- **Every page must render something**, even when data is missing
- Errors should:
  - explain *what happened*
  - explain *what the user can do*
- Players never see raw errors
- GMs may see more diagnostic hints
- Empty ≠ Error

---

## Authentication & App Boot

| Scenario | Type | Who | UI Behaviour |
|--------|------|-----|--------------|
| User not authenticated | Empty | All | Redirect to Login |
| Auth loading | Empty | All | Full-page spinner |
| Auth failed | Error | All | “Login failed. Try again.” |
| User authenticated but no campaigns | Empty | All | “No campaigns yet” CTA |

---

## Campaign Context

| Scenario | Type | Who | UI Behaviour |
|--------|------|-----|--------------|
| No campaign selected | Empty | All | Campaign selector |
| Campaign not found | Error | All | “Campaign not found” |
| No access to campaign | Error | Player | “You don’t have access” |
| Campaign loading | Empty | All | Skeleton UI |

---

## Characters (PCs)

### Characters List (Player)

| Scenario | Type | UI |
|-------|------|----|
| 0 PCs | Empty | “No characters assigned yet” |
| 1 PC | Empty | Auto-load PC profile |
| >1 PC | Empty | Card selection view |
| Failed to load PCs | Error | Retry + message |

---

### PC Profile

| Scenario | Type | Who | UI |
|--------|------|-----|----|
| PC not found | Error | All | “Character not found” |
| Player opens another PC | Error | Player | “Not your character” |
| Data loading | Empty | All | Skeleton |
| No inventory | Empty | All | “Bag is empty” |

---

## Bag of Holding

| Scenario | Type | Who | UI |
|--------|------|-----|----|
| Empty bag | Empty | All | “Bag of Holding is empty” |
| Add item success | Feedback | Player | Toast confirmation |
| Add item failed | Error | Player | “Could not add item” |
| Permission denied | Error | Player | “You can’t modify this” |

---

## Items

| Scenario | Type | Who | UI |
|--------|------|-----|----|
| No items in campaign | Empty | All | “No items yet” |
| Item not found | Error | All | “Item not found” |
| Player assigns item | Feedback | Player | “Item assigned” |
| Assign failed | Error | Player | Retry CTA |

---

## Lore

| Scenario | Type | Who | UI |
|--------|------|-----|----|
| No lore entries | Empty | All | “No lore discovered yet” |
| Lore loading | Empty | All | Skeleton |
| Lore not found | Error | All | “Lore entry missing” |

---

## Maps

| Scenario | Type | Who | UI |
|--------|------|-----|----|
| No maps | Empty | All | “No maps available” |
| Map missing | Error | All | “Map not found” |
| Map loading | Empty | All | Placeholder canvas |

---

## NPCs

| Scenario | Type | Who | UI |
|--------|------|-----|----|
| No NPCs | Empty | All | “No NPCs yet” |
| NPC not found | Error | All | “NPC not found” |
| Restricted info | Empty | Player | “Some info hidden by GM” |

---

## Sessions

| Scenario | Type | Who | UI |
|--------|------|-----|----|
| No sessions | Empty | All | “No sessions recorded yet” |
| Session missing | Error | All | “Session not found” |
| Session loading | Empty | All | Skeleton |

---

## Conditions (Special Case)

| Scenario | Type | Who | UI |
|--------|------|-----|----|
| Player opens Conditions | Error-like | Player | “GM-only information” |
| GM opens Conditions | Normal | GM | Full editor |
| Player affected by condition | Empty | Player | “You feel… something is wrong.” |

---

## Network & System Errors

| Scenario | Type | UI |
|--------|------|----|
| Firestore timeout | Error | Retry banner |
| Permission error | Error | Friendly denial |
| Unknown error | Error | “Something went wrong” |
| Partial data | Empty | Render what exists |

---

## Developer / Debug States (GM-only or Dev)

| Scenario | Type | UI |
|--------|------|----|
| Missing config | Error | Debug hint |
| Invalid route | Error | 404 page |
| Feature flag disabled | Empty | “Coming soon” |

---

## Definition of Done

A page is **done** when:
- It never renders blank
- Loading is visible
- Errors are understandable
- Players are never confused about *why* something is missing

If users ask:

> “Is this broken or is this intentional?”

Then the state is **not done yet**.