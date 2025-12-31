```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  SE_P["[P] Sessions"] --> SE_SEL{"[G] Campaign selected? (CampaignContext)"}

  SE_SEL -- No --> SE_MISS["[P] MissingCampaign"]
  SE_SEL -- Yes --> SE_CTX["[CTX] CampaignContext"]

  SE_CTX --> SE_GM{"[G] GM Mode? (ModeContext)"}

  SE_GM -- Yes --> SE_ALL["[P] Sessions (all + gm-only visible)"]
  SE_GM -- No --> SE_PUB["[P] Sessions (public only)"]

  SE_ALL -- click session --> SE_PROF["[P] SessionProfile (:sessionId)"]
  SE_PUB -- click session --> SE_PROF

  SE_PROF -- back --> SE_P

  %% Optional: GM-only create (exists in Sessions.jsx)
  SE_GM -- Yes --> SE_ADD["[C] CreateSessionModal"]
  SE_ADD -- create success --> SE_ALL
  SE_ADD -- cancel --> SE_ALL

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