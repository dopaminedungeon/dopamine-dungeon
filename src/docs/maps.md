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