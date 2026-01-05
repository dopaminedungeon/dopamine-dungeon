## Permission Matrix (Campaign-scoped)

Legend:
- ✅ Allowed
- 🚫 Blocked → NotAuthorized
- 🟡 Allowed with conditions / special behaviour
- ✍️ Limited write action

### Pages & Profiles

| Area | Route/Page | CampaignPlayer | CampaignGM | Notes |
|---|---|---:|---:|---|
| Core | Dashboard | ✅ | ✅ | Default landing page after guards pass |
| PCs | PCs (section) | 🟡 | ✅ | Player: Characters tab behaviour depends on assignments |
| PCs | PCProfile | 🟡 | ✅ | Player: auto-load if exactly 1 assigned PC; otherwise via cards list |
| PCs | Bag of Holding | ✅ | ✅ | Always available to Player; shared, campaign-scoped |
| Items | Items | ✅ | ✅ | Read-only list for Player |
| Items | ItemProfile | ✅ | ✅ | Player can always assign item to self (✍️) |
| Lore | Lore | ✅ | ✅ | Read-only |
| Lore | LoreProfile | ✅ | ✅ | Read-only |
| Maps | Maps | ✅ | ✅ | Read-only |
| Maps | MapProfile | ✅ | ✅ | Read-only |
| NPCs | NPCs | ✅ | ✅ | Read-only |
| NPCs | NpcProfile | ✅ | ✅ | Read-only |
| Sessions | Sessions | ✅ | ✅ | Read-only |
| Sessions | SessionProfile | ✅ | ✅ | Read-only |
| GM-only | Arcs | 🚫 | ✅ | Blocked for Player even if deep-linked |
| GM-only | ArcProfile | 🚫 | ✅ | Same guard rule as Arcs |
| GM-only | CampaignSettings | 🚫 | ✅ | Campaign-scoped settings |
| GM-only | Conditions | 🚫 | ✅ | Hidden in Player sidebar; NotAuthorized if accessed via URL/mode switch |
| GM-only | ConditionProfile | 🚫 | ✅ | Same as Conditions |
| GM-only | Quests | 🚫 | ✅ | NotAuthorized for Player |
| GM-only | QuestProfile | 🚫 | ✅ | NotAuthorized for Player |
| GM-only | Relationships | 🚫 | ✅ | NotAuthorized for Player |
| GM-only | RelationshipProfile | 🚫 | ✅ | NotAuthorized for Player |

### Actions

| Action | CampaignPlayer | CampaignGM | Notes |
|---|---:|---:|---|
| Assign item to self (ItemProfile) | ✍️ | ✅ | Always available for Player (future toggle possible) |
| Create/edit Arcs | 🚫 | ✅ | GM-only |
| Create/edit Quests | 🚫 | ✅ | GM-only |
| Create/edit Relationships | 🚫 | ✅ | GM-only |
| Create/edit Conditions | 🚫 | ✅ | GM-only |
| Create new PC | 🚫 | ✅ | GM-only |
| Assign PC to player | 🚫 | ✅ | GM-only (campaign membership assignment) |
| Mode toggle (GM ↔ Player preview) | 🚫 | ✅ | Only CampaignGM can toggle; switching to Player mode blocks GM-only routes |
| Access GM-only routes while in Player mode | 🚫 | 🚫 | Even GM role is blocked in Player mode (NotAuthorized) |

### Player PC edge cases (PCs → Characters tab)

| Scenario | Behaviour |
|---|---|
| Player has **0** assigned PCs in campaign | Show “No character assigned yet” message in Characters tab; Bag of Holding remains available |
| Player has **1** assigned PC | Characters tab auto-loads that PCProfile directly (no card list) |
| Player has **2+** assigned PCs | Show card list; clicking opens PCProfile |

### Security invariants (applies everywhere)

- Guards protect **URLs**, not just sidebar visibility
- UI hiding is never trusted for security
- Policy checks happen before entity fetch
- No forbidden content flashes on screen
- Every blocked/empty state provides a recovery CTA (Go Home / pick campaign in TopBar)