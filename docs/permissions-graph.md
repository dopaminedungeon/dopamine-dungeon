```mermaid
---
config:
  theme: redux
  layout: fixed
---
flowchart LR
 subgraph s1["Legend"]
        LEGEND_OK["✅ Full access"]
        LEGEND_LIM["🟣 Limited action"]
        LEGEND_BL["⛔ Blocked / Hidden"]
        LEGEND_RO["🟡 Read-only"]
  end
    GM["🎲 GM"] --> GM_ARCS["Arcs / ArcProfile"] & GM_CSET["Campaign Settings"] & GM_COND["Conditions / ConditionProfile"] & GM_ITEMS["Items / ItemProfile"] & GM_LORE["Lore / LoreProfile"] & GM_MAPS["Maps / MapProfile"] & GM_NPCS["NPCs / NpcProfile"] & GM_PCS["PCs / PCProfile"] & GM_BAG["Bag of Holding"] & GM_QUESTS["Quests / QuestProfile"] & GM_REL["Relationships / RelationshipProfile"] & GM_SESS["Sessions / SessionProfile"]
    PL["🧑 Player"] --> PL_PCS["PC (own only)"] & PL_PCP["PCProfile (own)"] & PL_BAG["Bag of Holding"] & PL_ITEMS["Items"] & PL_ITEMP["ItemProfile<br>(self-assign)"] & PL_LORE["Lore / LoreProfile"] & PL_MAPS["Maps / MapProfile"] & PL_NPCS["NPCs / NpcProfile"] & PL_SESS["Sessions / SessionProfile"] & PL_ARCS["Arcs / ArcProfile"] & PL_CSET["Campaign Settings"] & PL_QUESTS["Quests / QuestProfile"] & PL_REL["Relationships / RelationshipProfile"] & PL_COND["Conditions"]

     LEGEND_OK:::ok
     LEGEND_LIM:::limited
     LEGEND_BL:::blocked
     LEGEND_RO:::ro
     GM:::header
     GM_ARCS:::ok
     GM_CSET:::ok
     GM_COND:::ok
     GM_ITEMS:::ok
     GM_LORE:::ok
     GM_MAPS:::ok
     GM_NPCS:::ok
     GM_PCS:::ok
     GM_BAG:::ok
     GM_QUESTS:::ok
     GM_REL:::ok
     GM_SESS:::ok
     PL:::header
     PL_PCS:::ok
     PL_PCP:::ok
     PL_BAG:::ok
     PL_ITEMS:::limited
     PL_ITEMP:::limited
     PL_LORE:::ro
     PL_MAPS:::ro
     PL_NPCS:::ro
     PL_SESS:::ro
     PL_ARCS:::blocked
     PL_CSET:::blocked
     PL_QUESTS:::blocked
     PL_REL:::blocked
     PL_COND:::blocked
    classDef ok fill:#dcfce7,stroke:#22c55e,stroke-width:2px,color:#064e3b
    classDef ro fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a8a
    classDef limited fill:#ede9fe,stroke:#8b5cf6,stroke-width:2px,color:#312e81
    classDef blocked fill:#fee2e2,stroke:#ef4444,stroke-width:2px,color:#7f1d1d
    classDef header fill:#f8fafc,stroke:#9ca3af,stroke-width:1px,color:#111827
