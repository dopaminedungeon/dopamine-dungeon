
```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
  BOH_P["[P] BagOfHolding (/pcs/bag)"] --> BOH_SEL{"[G] Campaign selected? (CampaignContext)"}

  BOH_SEL -- No --> BOH_MISS["[P] MissingCampaign"]
  BOH_SEL -- Yes --> BOH_VIEW["[P] BagOfHolding (list + currency + filters)"]

  BOH_VIEW --> BOH_FILTER["[C] Search + Type filter"]
  BOH_FILTER --> BOH_VIEW

  BOH_VIEW --> BOH_CCY["[C] Party Currency editor"]
  BOH_CCY --> BOH_VIEW

  BOH_VIEW --> BOH_ADD{"[G] Can add items? (Requirement: true for Player + GM)"}
  BOH_ADD -- Yes --> BOH_MODAL["[C] AddItemModal"]
  BOH_MODAL -- add success --> BOH_VIEW
  BOH_MODAL -- cancel --> BOH_VIEW