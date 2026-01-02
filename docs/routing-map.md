```mermaid
---
config:
  theme: redux
  layout: fixed
---
flowchart LR
 subgraph CTX["[CTX] Providers wrapping Router"]
        CP["CampaignProvider"]
  end
    BR["[R] BrowserRouter"] --> RT["[R] Routes"]
    RT --> L["[L] AppLayout (global layout)"]
    L --> R_DASH["/  →  [P] DopamineDungeonDashboard"] & R_ITEMS["/items  →  [P] Items"] & R_NPCS["/npcs  →  [P] Npcs"] & R_SESS["/sessions  →  [P] Sessions"] & R_MAPS["/maps  →  [P] Maps"] & R_LORE["/lore  →  [P] Lore"] & R_ARCS["/arcs  →  [P] Arcs"] & R_QUESTS["/quests  →  [P] Quests"] & R_REL["/relationships  →  [P] Relationships"] & R_COND["/conditions  →  [P] Conditions"] & R_PCS["/pcs  →  [P] PCs (Characters tab / Bag tab)"] & R_SET["/settings  →  [P] Settings"] & R_CSET["/campaigns/settings  →  [P] CampaignSettings"]
    R_ITEMS --> R_ITEMP["/items/:id  →  [P] ItemProfile"]
    R_NPCS --> R_NPCP["/npcs/:id  →  [P] NpcProfile"]
    R_SESS --> R_SESSP["/sessions/:id  →  [P] SessionProfile"]
    R_MAPS --> R_MAPP["/maps/:id  →  [P] MapProfile"]
    R_LORE --> R_LOREP["/lore/:id  →  [P] LoreProfile"]
    R_ARCS --> R_ARCP["/arcs/:id  →  [P] ArcProfile"]
    R_QUESTS --> R_QUESTP["/quests/:id  →  [P] QuestProfile"]
    R_REL --> R_RELP["/relationships/:id  →  [P] RelationshipProfile"]
    R_COND --> R_CONDP["/conditions/:id  →  [P] ConditionProfile"]
    R_PCS --> R_BAG["/pcs/bag  →  [P] BagOfHolding"] & R_PCP["/pcs/:pcId  →  [P] PCProfile"]
    CP -. wraps .-> BR