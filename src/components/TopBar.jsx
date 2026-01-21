import React, { useState, useRef, useEffect } from "react";
import { Bell, Search, User, ChevronDown } from "lucide-react";
import { useMode } from "../context/ModeContext.jsx";
import { Shield, Eye } from "lucide-react";
import { useCampaign } from "../context/CampaignContext.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import DebugPanel from "./DebugPanel";

export default function TopBar({ title }) {
  const { mode, setMode } = useMode();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const {
    campaigns: legacyCampaigns,
    accessibleCampaigns,
    activeCampaignId,
    setActiveCampaignId,
    addCampaign,
    createCampaign,
  } = useCampaign();

  const {
    tenants: legacyTenants,
    accessibleTenants,
    activeTenantId,
    setActiveTenantId,
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

  return (
    <header className="sticky top-0 z-40 bg-black/20 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center justify-between px-8 py-4">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-zinc-500 text-sm">
            Welcome back, {mode === "GM" ? "Dungeon Master" : "Player"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
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
              className="relative p-2.5 bg-white/5 border border-white/10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
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
              value={activeTenantId ?? ""}
              onChange={(e) => {
                const nextTenantId = e.target.value || null;
                if (typeof setActiveTenantId === "function") {
                  setActiveTenantId(nextTenantId);
                }
                // Switching workspace invalidates current campaign selection
                if (typeof setActiveCampaignId === "function") {
                  setActiveCampaignId(null);
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
              value={activeCampaignId ?? ""}
              onChange={(e) => {
                const next = e.target.value;

                if (next === "__new__") {
                  if (!activeTenantId) {
                    alert("Pick a workspace first.");
                    return;
                  }

                  const name = prompt("Campaign name:");
                  if (!name) return;

                  // Support both old and new CampaignContext APIs
                  const fn = createCampaign ?? addCampaign;
                  if (typeof fn === "function") {
                    fn({ name, tenantId: activeTenantId });
                  } else {
                    console.warn(
                      "No campaign creation function available on CampaignContext (expected createCampaign or addCampaign)."
                    );
                  }
                  return;
                }

                if (typeof setActiveCampaignId === "function") {
                  setActiveCampaignId(next || null);
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
              <option key="new-campaign" value="__new__" disabled={!activeTenantId}>
                + New campaign…
              </option>
            </select>
          </div>
                {/* GM / Player toggle */}
      <div className="flex items-center gap-2 mr-4">
        <button
          type="button"
          onClick={() => setMode("Player")}
          className={`px-3 py-1.5 text-xs rounded-lg border ${
            mode === "Player"
              ? "bg-white/10 border-indigo-500 text-indigo-300"
              : "bg-transparent border-white/10 text-zinc-400 hover:text-white"
          }`}
        >
          <Eye className="inline w-3 h-3 mr-1" />
          Player
        </button>
        <button
          type="button"
          onClick={() => setMode("GM")}
          className={`px-3 py-1.5 text-xs rounded-lg border ${
            mode === "GM"
              ? "bg-indigo-500/80 border-indigo-400 text-white"
              : "bg-transparent border-white/10 text-zinc-400 hover:text-white"
          }`}
        >
          <Shield className="inline w-3 h-3 mr-1" />
          GM
        </button>
      </div>
          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              className="flex items-center gap-3 p-2 pr-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
              onClick={() => setShowProfileMenu((v) => !v)}
            >
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-white text-sm font-medium">John Doe</p>
                <p className="text-zinc-500 text-xs">Admin</p>
              </div>
              <ChevronDown className="w-4 h-4 text-zinc-500 hidden md:block" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-black/90 border border-white/10 rounded-xl shadow-xl py-1 text-sm">
                <button className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-white/5">
                  Profile (coming soon)
                </button>
                <button className="w-full text-left px-3 py-2 text-zinc-300 hover:bg-white/5">
                  Settings
                </button>
                <div className="border-t border-white/10 my-1" />
                <button
                  className="w-full text-left px-3 py-2 text-zinc-500 cursor-not-allowed"
                  disabled
                >
                  Log out (when we add auth)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="px-8 pb-4">
        <DebugPanel
          context={{
            mode,
            activeTenantId,
            activeCampaignId,
            tenantsCount: tenants.length,
            campaignsCount: campaigns.length,
            tenantsSource: accessibleTenants ? "accessibleTenants" : legacyTenants ? "legacyTenants" : "none",
            campaignsSource: accessibleCampaigns ? "accessibleCampaigns" : legacyCampaigns ? "legacyCampaigns" : "none",
          }}
        />
      </div>
    </header>
  );
}