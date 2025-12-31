```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  IP_P["[P] ItemProfile (:itemId)"] --> IP_FOUND{"[G] Item exists? (Data)"}

  IP_FOUND -- No --> IP_404["[P] Item Not Found"]
  IP_404 -- back --> IP_BACK_LIST["[P] Items"]

  IP_FOUND -- Yes --> IP_VIS{"[G] Visible to user? (ModeContext + item.visibility + ?mode override)"}

  IP_VIS -- No --> IP_NA["[P] NotAuthorized"]
  IP_NA -- back --> IP_BACK_LIST

  IP_VIS -- Yes --> IP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

  IP_GM -- No --> IP_VIEW["[P] ItemProfile (view mode)"]
  IP_GM -- Yes --> IP_VIEW

  IP_VIEW -- click Edit --> IP_EDIT["[C] Edit mode (inline fields)"]
  IP_EDIT -- click Save --> IP_VIEW

  IP_VIEW -- back --> IP_BACK_LIST
  IP_EDIT -- back --> IP_BACK_LIST