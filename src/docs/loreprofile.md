```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  LP_P["[P] LoreProfile (:loreId)"] --> LP_FOUND{"[G] Lore exists? (Data)"}

  LP_FOUND -- No --> LP_404["[P] Lore Not Found"]
  LP_404 -- back --> LP_BACK_LIST["[P] Lore"]

  LP_FOUND -- Yes --> LP_VIS{"[G] Visible to user? (ModeContext + lore.visibility + ?mode override)"}

  LP_VIS -- No --> LP_NA["[P] NotAuthorized"]
  LP_NA -- back --> LP_BACK_LIST

  LP_VIS -- Yes --> LP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

  LP_GM -- Yes --> LP_VIEW["[P] LoreProfile (view mode)"]
  LP_GM -- No --> LP_VIEW

  LP_VIEW -- click Edit --> LP_EDIT["[C] Edit mode (inline fields)"]
  LP_EDIT -- click Save --> LP_VIEW

  LP_VIEW -- back --> LP_BACK_LIST
  LP_EDIT -- back --> LP_BACK_LIST