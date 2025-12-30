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
    
    n2@{ shape: decision}