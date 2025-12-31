```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  MAP_P["[P] Maps"] --> MAP_SEL{"[G] Campaign selected? (CampaignContext)"}

  MAP_SEL -- No --> MAP_MISS["[P] MissingCampaign"]
  MAP_SEL -- Yes --> MAP_CTX["[CTX] CampaignContext"]

  MAP_CTX --> MAP_GM{"[G] GM Mode? (ModeContext)"}

  MAP_GM -- Yes --> MAP_ALL["[P] Maps (all + gm-only visible)"]
  MAP_GM -- No --> MAP_PUB["[P] Maps (public only)"]

  MAP_ALL -- click map --> MAP_PROF["[P] MapProfile (:mapId)"]
  MAP_PUB -- click map --> MAP_PROF

  MAP_PROF -- back --> MAP_P

  %% Optional: GM create action (exists in Maps.jsx)
  MAP_GM -- Yes --> MAP_ADD["[C] CreateMapModal"]
  MAP_ADD -- create success --> MAP_ALL
  MAP_ADD -- cancel --> MAP_ALL

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