```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  MP_P["[P] MapProfile (:mapId)"] --> MP_FOUND{"[G] Map exists? (Data)"}

  MP_FOUND -- No --> MP_404["[P] Map Not Found"]
  MP_404 -- back --> MP_BACK_LIST["[P] Maps"]

  MP_FOUND -- Yes --> MP_VIS{"[G] Visible to user? (ModeContext + map.visibility + ?mode override)"}

  MP_VIS -- No --> MP_NA["[P] NotAuthorized"]
  MP_NA -- back --> MP_BACK_LIST

  MP_VIS -- Yes --> MP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

  MP_GM -- Yes --> MP_VIEW["[P] MapProfile (view mode)"]
  MP_GM -- No --> MP_VIEW

  MP_VIEW -- click Edit --> MP_EDIT["[C] Edit mode (inline fields)"]
  MP_EDIT -- click Save --> MP_VIEW

  MP_VIEW -- back --> MP_BACK_LIST
  MP_EDIT -- back --> MP_BACK_LIST