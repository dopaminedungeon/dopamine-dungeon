```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  RP_P["[P] RelationshipProfile (:relationshipId)"] --> RP_FOUND{"[G] Relationship exists? (Data)"}

  RP_FOUND -- No --> RP_404["[P] Relationship Not Found"]
  RP_404 -- back --> RP_BACK_LIST["[P] Relationships"]

  RP_FOUND -- Yes --> RP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

  RP_GM -- No --> RP_NA["[P] NotAuthorized"]
  RP_NA -- back --> RP_BACK_DASH["[P] DopamineDungeonDashboard / Relationships"]

  RP_GM -- Yes --> RP_VIEW["[P] RelationshipProfile (view mode)"]
  RP_VIEW -- click Edit --> RP_EDIT["[C] Edit mode (inline fields)"]
  RP_EDIT -- click Save --> RP_VIEW