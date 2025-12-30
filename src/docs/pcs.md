```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  PC_P["[P] PCs"] --> PC_SEL{"[G] Campaign selected? (CampaignContext)"}

  PC_SEL -- No --> PC_MISS["[P] MissingCampaign"]
  PC_SEL -- Yes --> PC_CTX["[CTX] CampaignContext"]

  PC_CTX --> PC_GM{"[G] GM Mode? (ModeContext)"}

  PC_GM -- Yes --> PC_ALL["[P] PCs (all + gm-only visible)"]
  PC_GM -- No --> PC_PUB["[P] PCs (public only)"]

  PC_ALL -- click pc --> PC_PROF["[P] PCProfile (:pcId)"]
  PC_PUB -- click pc --> PC_PROF

  PC_PROF -- back --> PC_P

  %% Optional: GM-only create/edit
  PC_GM -- Yes --> PC_ADD["[C] CreatePcModal"]
  PC_ADD -- create success --> PC_ALL
  PC_ADD -- cancel --> PC_ALL