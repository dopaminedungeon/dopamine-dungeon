import React from "react";
import { NavLink } from "react-router-dom";
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

const NavItem = ({ to, icon: Icon, label, isCollapsed }) => (
  <NavLink
    to={to}
    end={to === "/"}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
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

  const baseNavItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/npcs", icon: Users, label: "NPCs" },
    { to: "/items", icon: Package, label: "Items" },
    { to: "/pcs", icon: ScrollText, label: "PCs" },
    { to: "/sessions", icon: BookOpen, label: "Sessions" },
    { to: "/maps", icon: Map, label: "Maps" },
    { to: "/arcs", icon: Sparkles, label: "Arcs" },
    { to: "/lore", icon: BookOpen, label: "Lore" },
  ];

  const gmOnlyItems = [
    { to: "/quests", icon: ListTodo, label: "Quests" },
    { to: "/relationships", icon: Network, label: "Relationships" },
    { to: "/conditions", icon: Sparkles, label: "Conditions" },
    { to: "/campaigns/settings", icon: Settings, label: "Campaign Settings" },
  ];

  const navItems = [...baseNavItems, ...gmOnlyItems];

  return (
    <aside
      className={`relative z-30 h-screen bg-zinc-900/20 border-r border-zinc-800/30 backdrop-blur-xl transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">🎲</span>
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="text-white font-bold">Dopamine</h1>
                <p className="text-zinc-500 text-xs">Dungeon</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-zinc-500 hover:text-white transition-colors"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="text-lg">{isCollapsed ? "→" : "←"}</span>
          </button>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} isCollapsed={isCollapsed} />
          ))}
        </nav>
      </div>
    </aside>
  );
}