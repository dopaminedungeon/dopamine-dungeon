```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
    AR_A["[P] Arcs"] --> AR_G{"[G] GM Mode? (ModeContext)"}
    AR_G -- Yes --> AR_C["[C] Cards (src/components/Cards.jsx)"]
    AR_G -- No --> AR_NA["[P] NotAuthorized"]
    AR_C -- click arc card --> AR_AP["[P] ArcProfile (:arcId)"]
    AR_AP -- back --> AR_A

     %% ---- ArcProfile subgraph (nested detail) ----
  subgraph ARC_PROFILE_FLOW["ArcProfile – TO-BE flow (GM-only)"]
    direction LR
    AR_AP --> AP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

    AP_GM -- No --> AP_NA["[P] NotAuthorized"]
    AP_NA -- back --> AP_BACK["[P] DopamineDungeonDashboard / Arcs"]

    AP_GM -- Yes --> AP_VIEW["[P] ArcProfile (view)"]
    AP_VIEW -- toggle Edit/Done --> AP_EDIT["[C] Edit mode (inline fields)"]
    AP_EDIT -- Done --> AP_VIEW
  end