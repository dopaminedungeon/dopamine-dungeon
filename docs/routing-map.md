```mermaid
---
config:
  layout: dagre
  nodeSpacing: 95
  rankSpacing: 155
---
flowchart LR


subgraph G["Guards & Context Resolution"]
direction LR
START([App boot]) --> AUTH_INIT["AuthProvider / useAuth</br>(user + loading)"]
AUTH_INIT --> AUTH_OK{Authenticated?}

AUTH_OK -- no --> LOGIN["Login Page"]
AUTH_OK -- yes --> TEN_INIT["TenantResolver</br>(derive accessible tenants)"]

TEN_INIT --> TEN_OK{Has >= 1 accessible tenant?}
TEN_OK -- no --> NO_TENANT["NoTenants State</br>(CTA: Create / Request access)"]
TEN_OK -- yes --> TEN_COUNT{Accessible tenants count?}

TEN_COUNT -- 1 --> TEN_AUTO["Auto-select tenant"]
TEN_COUNT -- ">1" --> TEN_PICK["Tenant Picker</br>(only accessible tenants shown)"]

TEN_AUTO --> TEN_SET["tenantId set"]
TEN_PICK --> TEN_SET

TEN_SET --> CAMP_INIT["CampaignResolver</br>(accessible campaigns in tenant)"]
CAMP_INIT --> CAMP_OK{Has >= 1 accessible campaign?}

CAMP_OK -- no --> NO_CAMP["NoCampaigns State</br>(CTA: Ask GM / Create campaign if admin)"]
CAMP_OK -- yes --> CAMP_COUNT{Accessible campaigns count?}

CAMP_COUNT -- 1 --> CAMP_AUTO["Auto-select campaign"]
CAMP_COUNT -- ">1" --> CAMP_PICK["Campaign Picker</br>(only accessible campaigns shown)"]

CAMP_AUTO --> CAMP_SET["campaignId set"]
CAMP_PICK --> CAMP_SET

CAMP_SET --> ROLE_INIT["RoleResolver</br>(CampaignGM or CampaignPlayer)"]
ROLE_INIT --> ROLE_OK{Role resolved?}

ROLE_OK -- no --> NOTAUTH["NotAuthorized</br>(CTA: Go Home)"]
ROLE_OK -- yes --> MODE_INIT["ModeResolver</br>(default from role + last used)"]

MODE_INIT --> MODE_OK{Mode resolved?}
MODE_OK -- fallback --> MODE_FALLBACK["Set default mode:</br>GM if role=CampaignGM</br>else Player"]
MODE_OK -- ok --> MODE_SET["mode set"]
MODE_FALLBACK --> MODE_SET

MODE_SET --> APP_SHELL["AppShell</br>(TopBar + Sidebar + Routes)"]
end

subgraph UI["UI Surfaces (Inside AppShell)"]
direction LR
TOP["TopBar</br>Tenant switch | Campaign switch | Mode toggle"]:::ui
SIDE["Sidebar</br>Links (visibility by mode)"]:::ui
APP_SHELL --> TOP
APP_SHELL --> SIDE
end

subgraph B["Route Buckets"]
direction LR
J_PUBLIC(( )):::junction
J_CAMP(( )):::junction
J_PLAYER(( )):::junction
J_GM(( )):::junction
J_ERR(( )):::junction

PUBLIC_ROUTES["Public routes"]:::bucket
PLAYER_ROUTES["Player-allowed routes"]:::bucket
GM_ROUTES["GM-only routes"]:::bucket
ERROR_ROUTES["Error / Empty states"]:::bucket

J_PUBLIC --> PUBLIC_ROUTES
J_PLAYER --> PLAYER_ROUTES
J_GM --> GM_ROUTES
J_ERR --> ERROR_ROUTES
end

%% AppShell can always show error states
APP_SHELL --> J_ERR

subgraph P["Pages (Representative)"]
direction LR

LOGIN

DASH["Dashboard"]:::page

ITEMS["Items"]:::page
ITEMP["ItemProfile"]:::page
SESS["Sessions"]:::page
SESSP["SessionProfile"]:::page
NPCS["NPCs"]:::page
NPCP["NpcProfile"]:::page
MAPS["Maps"]:::page
MAPP["MapProfile"]:::page
LORE["Lore"]:::page
LOREP["LoreProfile"]:::page

PCS["PCs (Characters)"]:::page
PCP["PcProfile"]:::page
BAG["Bag of Holding"]:::page

ARCS["Arcs"]:::page
ARCP["ArcProfile"]:::page
QUESTS["Quests"]:::page
REL["Relationships"]:::page
CSET["Campaign Settings</br>(/campaigns/settings)"]:::page

MISS_CAMP["MissingCampaign"]:::error
NOTAUTH["NotAuthorized"]:::error
NOTFOUND["NotFound"]:::error
NETERR["NetworkError"]:::error
end

subgraph R["Guards (Route-level)"]
direction LR
REQ_AUTH{RequireAuth}:::gate
REQ_TEN{RequireTenant}:::gate
REQ_CAMP{RequireCampaign}:::gate
REQ_ROLE{RequireCampaignRole}:::gate
REQ_MODE{RequireMode}:::gate
REQ_GM{RequireGM}:::gate
MODE_ROUTE{Mode?}:::gate
end

%% Route-level gating (campaign-scoped routes)
APP_SHELL --> J_CAMP
J_CAMP --> REQ_AUTH --> REQ_TEN --> REQ_CAMP --> REQ_ROLE --> REQ_MODE --> MODE_ROUTE

%% Failures route into error bucket (clean + no ghost arrows)
REQ_AUTH -. fail .-> LOGIN
REQ_TEN -. fail .-> NO_TENANT
REQ_CAMP -. missing/invalid .-> MISS_CAMP
REQ_ROLE -. not a member .-> NOTAUTH
REQ_MODE -. incompatible .-> NOTAUTH

MODE_ROUTE -- Player --> J_PLAYER
MODE_ROUTE -- GM --> J_GM

J_GM --> REQ_GM
REQ_GM -- role=CampaignGM --> GM_ROUTES
REQ_GM -- role=CampaignPlayer --> NOTAUTH

J_PLAYER --> PLAYER_ROUTES

%% Route content
PUBLIC_ROUTES --> LOGIN

PLAYER_ROUTES --> DASH
PLAYER_ROUTES --> ITEMS
PLAYER_ROUTES --> ITEMP
PLAYER_ROUTES --> SESS
PLAYER_ROUTES --> SESSP
PLAYER_ROUTES --> NPCS
PLAYER_ROUTES --> NPCP
PLAYER_ROUTES --> MAPS
PLAYER_ROUTES --> MAPP
PLAYER_ROUTES --> LORE
PLAYER_ROUTES --> LOREP
PLAYER_ROUTES --> PCS
PLAYER_ROUTES --> PCP
PLAYER_ROUTES --> BAG

GM_ROUTES --> DASH
GM_ROUTES --> ITEMS
GM_ROUTES --> ITEMP
GM_ROUTES --> SESS
GM_ROUTES --> SESSP
GM_ROUTES --> NPCS
GM_ROUTES --> NPCP
GM_ROUTES --> MAPS
GM_ROUTES --> MAPP
GM_ROUTES --> LORE
GM_ROUTES --> LOREP
GM_ROUTES --> PCS
GM_ROUTES --> PCP
GM_ROUTES --> BAG
GM_ROUTES --> ARCS
GM_ROUTES --> ARCP
GM_ROUTES --> QUESTS
GM_ROUTES --> REL
GM_ROUTES --> CSET

ERROR_ROUTES --> MISS_CAMP
ERROR_ROUTES --> NOTAUTH
ERROR_ROUTES --> NOTFOUND
ERROR_ROUTES --> NETERR

classDef gate fill:#fff3d6,stroke:#c78a1f,stroke-width:1.5px,color:#222;
classDef page fill:#f7f7f7,stroke:#bdbdbd,stroke-width:1.5px,color:#222;
classDef error fill:#ffecec,stroke:#cc3344,stroke-width:1.5px,color:#222;
classDef ui fill:#eef6ff,stroke:#6aa0d8,stroke-width:1.5px,color:#222;
classDef bucket fill:#f4f4ff,stroke:#8a7bd1,stroke-width:1.5px,color:#222;
classDef junction fill:#ddd,stroke:#999,stroke-width:1px,color:#666;

class MODE_ROUTE,REQ_AUTH,REQ_TEN,REQ_CAMP,REQ_ROLE,REQ_MODE,REQ_GM gate;
class DASH,ITEMS,ITEMP,SESS,SESSP,NPCS,NPCP,MAPS,MAPP,LORE,LOREP,PCS,PCP,BAG,ARCS,ARCP,QUESTS,REL,CSET page;
class MISS_CAMP,NOTAUTH,NOTFOUND,NETERR,NO_TENANT,NO_CAMP error;
class TOP,SIDE ui;
class PUBLIC_ROUTES,PLAYER_ROUTES,GM_ROUTES,ERROR_ROUTES bucket;

linkStyle default stroke:#777,stroke-width:2.6px;
J_CAMP((Campaign routes))
J_PLAYER((Player routes))
J_GM((GM routes))
J_ERR((Errors))