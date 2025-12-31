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

   %% ---- QuestProfile subgraph (nested detail) ----
  subgraph QUEST_PROFILE_FLOW["QuestProfile – TO-BE flow (GM-only)"]
    direction LR

    QU_PROF --> QP_FOUND{"[G] Quest exists? (Data)"}

    QP_FOUND -- No --> QP_404["[P] Quest Not Found"]
    QP_404 -- back --> QP_BACK_LIST["[P] Quests"]

    QP_FOUND -- Yes --> QP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

    QP_GM -- No --> QP_NA["[P] NotAuthorized"]
    QP_NA -- back --> QP_BACK_DASH["[P] DopamineDungeonDashboard / Quests"]

    QP_GM -- Yes --> QP_VIEW["[P] QuestProfile (view mode)"]
    QP_VIEW -- click Edit --> QP_EDIT["[C] Edit mode (inline fields)"]
    QP_EDIT -- click Save --> QP_VIEW
  end