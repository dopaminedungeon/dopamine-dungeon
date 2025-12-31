```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
    A(["Start (App Load)"]) --> n2["[G] Authenticated?"]
    n2 -- No --> n3["[P] Login"]
    n2 -- Yes --> n4["[L] AppShell"]
    n4 -- default --> n1["[P] DopamineDungeonDashboard"]
    n4 --> n5["[N] Sidebar"] & n6["[N] TopBar"]
    n5 --> n7["[P] Arcs"] & n8["[P] CampaignSettings"] & n9["[P] Conditions"] & n10["[P] DopamineDungeonDashboard"] & n11["[P] Items"] & n12["[P] Lore"] & n13["[P] Maps"] & n14["[P] Npcs"] & n15["[P] PCs"] & n16["[P] Quests"] & n17["[P] Relationships"] & n18["[P] Sessions"]

    %% -------- Arcs subgraph --------
    n7 --> AR_A
    subgraph ARCS_FLOW["Arcs – internal flow"]
      direction LR
      AR_A["[P] Arcs"] --> AR_G{"[G] GM Mode? (ModeContext)"}
      AR_G -- Yes --> AR_C["[C] Cards (src/components/Cards.jsx)"]
      AR_G -- No --> AR_NA["[P] NotAuthorized"]
      AR_C -- click arc card --> AR_AP["[P] ArcProfile (:arcId)"]
      AR_AP -- back --> AR_A
    end

         %% ---- ArcProfile subgraph (nested detail) ----
  subgraph ARC_PROFILE_FLOW["ArcProfile – TO-BE flow (GM-only)"]
    direction LR
    AR_AP --> AP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

    AP_GM -- No --> AP_NA["[P] NotAuthorized"]
    AP_NA -- back --> AP_BACK["[P] DopamineDungeonDashboard / Arcs"]

    AP_GM -- Yes --> AP_VIEW["[P] ArcProfile (view)"]
    AP_VIEW -- toggle Edit/Done --> AP_EDIT["[C] Edit mode (inline fields)"]
    AP_EDIT -- Done --> AP_VIEW
  end

    %% -------- CampaignSettings subgraph (TO-BE) --------
    n8 --> CS_P
    subgraph CAMPAIGNSETTINGS_FLOW["CampaignSettings – TO-BE flow"]
      direction LR
      CS_P["[P] CampaignSettings"] --> CS_GM{"[G] GM Mode? (ModeContext)"}
      CS_GM -- No --> CS_NA["[P] NotAuthorized"]
      CS_GM -- Yes --> CS_SEL{"[G] Campaign selected? (CampaignContext)"}
      CS_SEL -- No --> CS_MISS["[P] MissingCampaign"]
      CS_SEL -- Yes --> CS_CTX["[CTX] CampaignContext"]
      CS_CTX -- save success --> CS_P
      CS_CTX -- save failure --> CS_P
    end


    %% -------- TopBar Campaign Chooser subgraph (TO-BE) --------
    n6 --> TB_TB
    subgraph TOPBAR_CAMPAIGN_CHOOSER_FLOW["TopBar – Campaign Chooser (TO-BE)"]
      direction LR
      TB_TB["[N] TopBar"] --> TB_CH["[N] CampaignChooser (dropdown)"]
      TB_CH -- select campaign --> TB_CTX["[CTX] CampaignContext"]
      TB_CH -- clear / none selected --> TB_CTX
      TB_CTX --> TB_G{"[G] Campaign selected? (CampaignContext)"}
      TB_G -- No --> TB_MISS["[P] MissingCampaign"]
      TB_G -- Yes --> TB_PAGES["[P] Campaign-dependent pages"]
    end
    
        %% -------- Conditions subgraph (TO-BE) --------
    n9 --> COND_P
    subgraph CONDITIONS_FLOW["Conditions – TO-BE flow"]
      direction LR
      COND_P["[P] Conditions"] --> COND_GM{"[G] GM Mode? (ModeContext)"}

      COND_GM -- No --> COND_NA["[P] NotAuthorized"]
      COND_GM -- Yes --> COND_SEL{"[G] Campaign selected? (CampaignContext)"}

      COND_SEL -- No --> COND_MISS["[P] MissingCampaign"]
      COND_SEL -- Yes --> COND_CTX["[CTX] CampaignContext"]

      COND_CTX --> COND_LIST["[P] Conditions (list)"]
      COND_LIST -- click condition --> COND_PROF["[P] ConditionProfile (:conditionId)"]

      COND_PROF -- back --> COND_P
    end

     %% ---- ConditionProfile subgraph (nested detail) ----
  subgraph CONDITION_PROFILE_FLOW["ConditionProfile – TO-BE flow (GM-only)"]
    direction LR

    COND_PROF --> CP_FOUND{"[G] Condition exists? (Data)"}

    CP_FOUND -- No --> CP_404["[P] Condition Not Found"]
    CP_404 -- back --> CP_BACK_LIST["[P] Conditions"]

    CP_FOUND -- Yes --> CP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}
    CP_GM -- No --> CP_NA["[P] NotAuthorized"]
    CP_NA -- return --> CP_BACK_DASH["[P] DopamineDungeonDashboard"]

    CP_GM -- Yes --> CP_VIEW["[P] ConditionProfile (view mode)"]
    CP_VIEW -- click Edit --> CP_EDIT["[C] Edit mode (inline fields)"]
    CP_EDIT -- click Save --> CP_VIEW
  end

        %% -------- Items subgraph (TO-BE) --------
    n11 --> IT_P
    subgraph ITEMS_FLOW["Items – TO-BE flow"]
      direction LR
      IT_P["[P] Items"] --> IT_SEL{"[G] Campaign selected? (CampaignContext)"}

      IT_SEL -- No --> IT_MISS["[P] MissingCampaign"]
      IT_SEL -- Yes --> IT_CTX["[CTX] CampaignContext"]

      IT_CTX --> IT_GM{"[G] GM Mode? (ModeContext)"}

      IT_GM -- Yes --> IT_ALL["[P] Items (all + GM-only visible)"]
      IT_GM -- No --> IT_PUB["[P] Items (public only)"]

      IT_ALL -- click item --> IT_PROF["[P] ItemProfile (:itemId)"]
      IT_PUB -- click item --> IT_PROF

      IT_PROF -- back --> IT_P

      IT_GM -- Yes --> IT_ADD["[C] CreateItemModal"]
      IT_ADD -- create success --> IT_ALL
      IT_ADD -- cancel --> IT_ALL
    end

      %% ---- ItemProfile subgraph (nested detail) ----
  subgraph ITEM_PROFILE_FLOW["ItemProfile – TO-BE flow"]
    direction LR

    IT_PROF --> IP_FOUND{"[G] Item exists? (Data)"}

    IP_FOUND -- No --> IP_404["[P] Item Not Found"]
    IP_404 -- back --> IP_BACK_LIST["[P] Items"]

    IP_FOUND -- Yes --> IP_VIS{"[G] Visible to user? (ModeContext + item.visibility + ?mode override)"}

    IP_VIS -- No --> IP_NA["[P] NotAuthorized"]
    IP_NA -- back --> IP_BACK_LIST

    IP_VIS -- Yes --> IP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

    IP_GM -- Yes --> IP_VIEW["[P] ItemProfile (view mode)"]
    IP_GM -- No --> IP_VIEW

    IP_VIEW -- click Edit --> IP_EDIT["[C] Edit mode (inline fields)"]
    IP_EDIT -- click Save --> IP_VIEW
  end
 
    %% -------- Lore subgraph (TO-BE) --------
    n12 --> LO_P
    subgraph LORE_FLOW["Lore – TO-BE flow"]
      direction LR
      LO_P["[P] Lore"] --> LO_SEL{"[G] Campaign selected? (CampaignContext)"}

      LO_SEL -- No --> LO_MISS["[P] MissingCampaign"]
      LO_SEL -- Yes --> LO_CTX["[CTX] CampaignContext"]

      LO_CTX --> LO_GM{"[G] GM Mode? (ModeContext)"}

      LO_GM -- Yes --> LO_ALL["[P] Lore (all + gm-only visible)"]
      LO_GM -- No --> LO_PUB["[P] Lore (public only)"]

      LO_ALL -- click lore entry --> LO_PROF["[P] LoreProfile (:loreId)"]
      LO_PUB -- click lore entry --> LO_PROF

      LO_PROF -- back --> LO_P

      LO_GM -- Yes --> LO_ADD["[C] CreateLoreModal"]
      LO_ADD -- create success --> LO_ALL
      LO_ADD -- cancel --> LO_ALL
    end

      %% ---- LoreProfile subgraph (nested detail) ----
  subgraph LORE_PROFILE_FLOW["LoreProfile – TO-BE flow"]
    direction LR

    LO_PROF --> LP_FOUND{"[G] Lore exists? (Data)"}

    LP_FOUND -- No --> LP_404["[P] Lore Not Found"]
    LP_404 -- back --> LP_BACK_LIST["[P] Lore"]

    LP_FOUND -- Yes --> LP_VIS{"[G] Visible to user? (ModeContext + lore.visibility + ?mode override)"}

    LP_VIS -- No --> LP_NA["[P] NotAuthorized"]
    LP_NA -- back --> LP_BACK_LIST

    LP_FOUND -- Yes --> LP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

    LP_GM -- Yes --> LP_VIEW["[P] LoreProfile (view mode)"]
    LP_GM -- No --> LP_VIEW

    LP_VIEW -- click Edit --> LP_EDIT["[C] Edit mode (inline fields)"]
    LP_EDIT -- click Save --> LP_VIEW
  end

        %% -------- Maps subgraph (TO-BE) --------
    n13 --> MAP_P
    subgraph MAPS_FLOW["Maps – TO-BE flow"]
      direction LR
      MAP_P["[P] Maps"] --> MAP_SEL{"[G] Campaign selected? (CampaignContext)"}

      MAP_SEL -- No --> MAP_MISS["[P] MissingCampaign"]
      MAP_SEL -- Yes --> MAP_CTX["[CTX] CampaignContext"]

      MAP_CTX --> MAP_GM{"[G] GM Mode? (ModeContext)"}

      MAP_GM -- Yes --> MAP_ALL["[P] Maps (all + gm-only visible)"]
      MAP_GM -- No --> MAP_PUB["[P] Maps (public only)"]

      MAP_ALL -- click map --> MAP_PROF["[P] MapProfile (:mapId)"]
      MAP_PUB -- click map --> MAP_PROF

      MAP_PROF -- back --> MAP_P

      MAP_GM -- Yes --> MAP_ADD["[C] CreateMapModal"]
      MAP_ADD -- create success --> MAP_ALL
      MAP_ADD -- cancel --> MAP_ALL
    end

      %% ---- MapProfile subgraph (nested detail) ----
  subgraph MAP_PROFILE_FLOW["MapProfile – TO-BE flow"]
    direction LR

    MAP_PROF --> MP_FOUND{"[G] Map exists? (Data)"}

    MP_FOUND -- No --> MP_404["[P] Map Not Found"]
    MP_404 -- back --> MP_BACK_LIST["[P] Maps"]

    MP_FOUND -- Yes --> MP_VIS{"[G] Visible to user? (ModeContext + map.visibility + ?mode override)"}

    MP_VIS -- No --> MP_NA["[P] NotAuthorized"]
    MP_NA -- back --> MP_BACK_LIST

    MP_VIS -- Yes --> MP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

    MP_GM -- Yes --> MP_VIEW["[P] MapProfile (view mode)"]
    MP_GM -- No --> MP_VIEW

    MP_VIEW -- click Edit --> MP_EDIT["[C] Edit mode (inline fields)"]
    MP_EDIT -- click Save --> MP_VIEW
  end

        %% -------- NPCs subgraph (TO-BE) --------
    n14 --> NPC_P
    subgraph NPCS_FLOW["NPCs – TO-BE flow"]
      direction LR
      NPC_P["[P] NPCs"] --> NPC_SEL{"[G] Campaign selected? (CampaignContext)"}

      NPC_SEL -- No --> NPC_MISS["[P] MissingCampaign"]
      NPC_SEL -- Yes --> NPC_CTX["[CTX] CampaignContext"]

      NPC_CTX --> NPC_GM{"[G] GM Mode? (ModeContext)"}

      NPC_GM -- Yes --> NPC_ALL["[P] NPCs (all + gm-only visible)"]
      NPC_GM -- No --> NPC_PUB["[P] NPCs (public only)"]

      NPC_ALL -- click npc --> NPC_PROF["[P] NpcProfile (:npcId)"]
      NPC_PUB -- click npc --> NPC_PROF

      NPC_PROF -- back --> NPC_P

      NPC_GM -- Yes --> NPC_ADD["[C] CreateNpcModal"]
      NPC_ADD -- create success --> NPC_ALL
      NPC_ADD -- cancel --> NPC_ALL
    end

      %% ---- NpcProfile subgraph (nested detail) ----
  subgraph NPC_PROFILE_FLOW["NpcProfile – TO-BE flow"]
    direction LR

    NPC_PROF --> NP_FOUND{"[G] NPC exists? (Data)"}

    NP_FOUND -- No --> NP_404["[P] NPC Not Found"]
    NP_404 -- back --> NP_BACK_LIST["[P] NPCs"]

    NP_FOUND -- Yes --> NP_VIS{"[G] Visible to user? (ModeContext + npc.visibility + ?mode override)"}

    NP_VIS -- No --> NP_NA["[P] NotAuthorized"]
    NP_NA -- back --> NP_BACK_LIST

    NP_VIS -- Yes --> NP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

    NP_GM -- Yes --> NP_VIEW["[P] NpcProfile (view mode)"]
    NP_GM -- No --> NP_VIEW

    NP_VIEW -- click Edit --> NP_EDIT["[C] Edit mode (inline fields)"]
    NP_EDIT -- click Save --> NP_VIEW
  end

    %% -------- PCs subgraph (TO-BE, player count logic) --------
    n15 --> PC_P
    subgraph PCS_FLOW["PCs – TO-BE flow (tabs + player count logic)"]
      direction LR

      PC_P["[P] PCs (/pcs)"] --> PC_SEL{"[G] Campaign selected? (CampaignContext)"}

      PC_SEL -- No --> PC_MISS["[P] MissingCampaign"]
      PC_SEL -- Yes --> PC_HOME["[P] PCs (Tabs: Characters | Bag of Holding)"]

      %% Tabs
      PC_HOME -- tab: Bag of Holding --> PC_BAG["[P] PCs – BagOfHolding tab"]
      PC_HOME -- tab: Characters --> PC_GM{"[G] GM Mode? (ModeContext)"}

      %% GM Characters tab: list + create
      PC_GM -- Yes --> PC_ALL["[P] Characters (GM: all profiles list/cards)"]
      PC_ALL -- click pc card --> PC_PROF["[P] PCProfile (:pcId)"]
      PC_GM -- Yes --> PC_ADD["[C] CreatePcModal"]
      PC_ADD -- create success --> PC_ALL
      PC_ADD -- cancel --> PC_ALL

      %% Player Characters tab: conditional rendering based on assigned PCs count
      PC_GM -- No --> PC_AUTH{"[G] Authenticated? (Auth)"}
      PC_AUTH -- No --> PC_LOGIN["[P] Login"]
      PC_AUTH -- Yes --> PC_COUNT{"[G] Assigned PCs in campaign? (count)"}

      PC_COUNT -- 0 --> PC_NA["[P] NotAuthorized"]
      PC_COUNT -- 1 --> PC_INLINE["[P] PCProfile (inline: my only PC)"]
      PC_COUNT -- 2+ --> PC_MANY["[P] Characters (Player: my PCs list/cards)"]

      PC_MANY -- click pc card --> PC_SELF_PROF["[P] PCProfile (:pcId)"]
    end

      PC_PROF --> PCP_ENTRY
PC_SELF_PROF --> PCP_ENTRY
PC_INLINE --> PCP_ENTRY
  %% ---- PCProfile subgraph (nested detail) ----
  subgraph PC_PROFILE_FLOW["PCProfile – TO-BE flow (assignment + GM edit)"]
    direction LR

    PCP_ENTRY --> PCP_FOUND{"[G] PC exists? (Data)"}

    PCP_FOUND -- No --> PCP_404["[P] PC Not Found"]
    PCP_404 -- back --> PCP_BACK["[P] PCs"]

    PCP_FOUND -- Yes --> PCP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

    %% GM path
    PCP_GM -- Yes --> PCP_VIEW["[P] PCProfile (view mode)"]
    PCP_VIEW -- click Edit --> PCP_EDIT["[C] Edit mode (inline fields)"]
    PCP_EDIT -- click Save --> PCP_VIEW

    %% Player path
    PCP_GM -- No --> PCP_AUTH{"[G] Authenticated? (Auth)"}
    PCP_AUTH -- No --> PCP_LOGIN["[P] Login"]
    PCP_AUTH -- Yes --> PCP_ALLOWED{"[G] Assigned to this PC in campaign? (Assignment)"}

    PCP_ALLOWED -- No --> PCP_NA["[P] NotAuthorized"]
    PCP_ALLOWED -- Yes --> PCP_VIEW_P["[P] PCProfile (player view)"]
  end

    %% ---- BagOfHolding subgraph (nested detail) ----
  subgraph BAG_OF_HOLDING_FLOW["BagOfHolding – TO-BE flow (shared)"]
    direction LR

    PC_BAG --> BOH_SEL{"[G] Campaign selected? (CampaignContext)"}

    BOH_SEL -- No --> BOH_MISS["[P] MissingCampaign"]
    BOH_SEL -- Yes --> BOH_VIEW["[P] BagOfHolding (list + currency + filters)"]

    BOH_VIEW --> BOH_FILTER["[C] Search + Type filter"]
    BOH_FILTER --> BOH_VIEW

    BOH_VIEW --> BOH_CCY["[C] Party Currency editor"]
    BOH_CCY --> BOH_VIEW

    BOH_VIEW --> BOH_ADD{"[G] Can add items? (Requirement: true for Player + GM)"}
    BOH_ADD -- Yes --> BOH_MODAL["[C] AddItemModal"]
    BOH_MODAL -- add success --> BOH_VIEW
    BOH_MODAL -- cancel --> BOH_VIEW
  end

        %% -------- Quests subgraph (TO-BE, GM-only) --------
    n16 --> QU_P
    subgraph QUESTS_FLOW["Quests – TO-BE flow (GM-only)"]
      direction LR
      QU_P["[P] Quests"] --> QU_GM{"[G] GM Mode? (ModeContext)"}

      QU_GM -- No --> QU_NA["[P] NotAuthorized"]
      QU_GM -- Yes --> QU_SEL{"[G] Campaign selected? (CampaignContext)"}

      QU_SEL -- No --> QU_MISS["[P] MissingCampaign"]
      QU_SEL -- Yes --> QU_CTX["[CTX] CampaignContext"]

      QU_CTX --> QU_LIST["[P] Quests (list)"]
      QU_LIST -- click quest --> QU_PROF["[P] QuestProfile (:questId)"]

      QU_PROF -- back --> QU_P
    end

     %% ---- QuestProfile subgraph (nested detail) ----
  subgraph QUEST_PROFILE_FLOW["QuestProfile – TO-BE flow (GM-only)"]
    direction LR

    QU_PROF --> QP_FOUND{"[G] Quest exists? (Data)"}

    QP_FOUND -- No --> QP_404["[P] Quest Not Found"]
    QP_404 -- back --> QP_BACK_LIST["[P] Quests"]

    QP_FOUND -- Yes --> QP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

    QP_GM -- No --> QP_NA["[P] NotAuthorized"]
    QP_NA -- back --> QP_BACK_DASH["[P] DopamineDungeonDashboard / Quests"]

    QP_GM -- Yes --> QP_VIEW["[P] QuestProfile (view mode)"]
    QP_VIEW -- click Edit --> QP_EDIT["[C] Edit mode (inline fields)"]
    QP_EDIT -- click Save --> QP_VIEW
  end

        %% -------- Relationships subgraph (TO-BE, GM-only) --------
    n17 --> REL_P
    subgraph RELATIONSHIPS_FLOW["Relationships – TO-BE flow (GM-only)"]
      direction LR
      REL_P["[P] Relationships"] --> REL_GM{"[G] GM Mode? (ModeContext)"}

      REL_GM -- No --> REL_NA["[P] NotAuthorized"]
      REL_GM -- Yes --> REL_SEL{"[G] Campaign selected? (CampaignContext)"}

      REL_SEL -- No --> REL_MISS["[P] MissingCampaign"]
      REL_SEL -- Yes --> REL_CTX["[CTX] CampaignContext"]

      REL_CTX --> REL_LIST["[P] Relationships (graph/list)"]
      REL_LIST -- click relationship --> REL_PROF["[P] RelationshipProfile (:relationshipId)"]

      REL_PROF -- back --> REL_P
    end

      %% ---- RelationshipProfile subgraph (nested detail) ----
  subgraph RELATIONSHIP_PROFILE_FLOW["RelationshipProfile – TO-BE flow (GM-only)"]
    direction LR

    REL_PROF --> RP_FOUND{"[G] Relationship exists? (Data)"}

    RP_FOUND -- No --> RP_404["[P] Relationship Not Found"]
    RP_404 -- back --> RP_BACK_LIST["[P] Relationships"]

    RP_FOUND -- Yes --> RP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

    RP_GM -- No --> RP_NA["[P] NotAuthorized"]
    RP_NA -- back --> RP_BACK_DASH["[P] DopamineDungeonDashboard / Relationships"]

    RP_GM -- Yes --> RP_VIEW["[P] RelationshipProfile (view mode)"]
    RP_VIEW -- click Edit --> RP_EDIT["[C] Edit mode (inline fields)"]
    RP_EDIT -- click Save --> RP_VIEW
  end

        %% -------- Sessions subgraph (TO-BE) --------
    n18 --> SE_P
    subgraph SESSIONS_FLOW["Sessions – TO-BE flow"]
      direction LR
      SE_P["[P] Sessions"] --> SE_SEL{"[G] Campaign selected? (CampaignContext)"}

      SE_SEL -- No --> SE_MISS["[P] MissingCampaign"]
      SE_SEL -- Yes --> SE_CTX["[CTX] CampaignContext"]

      SE_CTX --> SE_GM{"[G] GM Mode? (ModeContext)"}

      SE_GM -- Yes --> SE_ALL["[P] Sessions (all + gm-only visible)"]
      SE_GM -- No --> SE_PUB["[P] Sessions (public only)"]

      SE_ALL -- click session --> SE_PROF["[P] SessionProfile (:sessionId)"]
      SE_PUB -- click session --> SE_PROF

      SE_PROF -- back --> SE_P

      SE_GM -- Yes --> SE_ADD["[C] CreateSessionModal"]
      SE_ADD -- create success --> SE_ALL
      SE_ADD -- cancel --> SE_ALL
    end

      %% ---- SessionProfile subgraph (nested detail) ----
  subgraph SESSION_PROFILE_FLOW["SessionProfile – TO-BE flow"]
    direction LR

    SE_PROF --> SP_FOUND{"[G] Session exists? (Data)"}

    SP_FOUND -- No --> SP_404["[P] Session Not Found"]
    SP_404 -- back --> SP_BACK_LIST["[P] Sessions"]

    SP_FOUND -- Yes --> SP_VIS{"[G] Visible to user? (ModeContext + session.visibility + ?mode override)"}

    SP_VIS -- No --> SP_NA["[P] NotAuthorized"]
    SP_NA -- back --> SP_BACK_LIST

    SP_VIS -- Yes --> SP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

    SP_GM -- Yes --> SP_VIEW["[P] SessionProfile (view mode)"]
    SP_VIEW -- click Edit --> SP_EDIT["[C] Edit mode (inline fields)"]
    SP_EDIT -- click Save --> SP_VIEW

    SP_GM -- No --> SP_VIEW_P["[P] SessionProfile (player view)"]
  end

    n2@{ shape: decision}