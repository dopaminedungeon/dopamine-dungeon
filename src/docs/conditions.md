```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  COND_P["[P] Conditions"] --> COND_GM{"[G] GM Mode? (ModeContext)"}

  COND_GM -- No --> COND_NA["[P] NotAuthorized"]
  COND_GM -- Yes --> COND_SEL{"[G] Campaign selected? (CampaignContext)"}

  COND_SEL -- No --> COND_MISS["[P] MissingCampaign"]
  COND_SEL -- Yes --> COND_CTX["[CTX] CampaignContext"]

  COND_CTX --> COND_LIST["[P] Conditions (list)"]
  COND_LIST -- click condition --> COND_PROF["[P] ConditionProfile (:conditionId)"]

  COND_PROF -- back --> COND_P