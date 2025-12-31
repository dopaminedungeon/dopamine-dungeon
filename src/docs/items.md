```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  IT_P["[P] Items"] --> IT_SEL{"[G] Campaign selected? (CampaignContext)"}

  IT_SEL -- No --> IT_MISS["[P] MissingCampaign"]
  IT_SEL -- Yes --> IT_CTX["[CTX] CampaignContext"]

  IT_CTX --> IT_GM{"[G] GM Mode? (ModeContext)"}

  IT_GM -- Yes --> IT_ALL["[P] Items (all + GM-only visible)"]
  IT_GM -- No --> IT_PUB["[P] Items (public only)"]

  IT_ALL -- click item --> IT_PROF["[P] ItemProfile (:itemId)"]
  IT_PUB -- click item --> IT_PROF

  IT_PROF -- back --> IT_P

  %% Optional: show the GM create action that exists in Items.jsx
  IT_GM -- Yes --> IT_ADD["[C] CreateItemModal"]
  IT_ADD -- create success --> IT_ALL
  IT_ADD -- cancel --> IT_ALL

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