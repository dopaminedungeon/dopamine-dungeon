```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  SP_P["[P] SessionProfile (:sessionId)"] --> SP_FOUND{"[G] Session exists? (Data)"}

  SP_FOUND -- No --> SP_404["[P] Session Not Found"]
  SP_404 -- back --> SP_BACK_LIST["[P] Sessions"]

  SP_FOUND -- Yes --> SP_VIS{"[G] Visible to user? (ModeContext + session.visibility + ?mode override)"}

  SP_VIS -- No --> SP_NA["[P] NotAuthorized"]
  SP_NA -- back --> SP_BACK_LIST

  SP_VIS -- Yes --> SP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

  %% GM path
  SP_GM -- Yes --> SP_VIEW["[P] SessionProfile (view mode)"]
  SP_VIEW -- click Edit --> SP_EDIT["[C] Edit mode (inline fields)"]
  SP_EDIT -- click Save --> SP_VIEW

  %% Player path
  SP_GM -- No --> SP_VIEW_P["[P] SessionProfile (player view)"]

  %% Navigation
  SP_VIEW -- back --> SP_BACK_LIST
  SP_EDIT -- back --> SP_BACK_LIST
  SP_VIEW_P -- back --> SP_BACK_LIST