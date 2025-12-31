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

  %% --------------------
  %% Tabs
  %% --------------------
  PC_HOME -- tab: Bag of Holding --> PC_BAG["[P] BagOfHolding (global party inventory)"]
  PC_HOME -- tab: Characters --> PC_ROLE{"[G] GM Mode? (ModeContext)"}

  %% --------------------
  %% GM – Characters tab
  %% --------------------
  PC_ROLE -- Yes --> PC_ALL["[P] Characters (GM: all PCs list/cards)"]
  PC_ALL -- click pc card --> PC_PROF["[P] PCProfile (:pcId)"]

  PC_ROLE -- Yes --> PC_ADD["[C] CreatePcModal"]
  PC_ADD -- create success --> PC_ALL
  PC_ADD -- cancel --> PC_ALL

  %% --------------------
  %% Player – Characters tab
  %% --------------------
  PC_ROLE -- No --> PC_AUTH{"[G] Authenticated? (Auth)"}
  PC_AUTH -- No --> PC_LOGIN["[P] Login"]

  PC_AUTH -- Yes --> PC_COUNT{"[G] Assigned PCs in campaign? (count)"}

  PC_COUNT -- 0 --> PC_NA["[P] NotAuthorized"]

  PC_COUNT -- 1 --> PC_INLINE["[P] PCProfile (inline: only assigned PC)"]

  PC_COUNT -- 2+ --> PC_MANY["[P] Characters (Player: my PCs list/cards)"]
  PC_MANY -- click pc card --> PC_SELF_PROF["[P] PCProfile (:pcId)"]
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