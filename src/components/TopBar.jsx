import React, { useState, useRef, useEffect } from "react";
import { Bell, Search, User, ChevronDown } from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { Shield, Eye } from "lucide-react";
import { useCampaign } from "../context/CampaignContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import DebugPanel from "./DebugPanel";
import { features } from "../config/features";
import { useNavigate } from "react-router-dom";

export default function TopBar({ title }) {
  const { mode, setMode } = useMode();
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const {
    campaigns: legacyCampaigns,
    accessibleCampaigns,
    selectedCampaignId,
    selectCampaign,
  } = useCampaign();

  const {
    tenants: legacyTenants,
    accessibleTenants,
    selectedTenantId,
    selectTenant,
  } = useTenant();

  const tenantsRaw = accessibleTenants ?? legacyTenants ?? [];
  const campaignsRaw = accessibleCampaigns ?? legacyCampaigns ?? [];

  // Selector values must stay on app-safe slugs/legacy IDs, never Postgres UUIDs.
  const tenants = (tenantsRaw || [])
    .filter(Boolean)
    .map((t) => ({
      ...t,
      __id: t.tenantId,
      __name: t.name ?? t.title ?? "(Unnamed workspace)",
    }))
    .filter((t) => t.__id);

  const campaigns = (campaignsRaw || [])
    .filter(Boolean)
    .map((c) => ({
      ...c,
      __id: c.campaignId ?? c.slug,
      __name: c.name ?? c.title ?? "(Unnamed campaign)",
    }))
    .filter((c) => c.__id);

  const profileName = user?.displayName || user?.email || "Unknown user";
  const profileRole = String(mode).toLowerCase() === "gm" ? "GM" : "Player";

  const isGmMode = String(mode).toLowerCase() === "gm";

  const topBarTheme = isGmMode
    ? {
      shell: "border-fuchsia-400/15 bg-black/25",
      glow: "bg-[radial-gradient(circle_at_20%_20%,rgba(217,70,239,0.18),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.14),transparent_24%)]",
      searchRing: "focus:border-fuchsia-400/50 focus:ring-fuchsia-500/20",
      selectRing: "focus:ring-fuchsia-500/40",
      activePlayer: "bg-white/10 border-white/10 text-zinc-400 hover:text-white",
      activeGm: "bg-fuchsia-500/80 border-fuchsia-400 text-white shadow-[0_0_18px_rgba(217,70,239,0.28)]",
      badge: "text-fuchsia-300/90",
      profileOrb: "from-fuchsia-500 via-violet-500 to-rose-400",
    }
    : {
      shell: "border-cyan-400/10 bg-black/20",
      glow: "bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.14),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.12),transparent_24%)]",
      searchRing: "focus:border-purple-500/50 focus:ring-purple-500/20",
      selectRing: "focus:ring-indigo-500/40",
      activePlayer: "bg-white/10 border-indigo-500 text-indigo-300 shadow-[0_0_16px_rgba(99,102,241,0.2)]",
      activeGm: "bg-transparent border-white/10 text-zinc-400 hover:text-white",
      badge: "text-cyan-300/90",
      profileOrb: "from-purple-500 to-pink-500",
    };

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target)
      ) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notificationsRef = useRef(null);
  const profileRef = useRef(null);

  const navigate = useNavigate();

  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-500 ${topBarTheme.shell}`}>
      <div className={`pointer-events-none absolute inset-0 ${topBarTheme.glow}`} />
      <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-2.5 sm:px-6 sm:py-3 md:px-8">
        {/* Title */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-lg sm:text-xl font-bold text-white truncate">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <p className="text-zinc-400">
              Welcome back, {String(mode).toLowerCase() === "gm" ? "Dungeon Master" : "Player"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Quick search..."
              className={`w-64 pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 transition-all shadow-inner shadow-black/20 ${topBarTheme.searchRing}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // later we can hook this into real search
                  console.log("Search:", e.target.value);
                }
              }}
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-white/10 rounded text-zinc-500 text-xs">
              ⌘K
            </kbd>
          </div>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              className="relative p-2 bg-white/5 border border-white/10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 hover:shadow-[0_0_18px_rgba(139,92,246,0.18)] transition-all"
              onClick={() => setShowNotifications((v) => !v)}
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-purple-500 rounded-full" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 z-50 w-64 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl shadow-violet-950/20 p-3 text-sm">
                <p className="text-zinc-400">
                  No notifications yet. Go cause some chaos in your campaign ✨
                </p>
              </div>
            )}
          </div>

          {/* Workspace + Campaign selectors */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Workspace selector */}
            <select
              value={selectedTenantId ?? ""}
              onChange={(e) => {
                const nextTenantId = e.target.value || null;
                if (typeof selectTenant === "function") {
                  selectTenant(nextTenantId);
                }
                // Switching workspace invalidates current campaign selection
                if (typeof selectCampaign === "function") {
                  selectCampaign(null);
                }
              }}
              className={`bg-zinc-950/50 border border-zinc-800/80 rounded-xl px-3 py-2 text-sm text-white shadow-inner shadow-black/20 focus:outline-none focus:ring-2 transition-all ${topBarTheme.selectRing}`}
            >
              <option key="tenant-placeholder" value="" disabled>
                Select workspace…
              </option>
              {tenants.length === 0 ? (
                <option key="no-tenants" value="" disabled>
                  (No workspaces)
                </option>
              ) : (
                tenants.map((t) => (
                  <option key={`tenant-${t.__id}`} value={t.__id}>
                    {t.__name}
                  </option>
                ))
              )}
            </select>

            {/* Campaign selector */}
            <select
              value={selectedCampaignId ?? ""}
              onChange={(e) => {
                const next = e.target.value;

                if (typeof selectCampaign === "function") {
                  selectCampaign(next || null);
                }
              }}
              className={`bg-zinc-950/50 border border-zinc-800/80 rounded-xl px-3 py-2 text-sm text-white shadow-inner shadow-black/20 focus:outline-none focus:ring-2 transition-all ${topBarTheme.selectRing}`}
            >
              <option key="campaign-placeholder" value="" disabled>
                Select campaign…
              </option>
              {campaigns.length === 0 ? (
                <option key="no-campaigns" value="" disabled>
                  (No accessible campaigns)
                </option>
              ) : (
                campaigns.map((c) => (
                  <option key={`camp-${c.__id}`} value={c.__id}>
                    {c.__name}
                  </option>
                ))
              )}
            </select>
          </div>
          {/* GM / Player toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("player")}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs rounded-lg border transition-all ${String(mode).toLowerCase() === "player"
                  ? topBarTheme.activePlayer
                  : "bg-transparent border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
            >
              <Eye className="inline w-3 h-3 sm:mr-1" />
              <span className="hidden sm:inline">Player</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("gm")}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs rounded-lg border transition-all ${String(mode).toLowerCase() === "gm"
                  ? topBarTheme.activeGm
                  : "bg-transparent border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
            >
              <Shield className="inline w-3 h-3 sm:mr-1" />
              <span className="hidden sm:inline">GM</span>
            </button>
          </div>
          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              className="flex items-center gap-3 p-2 sm:pr-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
              onClick={() => setShowProfileMenu((v) => !v)}
            >
              <div className={`w-8 h-8 rounded-lg bg-linear-to-br ${topBarTheme.profileOrb} flex items-center justify-center shadow-[0_0_18px_rgba(139,92,246,0.2)]`}>
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden md:block text-left max-w-45">
                <p className="text-white text-sm font-medium truncate">{profileName}</p>
                <p className="text-zinc-500 text-xs truncate">{profileRole}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-zinc-500 hidden md:block" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 z-50 w-56 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl shadow-violet-950/20 py-1 text-sm">
                <div className="px-3 py-2 border-b border-white/10">
                  <p className="text-white text-sm font-medium truncate">{profileName}</p>
                  <p className="text-zinc-500 text-xs truncate">{user?.email || "No email"}</p>
                </div>

                <button
                  className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-white/5"
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate("/settings/profile");
                  }}
                >
                  Profile Settings
                </button>

                {String(mode).toLowerCase() === "gm" && (
                  <button
                    className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-white/5"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate("/campaigns/settings");
                    }}
                  >
                    Campaign Settings
                  </button>
                )}

                <div className="border-t border-white/10 my-1" />

                <button
                  className="w-full text-left px-3 py-2 text-red-300 hover:bg-white/5"
                  onClick={async () => {
                    setShowProfileMenu(false);
                    await logout?.();
                    navigate("/");
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {features.debugPanel && (
        <div className="px-8 pb-4">
          <DebugPanel
            context={{
              mode,
              activeTenantId: selectedTenantId,
              activeCampaignId: selectedCampaignId,
              tenantsCount: tenants.length,
              campaignsCount: campaigns.length,
              tenantsSource: accessibleTenants
                ? "accessibleTenants"
                : legacyTenants
                  ? "legacyTenants"
                  : "none",
              campaignsSource: accessibleCampaigns
                ? "accessibleCampaigns"
                : legacyCampaigns
                  ? "legacyCampaigns"
                  : "none",
            }}
          />
        </div>
      )}
    </header>
  );
}
