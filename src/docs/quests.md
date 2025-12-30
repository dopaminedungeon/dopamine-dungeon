```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  QU_P["[P] Quests"] --> QU_GM{"[G] GM Mode? (ModeContext)"}

  QU_GM -- No --> QU_NA["[P] NotAuthorized"]
  QU_GM -- Yes --> QU_SEL{"[G] Campaign selected? (CampaignContext)"}

  QU_SEL -- No --> QU_MISS["[P] MissingCampaign"]
  QU_SEL -- Yes --> QU_CTX["[CTX] CampaignContext"]

  QU_CTX --> QU_LIST["[P] Quests (list)"]
  QU_LIST -- click quest --> QU_PROF["[P] QuestProfile (:questId)"]

  QU_PROF -- back --> QU_P