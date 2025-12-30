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