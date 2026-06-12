import React, { useLayoutEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import GradientBackground from "../components/GradientBackground";

export default function AppLayout() {
  const topbarRef = useRef(null);

  useLayoutEffect(() => {
    const topbar = topbarRef.current;
    if (!topbar) return undefined;

    const setTopbarHeight = () => {
      const height = Math.ceil(topbar.offsetHeight || 0);
      if (height > 0) {
        document.documentElement.style.setProperty("--app-topbar-height", `${height}px`);
      }
    };

    setTopbarHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", setTopbarHeight);
      return () => window.removeEventListener("resize", setTopbarHeight);
    }

    const observer = new ResizeObserver(setTopbarHeight);
    observer.observe(topbar);
    window.addEventListener("resize", setTopbarHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", setTopbarHeight);
    };
  }, []);

  return (
    <div className="min-h-screen flex text-white relative overflow-x-hidden">
      <div className="shrink-0">
        <Sidebar />
      </div>

      <div className="flex-1 min-w-0 relative overflow-hidden">
        <GradientBackground />

        <div ref={topbarRef}>
          <TopBar />
        </div>

        <main className="relative z-10 min-w-0 w-full px-4 py-4 pb-24 sm:pb-6 sm:px-6 sm:py-6 md:pb-8 md:px-10 md:py-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
