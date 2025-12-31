```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  PCP_P["[P] PCProfile (:pcId)"] --> PCP_FOUND{"[G] PC exists? (Data)"}

  PCP_FOUND -- No --> PCP_404["[P] PC Not Found"]
  PCP_404 -- back --> PCP_BACK["[P] PCs"]

  PCP_FOUND -- Yes --> PCP_GM{"[G] GM Mode? (ModeContext + ?mode override)"}

  %% --------------------
  %% GM path (full access + edit)
  %% --------------------
  PCP_GM -- Yes --> PCP_VIEW["[P] PCProfile (view mode)"]
  PCP_VIEW -- click Edit --> PCP_EDIT["[C] Edit mode (inline fields)"]
  PCP_EDIT -- click Save --> PCP_VIEW

  %% --------------------
  %% Player path (assignment + auth)
  %% --------------------
  PCP_GM -- No --> PCP_AUTH{"[G] Authenticated? (Auth)"}
  PCP_AUTH -- No --> PCP_LOGIN["[P] Login"]
  PCP_AUTH -- Yes --> PCP_ALLOWED{"[G] Assigned to this PC in campaign? (Assignment)"}

  PCP_ALLOWED -- No --> PCP_NA["[P] NotAuthorized"]
  PCP_ALLOWED -- Yes --> PCP_VIEW_P["[P] PCProfile (player view)"]

  %% Navigation
  PCP_VIEW -- back --> PCP_BACK
  PCP_EDIT -- back --> PCP_BACK
  PCP_VIEW_P -- back --> PCP_BACK