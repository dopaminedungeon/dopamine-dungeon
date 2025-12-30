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