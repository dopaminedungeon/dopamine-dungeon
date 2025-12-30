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