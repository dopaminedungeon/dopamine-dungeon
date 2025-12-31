```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  QP_P["[P] QuestProfile (:questId)"] --> QP_FOUND{"[G] Quest exists? (Data)"}

  QP_FOUND -- No --> QP_404["[P] Quest Not Found"]
  QP_404 -- back --> QP_BACK_LIST["[P] Quests"]

  QP_FOUND -- Yes --> QP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

  QP_GM -- No --> QP_NA["[P] NotAuthorized"]
  QP_NA -- back --> QP_BACK_DASH["[P] DopamineDungeonDashboard / Quests"]

  QP_GM -- Yes --> QP_VIEW["[P] QuestProfile (view mode)"]
  QP_VIEW -- click Edit --> QP_EDIT["[C] Edit mode (inline fields)"]
  QP_EDIT -- click Save --> QP_VIEW