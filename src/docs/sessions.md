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