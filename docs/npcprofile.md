```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  NP_P["[P] NpcProfile (:npcId)"] --> NP_FOUND{"[G] NPC exists? (Data)"}

  NP_FOUND -- No --> NP_404["[P] NPC Not Found"]
  NP_404 -- back --> NP_BACK_LIST["[P] NPCs"]

  NP_FOUND -- Yes --> NP_VIS{"[G] Visible to user? (ModeContext + npc.visibility + ?mode override)"}

  NP_VIS -- No --> NP_NA["[P] NotAuthorized"]
  NP_NA -- back --> NP_BACK_LIST

  NP_VIS -- Yes --> NP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

  NP_GM -- Yes --> NP_VIEW["[P] NpcProfile (view mode)"]
  NP_GM -- No --> NP_VIEW

  NP_VIEW -- click Edit --> NP_EDIT["[C] Edit mode (inline fields)"]
  NP_EDIT -- click Save --> NP_VIEW

  NP_VIEW -- back --> NP_BACK_LIST
  NP_EDIT -- back --> NP_BACK_LIST