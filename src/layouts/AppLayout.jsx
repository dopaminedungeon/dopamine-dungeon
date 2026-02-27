import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import GradientBackground from "../components/GradientBackground";

export default function AppLayout() {
  return (
    <div className="min-h-screen flex text-white relative overflow-x-hidden">
      <div className="shrink-0">
        <Sidebar />
      </div>

      <div className="flex-1 min-w-0 relative overflow-hidden">
        <GradientBackground />

        <TopBar />

        <main className="relative z-10 min-w-0 w-full px-4 py-4 pb-24 sm:pb-6 sm:px-6 sm:py-6 md:pb-8 md:px-10 md:py-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}