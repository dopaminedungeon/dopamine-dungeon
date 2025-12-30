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