```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR
    A(["Start (App Load)"]) --> n2["[G] Authenticated?"]
    n2 -- No --> n3["[P] Login"]
    n2 -- Yes --> n4["[L] AppShell"]
    n4 -- default --> n1["[P] DopamineDungeonDashboard"]
    n4 --> n5["[N] Sidebar"] & n6["[N] TopBar"]
    n5 --> n7["[P] Arcs"] & n8["[P] CampaignSettings"] & n9["[P] Conditions"] & n10["[P] DopamineDungeonDashboard"] & n11["[P] Items"] & n12["[P] Lore"] & n13["[P] Maps"] & n14["[P] Npcs"] & n15["[P] PCs"] & n16["[P] Quests"] & n17["[P] Relationships"] & n18["[P] Sessions"]

    %% -------- Arcs subgraph --------
    n7 --> AR_A
    subgraph ARCS_FLOW["Arcs – internal flow"]
      direction LR
      AR_A["[P] Arcs"] --> AR_G{"[G] GM Mode? (ModeContext)"}
      AR_G -- Yes --> AR_C["[C] Cards (src/components/Cards.jsx)"]
      AR_G -- No --> AR_NA["[P] NotAuthorized"]
      AR_C -- click arc card --> AR_AP["[P] ArcProfile (:arcId)"]
      AR_AP -- back --> AR_A
    end

    n2@{ shape: decision}