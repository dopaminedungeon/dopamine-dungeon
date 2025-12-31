```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  AP_P["[P] ArcProfile (:arcId)"] --> AP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

  AP_GM -- No --> AP_NA["[P] NotAuthorized"]
  AP_NA -- back --> AP_BACK["[P] DopamineDungeonDashboard / Arcs"]

  AP_GM -- Yes --> AP_VIEW["[P] ArcProfile (view mode)"]

  AP_VIEW -- toggle Edit --> AP_EDIT["[C] Edit mode (inline fields)"]
  AP_EDIT -- Done --> AP_VIEW