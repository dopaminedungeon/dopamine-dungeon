import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import GradientBackground from "../components/GradientBackground";

export default function AppLayout() {
  return (
    <div className="min-h-screen flex text-white relative">
      <Sidebar />

      <div className="flex-1 relative overflow-hidden">
        <GradientBackground />

        <TopBar />

        <main className="relative z-10 w-full px-6 py-6 md:px-10 md:py-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}