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
          ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30"
          : "text-zinc-400 hover:text-white hover:bg-zinc-800/30"
      }`
    }
  >
    <Icon size={18} className="flex-shrink-0" />
    {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
  </NavLink>
);

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [userRole, setUserRole] = React.useState("gm");

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

  const navItems = userRole === "gm" ? [...baseNavItems, ...gmOnlyItems] : baseNavItems;

  return (
    <aside
      className={`relative z-30 h-screen bg-zinc-900/20 border-r border-zinc-800/30 backdrop-blur-xl transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
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

        {!isCollapsed && (
          <div className="mt-8 p-3 bg-zinc-800/20 rounded-xl border border-zinc-800/30">
            <p className="text-zinc-400 text-xs mb-2">Role</p>
            <div className="flex gap-2">
              <button
                onClick={() => setUserRole("player")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  userRole === "player"
                    ? "bg-purple-500/20 text-purple-200"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                Player
              </button>
              <button
                onClick={() => setUserRole("gm")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  userRole === "gm"
                    ? "bg-pink-500/20 text-pink-200"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                GM
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}