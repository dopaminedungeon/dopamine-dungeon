```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  REL_P["[P] Relationships"] --> REL_GM{"[G] GM Mode? (ModeContext)"}

  REL_GM -- No --> REL_NA["[P] NotAuthorized"]
  REL_GM -- Yes --> REL_SEL{"[G] Campaign selected? (CampaignContext)"}

  REL_SEL -- No --> REL_MISS["[P] MissingCampaign"]
  REL_SEL -- Yes --> REL_CTX["[CTX] CampaignContext"]

  REL_CTX --> REL_LIST["[P] Relationships (graph/list)"]
  REL_LIST -- click relationship --> REL_PROF["[P] RelationshipProfile (:relationshipId)"]

  REL_PROF -- back --> REL_P

    %% ---- RelationshipProfile subgraph (nested detail) ----
  subgraph RELATIONSHIP_PROFILE_FLOW["RelationshipProfile – TO-BE flow (GM-only)"]
    direction LR

    REL_PROF --> RP_FOUND{"[G] Relationship exists? (Data)"}

    RP_FOUND -- No --> RP_404["[P] Relationship Not Found"]
    RP_404 -- back --> RP_BACK_LIST["[P] Relationships"]

    RP_FOUND -- Yes --> RP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

    RP_GM -- No --> RP_NA["[P] NotAuthorized"]
    RP_NA -- back --> RP_BACK_DASH["[P] DopamineDungeonDashboard / Relationships"]

    RP_GM -- Yes --> RP_VIEW["[P] RelationshipProfile (view mode)"]
    RP_VIEW -- click Edit --> RP_EDIT["[C] Edit mode (inline fields)"]
    RP_EDIT -- click Save --> RP_VIEW
  end