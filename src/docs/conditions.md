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

     %% ---- ConditionProfile subgraph (nested detail) ----
  subgraph CONDITION_PROFILE_FLOW["ConditionProfile – TO-BE flow (GM-only)"]
    direction LR

    COND_PROF --> CP_FOUND{"[G] Condition exists? (Data)"}

    CP_FOUND -- No --> CP_404["[P] Condition Not Found"]
    CP_404 -- back --> CP_BACK_LIST["[P] Conditions"]

    CP_FOUND -- Yes --> CP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}
    CP_GM -- No --> CP_NA["[P] NotAuthorized"]
    CP_NA -- return --> CP_BACK_DASH["[P] DopamineDungeonDashboard"]

    CP_GM -- Yes --> CP_VIEW["[P] ConditionProfile (view mode)"]
    CP_VIEW -- click Edit --> CP_EDIT["[C] Edit mode (inline fields)"]
    CP_EDIT -- click Save --> CP_VIEW
  end