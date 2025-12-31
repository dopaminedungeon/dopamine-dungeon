```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  NPC_P["[P] NPCs"] --> NPC_SEL{"[G] Campaign selected? (CampaignContext)"}

  NPC_SEL -- No --> NPC_MISS["[P] MissingCampaign"]
  NPC_SEL -- Yes --> NPC_CTX["[CTX] CampaignContext"]

  NPC_CTX --> NPC_GM{"[G] GM Mode? (ModeContext)"}

  NPC_GM -- Yes --> NPC_ALL["[P] NPCs (all + gm-only visible)"]
  NPC_GM -- No --> NPC_PUB["[P] NPCs (public only)"]

  NPC_ALL -- click npc --> NPC_PROF["[P] NpcProfile (:npcId)"]
  NPC_PUB -- click npc --> NPC_PROF

  NPC_PROF -- back --> NPC_P

  %% Optional: GM-only create/edit
  NPC_GM -- Yes --> NPC_ADD["[C] CreateNpcModal"]
  NPC_ADD -- create success --> NPC_ALL
  NPC_ADD -- cancel --> NPC_ALL

    %% ---- NpcProfile subgraph (nested detail) ----
  subgraph NPC_PROFILE_FLOW["NpcProfile – TO-BE flow"]
    direction LR

    NPC_PROF --> NP_FOUND{"[G] NPC exists? (Data)"}

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
  end