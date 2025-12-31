```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  LO_P["[P] Lore"] --> LO_SEL{"[G] Campaign selected? (CampaignContext)"}

  LO_SEL -- No --> LO_MISS["[P] MissingCampaign"]
  LO_SEL -- Yes --> LO_CTX["[CTX] CampaignContext"]

  LO_CTX --> LO_GM{"[G] GM Mode? (ModeContext)"}

  LO_GM -- Yes --> LO_ALL["[P] Lore (all + gm-only visible)"]
  LO_GM -- No --> LO_PUB["[P] Lore (public only)"]

  LO_ALL -- click lore entry --> LO_PROF["[P] LoreProfile (:loreId)"]
  LO_PUB -- click lore entry --> LO_PROF

  LO_PROF -- back --> LO_P

  %% Optional: GM create action (exists in Lore.jsx as a modal)
  LO_GM -- Yes --> LO_ADD["[C] CreateLoreModal"]
  LO_ADD -- create success --> LO_ALL
  LO_ADD -- cancel --> LO_ALL

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