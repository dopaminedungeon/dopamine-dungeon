```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  CS_P["[P] CampaignSettings"] --> CS_GM{"[G] GM Mode? (ModeContext)"}
  CS_GM -- No --> CS_NA["[P] NotAuthorized"]
  CS_GM -- Yes --> CS_SEL{"[G] Campaign selected? (CampaignContext)"}

  CS_SEL -- No --> CS_MISS["[P] MissingCampaign"]
  CS_SEL -- Yes --> CS_CTX["[CTX] CampaignContext"]

  CS_CTX -- save success --> CS_P
  CS_CTX -- save failure --> CS_P