import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Clock, 
  Map, 
  Settings,
  Gamepad2,
  ChevronRight,
  BookOpen,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Users, label: "NPCs", path: "/npcs" },
  { icon: Package, label: "Items", path: "/items" },
  { icon: Clock, label: "Sessions", path: "/sessions" },
  { icon: Map, label: "Maps", path: "/maps" },
  { icon: BookOpen, label: "Lore", path: "/lore" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export default function Sidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-black/40 backdrop-blur-xl border-r border-white/5 flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Gamepad2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight">Dopamine</h1>
            <p className="text-purple-400 text-xs font-medium">Dungeon</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? currentPath === "/"
              : currentPath === item.path || currentPath.startsWith(item.path + "/");
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                isActive
                  ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/30"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  isActive ? "text-purple-400" : "group-hover:text-purple-400"
                } transition-colors`}
              />
              <span className="font-medium">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-purple-400" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}