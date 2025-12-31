```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  CP_P["[P] ConditionProfile (:conditionId)"] --> CP_FOUND{"[G] Condition exists? (Data)"}

  CP_FOUND -- No --> CP_404["[P] Condition Not Found"]
  CP_404 -- back --> CP_BACK_LIST["[P] Conditions"]

  CP_FOUND -- Yes --> CP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}
  CP_GM -- No --> CP_NA["[P] NotAuthorized"]
  CP_NA -- return --> CP_BACK_DASH["[P] DopamineDungeonDashboard"]

  CP_GM -- Yes --> CP_VIEW["[P] ConditionProfile (view mode)"]
  CP_VIEW -- click Edit --> CP_EDIT["[C] Edit mode (inline fields)"]
  CP_EDIT -- click Save --> CP_VIEW

  CP_VIEW -- back --> CP_BACK_LIST
  CP_EDIT -- back --> CP_BACK_LIST