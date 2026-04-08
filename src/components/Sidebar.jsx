import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  ScrollText,
  BookOpen,
  Map,
  ListTodo,
  Network,
  Sparkles,
  Settings,
} from "lucide-react";

import { useMode } from "../context/ModeContext.jsx";
import { features } from "../config/features";

const NavItem = ({ to, icon: Icon, label, isCollapsed }) => (
  <NavLink
    to={to}
    end={to === "/"}
    className={({ isActive }) =>
      `flex items-center gap-3 rounded-xl transition-colors min-h-11 ${
        isCollapsed ? "justify-center px-0 w-11 mx-auto" : "px-3 py-2"
      } ${
        isActive
          ? "bg-linear-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30"
          : "text-zinc-400 hover:text-white hover:bg-zinc-800/30"
      }`
    }
  >
    <Icon size={18} className="shrink-0" />
    {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
  </NavLink>
);

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { isGM } = useMode();
  const location = useLocation();

  // v0.1: keep navigation intentionally tiny.
  const baseNavItems = [
    { to: "/", icon: LayoutDashboard, label: "Home", on: features.dashboard },
    { to: "/sessions", icon: BookOpen, label: "Sessions", on: features.sessions },
    { to: "/items", icon: Package, label: "Items", on: features.items },
    // Bag is accessed via /pcs/bag today, but we expose it as a first-class nav item.
    { to: "/bag", icon: ScrollText, label: "Bag of Holding", on: features.bagOfHolding },

    // Future modules (kept here for when you flip flags back on)
    { to: "/npcs", icon: Users, label: "NPCs", on: features.npcs },
    { to: "/pcs", icon: Users, label: "PCs", on: features.pcs },
    { to: "/maps", icon: Map, label: "Locations", on: features.maps },
    { to: "/arcs", icon: Sparkles, label: "Arcs", on: features.arcs },
    { to: "/lore", icon: BookOpen, label: "Lore", on: features.lore },
  ].filter((x) => x.on);

  const gmOnlyItems = (
    isGM
      ? [
          { to: "/quests", icon: ListTodo, label: "Quests", on: features.quests },
          { to: "/relationships", icon: Network, label: "Relationships", on: features.relationships },
          { to: "/conditions", icon: Sparkles, label: "Conditions", on: features.conditions },
          { to: "/campaigns/settings", icon: Settings, label: "Campaign Settings", on: true },
        ].filter((x) => x.on)
      : []
  );

  const navItems = [...baseNavItems, ...gmOnlyItems];

  // Mobile: keep navigation simple and thumb-friendly.
  // v0.1 enabled features are tiny, so we can render a bottom nav.
  const mobileNavItems = (
    isGM
      ? [...baseNavItems, { to: "/campaigns/settings", icon: Settings, label: "Settings", on: true }]
      : [...baseNavItems]
  )
    .filter((x) => x.on)
    .slice(0, 5);

  return (
    <>
      {/* Desktop / tablet sidebar */}
      <aside
        className={`relative z-30 hidden md:block h-screen bg-zinc-900/20 border-r border-zinc-800/30 backdrop-blur-xl transition-all duration-300 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="p-4">
          <div
            className={`mb-8 ${
              isCollapsed
                ? "flex flex-col items-center gap-3"
                : "flex items-center justify-between"
            }`}
          >
            <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
              <div className="w-10 h-10 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center overflow-hidden">
                <img
                  src="/logo/dd-app-icon-master.png"
                  alt="Dopamine Dungeon"
                  className="w-8 h-8 object-contain"
                />
              </div>
              {!isCollapsed && (
                <div className="leading-tight min-w-0">
                  <h1 className="text-violet-100 font-bold tracking-tight text-sm leading-tight">
                    Dopamine
                  </h1>
                  <p className="text-violet-100 font-bold tracking-tight text-sm leading-tight">
                    Dungeon
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <span className="text-base leading-none">{isCollapsed ? "→" : "←"}</span>
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavItem key={item.to} {...item} isCollapsed={isCollapsed} />
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed md:hidden bottom-0 left-0 right-0 z-40 bg-zinc-950/60 backdrop-blur-xl border-t border-white/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="mx-auto max-w-screen-sm px-2">
          <div className="grid grid-cols-5 gap-1 py-2">
            {mobileNavItems.map(({ to, icon: Icon, label }) => {
              const active = to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(to);

              return (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 transition-colors ${
                    active
                      ? "bg-linear-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="text-[10px] leading-none">{label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}