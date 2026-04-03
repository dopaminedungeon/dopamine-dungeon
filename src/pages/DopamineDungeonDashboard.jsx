import React from "react";
import { useNavigate } from "react-router-dom";
import { Home, ScrollText, Package, Users, Settings, Sparkles } from "lucide-react";
import { useCampaign } from "../context/CampaignContext";
import { useTenant } from "../context/TenantContext";
import { useMode } from "../context/ModeContext";

export default function DopamineDungeonDashboard() {
  const navigate = useNavigate();
  const campaignContext = useCampaign();
  const tenantContext = useTenant();
  const { mode } = useMode();

  const campaigns = campaignContext?.accessibleCampaigns ?? campaignContext?.campaigns ?? [];
  const tenants = tenantContext?.tenants ?? [];
  const selectedCampaignId = campaignContext?.selectedCampaignId ?? null;
  const selectedTenantId = tenantContext?.selectedTenantId ?? null;

  const activeCampaign =
    campaigns.find((campaign) => String(campaign.campaignId ?? campaign.id) === String(selectedCampaignId)) ?? null;

  const activeTenant =
    tenants.find((tenant) => String(tenant.tenantId ?? tenant.id) === String(selectedTenantId)) ?? null;

  const workspaceRole = tenantContext?.workspaceRole ?? activeTenant?.role ?? null;
  const campaignRole = campaignContext?.campaignRole ?? activeCampaign?.role ?? null;

  const quickActions = [
    { label: "Sessions", icon: ScrollText, to: "/sessions", always: true },
    { label: "Items", icon: Package, to: "/items", always: true },
    { label: "PCs", icon: Users, to: "/pcs", always: true },
    { label: "Campaign Settings", icon: Settings, to: "/campaigns/settings", always: mode === "gm" },
  ].filter((action) => action.always);

  const playerSummary =
    activeCampaign?.playerSummary?.trim() ||
    activeCampaign?.description?.trim() ||
    "No player-facing campaign summary yet. Your party has entered the dungeon beautifully underprepared.";

  const gmStatusMessage =
    mode === "gm"
      ? "GM mode is active. Secrets are safe, prep is visible, and the narrative knives remain within reach."
      : "Player mode is active. You are seeing only the safe version of reality. Probably.";

  const workspaceName = activeTenant?.name || "No workspace selected";
  const campaignName = activeCampaign?.name || "No campaign selected";
  const systemLabel = activeCampaign?.system || activeCampaign?.ruleset || "Not set yet";
  const statusLabel = activeCampaign?.status || "Unknown";

  const rightNowSignal =
    mode === "gm"
      ? "No urgent GM signal yet. This is where pending invites, latest session prep, or unresolved narrative threads should surface next."
      : "No urgent player signal yet. This is where the latest session recap, next objective, or shared party status should surface next.";

  const isGmMode = mode === "gm";

  const modeTheme = isGmMode
    ? {
        heroBorder: "border-fuchsia-300/25",
        heroBg: "from-fuchsia-950/45 via-zinc-950/85 to-violet-950/35",
        heroGlow:
          "bg-[radial-gradient(circle_at_18%_28%,rgba(217,70,239,0.26),transparent_38%),radial-gradient(circle_at_82%_24%,rgba(139,92,246,0.16),transparent_40%)]",
        heroIcon:
          "border-fuchsia-300/40 bg-linear-to-br from-fuchsia-400/40 via-violet-400/25 to-purple-300/25 shadow-[0_0_25px_rgba(217,70,239,0.38)]",
        heroEyebrow: "text-fuchsia-300/95",
        heroTitle:
          "from-white via-fuchsia-100 to-violet-200 drop-shadow-[0_0_12px_rgba(217,70,239,0.32)]",
        workspaceChip:
          "border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100 shadow-[0_0_10px_rgba(217,70,239,0.22)]",
        roleChip:
          "border-violet-300/30 bg-violet-500/10 text-violet-50 shadow-[0_0_10px_rgba(139,92,246,0.24)]",
        modeChip:
          "border-rose-300/20 bg-rose-400/10 text-rose-100 shadow-[0_0_10px_rgba(251,113,133,0.18)]",
        primaryCardBorder: "border-fuchsia-400/20",
        primaryCardBg: "from-fuchsia-950/30 via-zinc-950/80 to-violet-950/20",
        primaryCardGlow:
          "bg-[radial-gradient(circle_at_10%_20%,rgba(217,70,239,0.2),transparent_40%)]",
        sparkleIcon:
          "border-fuchsia-300/20 bg-linear-to-br from-fuchsia-500/25 to-violet-500/15 text-fuchsia-100 shadow-sm shadow-fuchsia-950/20",
        workspaceCard: "border-fuchsia-400/20 bg-linear-to-br from-fuchsia-500/10 to-transparent shadow-inner shadow-fuchsia-950/20",
        campaignCard: "border-violet-400/20 bg-linear-to-br from-violet-500/10 to-transparent shadow-inner shadow-violet-950/20",
        modeCard: "border-rose-400/15 bg-linear-to-r from-rose-500/8 via-fuchsia-500/6 to-violet-500/8 shadow-inner shadow-black/20",
        quickCardBorder: "border-violet-400/15",
        quickCardBg: "from-violet-950/15 via-zinc-950/75 to-fuchsia-950/20",
        quickTitle: "from-violet-100 to-fuchsia-100",
        quickButtonHover: "hover:bg-fuchsia-500/10 hover:border-fuchsia-400/30 hover:shadow-[0_0_20px_rgba(217,70,239,0.32)]",
        quickIcon:
          "border-fuchsia-300/20 bg-linear-to-br from-fuchsia-500/25 to-violet-500/15 text-fuchsia-100 shadow-sm shadow-fuchsia-950/20",
        leftBottomBorder: "border-fuchsia-400/20",
        leftBottomBg: "from-fuchsia-950/30 via-zinc-950/70 to-violet-950/15",
        leftBottomTitle: "from-fuchsia-100 to-violet-100",
        rightBottomBorder: "border-violet-300/20",
        rightBottomBg: "from-violet-950/25 via-zinc-950/75 to-fuchsia-950/20",
        rightBottomGlow:
          "bg-[radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.22),transparent_40%)]",
        rightBottomTitle: "from-violet-100 to-fuchsia-100",
        signalText: "text-fuchsia-200/85",
      }
    : {
        heroBorder: "border-cyan-300/20",
        heroBg: "from-violet-900/40 via-zinc-950/85 to-indigo-950/30",
        heroGlow:
          "bg-[radial-gradient(circle_at_20%_30%,rgba(139,92,246,0.25),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.15),transparent_40%)]",
        heroIcon:
          "border-violet-300/40 bg-linear-to-br from-violet-400/40 via-fuchsia-400/25 to-cyan-300/25 shadow-[0_0_25px_rgba(139,92,246,0.4)]",
        heroEyebrow: "text-fuchsia-300/90",
        heroTitle:
          "from-white via-violet-200 to-cyan-200 drop-shadow-[0_0_12px_rgba(139,92,246,0.35)]",
        workspaceChip:
          "border-violet-300/30 bg-violet-500/10 text-violet-100 shadow-[0_0_10px_rgba(139,92,246,0.25)]",
        roleChip:
          "border-cyan-300/30 bg-cyan-500/10 text-cyan-50 shadow-[0_0_10px_rgba(34,211,238,0.25)]",
        modeChip:
          "border-amber-300/20 bg-amber-400/10 text-amber-100 shadow-[0_0_10px_rgba(251,191,36,0.25)]",
        primaryCardBorder: "border-violet-400/20",
        primaryCardBg: "from-violet-950/30 via-zinc-950/80 to-cyan-950/20",
        primaryCardGlow:
          "bg-[radial-gradient(circle_at_10%_20%,rgba(139,92,246,0.2),transparent_40%)]",
        sparkleIcon:
          "border-violet-300/20 bg-linear-to-br from-violet-500/25 to-fuchsia-500/15 text-violet-100 shadow-sm shadow-violet-950/20",
        workspaceCard: "border-violet-400/20 bg-linear-to-br from-violet-500/10 to-transparent shadow-inner shadow-violet-950/20",
        campaignCard: "border-cyan-400/20 bg-linear-to-br from-cyan-500/10 to-transparent shadow-inner shadow-cyan-950/20",
        modeCard: "border-fuchsia-400/15 bg-linear-to-r from-fuchsia-500/8 via-violet-500/6 to-cyan-500/8 shadow-inner shadow-black/20",
        quickCardBorder: "border-cyan-400/15",
        quickCardBg: "from-cyan-950/15 via-zinc-950/75 to-violet-950/20",
        quickTitle: "from-cyan-100 to-violet-100",
        quickButtonHover: "hover:bg-violet-500/10 hover:border-violet-400/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.35)]",
        quickIcon:
          "border-violet-300/20 bg-linear-to-br from-violet-500/25 to-cyan-500/15 text-violet-100 shadow-sm shadow-violet-950/20",
        leftBottomBorder: "border-violet-400/20",
        leftBottomBg: "from-violet-950/30 via-zinc-950/70 to-fuchsia-950/15",
        leftBottomTitle: "from-violet-100 to-fuchsia-100",
        rightBottomBorder: "border-cyan-300/20",
        rightBottomBg: "from-cyan-950/25 via-zinc-950/75 to-indigo-950/20",
        rightBottomGlow:
          "bg-[radial-gradient(circle_at_80%_30%,rgba(34,211,238,0.2),transparent_40%)]",
        rightBottomTitle: "from-cyan-100 to-violet-100",
        signalText: "text-violet-200/80",
      };

  return (
    <div className="space-y-8">
      <section
        className={`relative overflow-hidden rounded-3xl border bg-linear-to-br backdrop-blur-xl p-8 shadow-2xl shadow-violet-950/40 transition-colors duration-500 ${modeTheme.heroBorder} ${modeTheme.heroBg}`}
      >
        <div className={`pointer-events-none absolute inset-0 ${modeTheme.heroGlow}`} />
        <div className="pointer-events-none absolute -left-10 top-6 h-32 w-32 rounded-full bg-white/5 blur-3xl motion-safe:animate-pulse" />
        <div className="flex items-start gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-white motion-safe:animate-pulse ${modeTheme.heroIcon}`}>
            <Home className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className={`mb-2 text-xs uppercase tracking-[0.25em] ${modeTheme.heroEyebrow}`}>Home</p>
            <h1 className={`text-3xl font-bold tracking-tight bg-linear-to-r bg-clip-text text-transparent ${modeTheme.heroTitle}`}>
              {campaignName !== "No campaign selected" ? campaignName : "Dopamine Dungeon"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-200">{playerSummary}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              <span className={`rounded-full border backdrop-blur-md px-3 py-1 ${modeTheme.workspaceChip}`}>
                Workspace: {workspaceName}
              </span>
              <span className={`rounded-full border backdrop-blur-md px-3 py-1 ${modeTheme.roleChip}`}>
                Role: {campaignRole || workspaceRole || "—"}
              </span>
              <span className={`rounded-full border backdrop-blur-md px-3 py-1 ${modeTheme.modeChip}`}>
                {mode === "gm" ? "GM mode" : "Player mode"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className={`relative overflow-hidden xl:col-span-2 rounded-3xl border bg-linear-to-br backdrop-blur-xl p-6 shadow-xl shadow-violet-950/30 transition-colors duration-500 ${modeTheme.primaryCardBorder} ${modeTheme.primaryCardBg}`}>
          <div className={`pointer-events-none absolute inset-0 ${modeTheme.primaryCardGlow}`} />
          <div className="mb-5 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${modeTheme.sparkleIcon}`}>
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">What matters right now</h2>
              <p className="text-sm text-zinc-400">The calm, actually useful version.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className={`rounded-2xl border p-4 ${modeTheme.workspaceCard}`}>
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Workspace</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {workspaceName}
              </p>
              <p className="mt-3 text-sm text-zinc-400">
                Workspace role: <span className="text-zinc-200 font-medium">{workspaceRole || activeTenant?.role || "—"}</span>
              </p>
            </div>

            <div className={`rounded-2xl border p-4 ${modeTheme.campaignCard}`}>
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Campaign</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {campaignName}
              </p>
              <p className="mt-3 text-sm text-zinc-400">
                Campaign role: <span className="text-zinc-200 font-medium">{campaignRole || activeCampaign?.role || "—"}</span>
              </p>
            </div>

            <div className={`rounded-2xl border p-4 md:col-span-2 ${modeTheme.modeCard}`}>
              <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Current mode</p>
              <p className="mt-2 text-lg font-semibold text-white">{mode === "gm" ? "GM mode" : "Player mode"}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{gmStatusMessage}</p>
              <p className={`mt-3 text-sm leading-6 ${modeTheme.signalText}`}>{rightNowSignal}</p>
            </div>
          </div>
        </div>

        <div className={`rounded-3xl border bg-linear-to-br backdrop-blur-xl p-6 shadow-xl shadow-cyan-950/10 transition-colors duration-500 ${modeTheme.quickCardBorder} ${modeTheme.quickCardBg}`}>
          <h2 className={`text-lg font-semibold bg-linear-to-r bg-clip-text text-transparent ${modeTheme.quickTitle}`}>Quick actions</h2>
          <p className="mt-1 text-sm text-zinc-400">Go where the narrative currently hurts the most.</p>

          <div className="mt-5 grid grid-cols-1 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left text-white transition duration-300 motion-safe:hover:-translate-y-0.5 ${modeTheme.quickButtonHover}`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${modeTheme.quickIcon}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{action.label}</p>
                    <p className="text-xs text-zinc-500">Open {action.label.toLowerCase()}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={`rounded-3xl border bg-linear-to-br backdrop-blur-xl p-6 shadow-xl shadow-violet-950/15 transition-colors duration-500 ${modeTheme.leftBottomBorder} ${modeTheme.leftBottomBg}`}>
          <h2 className={`text-lg font-semibold bg-linear-to-r bg-clip-text text-transparent ${modeTheme.leftBottomTitle}`}>Latest player-safe context</h2>
          <p className="mt-4 text-sm leading-6 text-zinc-200">
            {playerSummary}
          </p>
        </div>

        <div className={`relative overflow-hidden rounded-3xl border bg-linear-to-br backdrop-blur-xl p-6 shadow-xl shadow-cyan-950/20 transition-colors duration-500 ${modeTheme.rightBottomBorder} ${modeTheme.rightBottomBg}`}>
          <div className={`pointer-events-none absolute inset-0 ${modeTheme.rightBottomGlow}`} />
          <h2 className={`text-lg font-semibold bg-linear-to-r bg-clip-text text-transparent ${modeTheme.rightBottomTitle}`}>Status</h2>
          <div className="mt-4 space-y-4 text-sm text-zinc-300">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-zinc-500">System</p>
              <p className="mt-1 font-medium text-white">{systemLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-zinc-500">Campaign status</p>
              <p className="mt-1 font-medium text-white">{statusLabel}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}