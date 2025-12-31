```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  PC_P["[P] PCs (/pcs)"] --> PC_SEL{"[G] Campaign selected? (CampaignContext)"}

  PC_SEL -- No --> PC_MISS["[P] MissingCampaign"]
  PC_SEL -- Yes --> PC_HOME["[P] PCs (Tabs: Characters | Bag of Holding)"]

  %% Tabs (explicit)
  PC_HOME -- tab: Characters --> PC_GM{"[G] GM Mode? (ModeContext)"}
  PC_HOME -- tab: Bag of Holding --> PC_BAG["[P] PCs – BagOfHolding tab"]

  %% Characters tab: GM view
  PC_GM -- Yes --> PC_ALL["[P] Characters (GM: all profiles)"]
  PC_ALL -- click pc --> PC_PROF["[P] PCProfile (:pcId)"]
  PC_GM -- Yes --> PC_ADD["[C] CreatePcModal"]
  PC_ADD -- create success --> PC_ALL
  PC_ADD -- cancel --> PC_ALL

  %% Characters tab: Player view
  PC_GM -- No --> PC_AUTH{"[G] Authenticated? (Auth)"}
  PC_AUTH -- No --> PC_LOGIN["[P] Login"]
  PC_AUTH -- Yes --> PC_ASSIGNED{"[G] Assigned PC? (CampaignContext/Auth)"}
  PC_ASSIGNED -- No --> PC_NA["[P] NotAuthorized"]
  PC_ASSIGNED -- Yes --> PC_SELF["[P] PCProfile (:myPcId)"]