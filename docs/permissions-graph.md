```mermaid
---
config:
  theme: redux
  layout: dagre
---
flowchart LR

%% =========================
%% Permission Matrix — Graph View
%% =========================

subgraph P["Campaign Role: CampaignPlayer"]
direction TB

P_NAV["[N] Sidebar shows:</br>Dashboard, PCs, Bag of Holding,</br>Items, Lore, Maps, NPCs, Sessions"] --> P_PAGES

P_PAGES["[P] Allowed pages (Player)"] --> P_ALLOWED_LIST["Dashboard</br>PCs (Player view)</br>Bag of Holding</br>Items</br>ItemProfile</br>Lore</br>LoreProfile</br>Maps</br>MapProfile</br>NPCs</br>NpcProfile</br>Sessions</br>SessionProfile"]

P_PAGES --> P_ACTIONS["[A] Allowed actions (Player)"]
P_ACTIONS --> P_ACT1["Assign item to self (ItemProfile) — allowed"]
P_ACTIONS --> P_ACT2["Read-only everywhere else"]

P_PAGES --> P_BLOCKED["[X] Blocked (Player) — NotAuthorized"]
P_BLOCKED --> P_B1["Arcs / ArcProfile"]
P_BLOCKED --> P_B2["CampaignSettings"]
P_BLOCKED --> P_B3["Conditions / ConditionProfile"]
P_BLOCKED --> P_B4["Quests / QuestProfile"]
P_BLOCKED --> P_B5["Relationships / RelationshipProfile"]

P_PAGES --> P_EDGE["[S] Player-specific edge cases"]
P_EDGE --> P_E1["PCs > Characters tab:</br>0 assigned → message</br>1 assigned → auto-load profile</br>>1 assigned → cards list"]
end


subgraph G["Campaign Role: CampaignGM"]
direction TB

G_NAV["[N] Sidebar shows:</br>ALL Player pages + GM-only pages"] --> G_PAGES

G_PAGES["[P] Allowed pages (GM)"] --> G_ALLOWED_LIST["Everything Player can access</br>+</br>Arcs / ArcProfile</br>CampaignSettings</br>Conditions / ConditionProfile</br>Quests / QuestProfile</br>Relationships / RelationshipProfile"]

G_PAGES --> G_ACTIONS["[A] Allowed actions (GM)"]
G_ACTIONS --> G_ACT1["Create / edit GM content (Arcs, Quests, Relationships, Conditions)"]
G_ACTIONS --> G_ACT2["PC management:</br>Create PC, edit, assign PC to player"]
G_ACTIONS --> G_ACT3["Assign items to PC/player</br>+ manage Bag of Holding"]
G_ACTIONS --> G_ACT4["Mode toggle available:</br>GM ↔ Player preview"]

G_PAGES --> G_NOTES["[S] Notes"]
G_NOTES --> G_N1["Mode=Player blocks GM-only routes</br>(even for GM role)"]
end


%% =========================
%% Styling (soft colors)
%% =========================
classDef player fill:#eef5ff,stroke:#6aa0ff,color:#0b1b33;
classDef gm fill:#f2fff3,stroke:#3fb950,color:#0b2a12;
classDef blocked fill:#fff0f0,stroke:#ff6b6b,color:#3a0b0b;
classDef nav fill:#f4f4f4,stroke:#bdbdbd,color:#222;
classDef actions fill:#fff7e6,stroke:#ffb84d,color:#3a2500;
classDef notes fill:#f7f7ff,stroke:#8b8bff,color:#1a1a33;

class P,P_PAGES,P_ALLOWED_LIST,P_EDGE,P_E1 player;
class P_NAV nav;
class P_ACTIONS,P_ACT1,P_ACT2 actions;
class P_BLOCKED,P_B1,P_B2,P_B3,P_B4,P_B5 blocked;

class G,G_PAGES,G_ALLOWED_LIST gm;
class G_NAV nav;
class G_ACTIONS,G_ACT1,G_ACT2,G_ACT3,G_ACT4 actions;
class G_NOTES,G_N1 notes;