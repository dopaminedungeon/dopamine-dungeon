import React, { useState, useRef, useEffect } from "react";
import { Bell, Search, User, ChevronDown } from "lucide-react";

export default function TopBar({ title }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const notificationsRef = useRef(null);
  const profileRef = useRef(null);

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

  return (
    <header className="sticky top-0 z-40 bg-black/20 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center justify-between px-8 py-4">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-zinc-500 text-sm">Welcome back, Dungeon Master</p>
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

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              className="flex items-center gap-3 p-2 pr-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
              onClick={() => setShowProfileMenu((v) => !v)}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
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
    </header>
  );
}