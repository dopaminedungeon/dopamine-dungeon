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