```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  TB["[N] TopBar"] --> CH["[N] CampaignChooser (dropdown)"]

  CH -- select campaign --> CTX["[CTX] CampaignContext"]
  CH -- clear / none selected --> CTX

  CTX --> G{"[G] Campaign selected? (CampaignContext)"}
  G -- No --> MISS["[P] MissingCampaign"]
  G -- Yes --> PAGES["[P] Campaign-dependent pages"]