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
{import.meta.env.MODE !== "production" && (
  <div className="text-xs text-red-400">DEV</div>
)}

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
    addCampaign,
    createCampaign,
  } = useCampaign();

  const {
    tenants: legacyTenants,
    accessibleTenants,
    selectedTenantId,
    selectTenant,
  } = useTenant();

  const tenantsRaw = accessibleTenants ?? legacyTenants ?? [];
  const campaignsRaw = accessibleCampaigns ?? legacyCampaigns ?? [];

  // Normalize IDs across legacy/new shapes
  const tenants = (tenantsRaw || [])
    .filter(Boolean)
    .map((t) => ({
      ...t,
      __id: t.id ?? t.tenantId,
      __name: t.name ?? t.title ?? "(Unnamed workspace)",
    }))
    .filter((t) => t.__id);

  const campaigns = (campaignsRaw || [])
    .filter(Boolean)
    .map((c) => ({
      ...c,
      __id: c.id ?? c.campaignId,
      __name: c.name ?? c.title ?? "(Unnamed campaign)",
    }))
    .filter((c) => c.__id);

  const profileName = user?.displayName || user?.email || "Unknown user";
  const profileRole = String(mode).toLowerCase() === "gm" ? "GM" : "Player";

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
    <header className="sticky top-0 z-40 bg-black/20 backdrop-blur-xl border-b border-white/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 sm:px-6 sm:py-4 md:px-8">
        {/* Title */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{title}</h1>
            <span className="hidden sm:block text-[10px] tracking-wide text-zinc-500 shrink-0">
              Dopamine Dungeon v0.2
            </span>
          </div>
          <p className="text-zinc-500 text-xs sm:text-sm">
            Welcome back, {String(mode).toLowerCase() === "gm" ? "Dungeon Master" : "Player"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Quick search..."
              className="w-64 pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
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
              className="relative p-2 bg-white/5 border border-white/10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              onClick={() => setShowNotifications((v) => !v)}
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-purple-500 rounded-full" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-64 bg-black/90 border border-white/10 rounded-xl shadow-xl p-3 text-sm">
                <p className="text-zinc-400">
                  No notifications yet. Go cause some chaos in your campaign ✨
                </p>
              </div>
            )}
          </div>

          {/* Workspace + Campaign selectors */}
          <div className="hidden md:flex items-center gap-3">
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
              className="bg-zinc-950/40 border border-zinc-800/70 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
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

                if (next === "__new__") {
                  if (!selectedTenantId) {
                    alert("Pick a workspace first.");
                    return;
                  }

                  const name = prompt("Campaign name:");
                  if (!name) return;

                  const fn = createCampaign ?? addCampaign;
                  if (typeof fn === "function") {
                    fn({ name, tenantId: selectedTenantId });
                  } else {
                    console.warn(
                      "No campaign creation function available on CampaignContext (expected createCampaign or addCampaign)."
                    );
                  }
                  return;
                }

                if (typeof selectCampaign === "function") {
                  selectCampaign(next || null);
                }
              }}
              className="bg-zinc-950/40 border border-zinc-800/70 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
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
              <option key="new-campaign" value="__new__" disabled={!selectedTenantId}>
                + New campaign…
              </option>
            </select>
          </div>
          {/* GM / Player toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("player")}
              className={`px-2.5 py-2 sm:px-3 sm:py-1.5 text-xs rounded-lg border ${
                String(mode).toLowerCase() === "player"
                  ? "bg-white/10 border-indigo-500 text-indigo-300"
                  : "bg-transparent border-white/10 text-zinc-400 hover:text-white"
              }`}
            >
              <Eye className="inline w-3 h-3 sm:mr-1" />
              <span className="hidden sm:inline">Player</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("gm")}
              className={`px-2.5 py-2 sm:px-3 sm:py-1.5 text-xs rounded-lg border ${
                String(mode).toLowerCase() === "gm"
                  ? "bg-indigo-500/80 border-indigo-400 text-white"
                  : "bg-transparent border-white/10 text-zinc-400 hover:text-white"
              }`}
            >
              <Shield className="inline w-3 h-3 sm:mr-1" />
              <span className="hidden sm:inline">GM</span>
            </button>
          </div>
          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              className="flex items-center gap-3 p-2 sm:pr-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
              onClick={() => setShowProfileMenu((v) => !v)}
            >
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden md:block text-left max-w-45">
                <p className="text-white text-sm font-medium truncate">{profileName}</p>
                <p className="text-zinc-500 text-xs truncate">{profileRole}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-zinc-500 hidden md:block" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-black/90 border border-white/10 rounded-xl shadow-xl py-1 text-sm">
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