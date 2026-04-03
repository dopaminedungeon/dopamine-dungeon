import React from "react";
import { Link } from "react-router-dom";
import { useMode } from "../context/ModeContext";
import { features } from "../config/features";

export default function Welcome() {
  const { mode } = useMode();
  const [showEntryGlow, setShowEntryGlow] = React.useState(true);
  const homePath = features.dashboard ? "/home" : "/sessions";

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setShowEntryGlow(false), 1600);
    return () => window.clearTimeout(timeout);
  }, []);

  const isGmMode = String(mode).toLowerCase() === "gm";

  const theme = isGmMode
    ? {
        glow: "bg-[radial-gradient(circle_at_50%_40%,rgba(217,70,239,0.24),transparent_38%),radial-gradient(circle_at_50%_55%,rgba(139,92,246,0.12),transparent_28%)]",
        cardBorder: "border-fuchsia-400/20",
        cardBg: "from-fuchsia-950/35 via-zinc-950/80 to-violet-950/30",
        badge: "text-fuchsia-300/90",
        button: "from-fuchsia-500 via-violet-500 to-rose-400 shadow-[0_0_24px_rgba(217,70,239,0.28)]",
      }
    : {
        glow: "bg-[radial-gradient(circle_at_50%_40%,rgba(139,92,246,0.22),transparent_38%),radial-gradient(circle_at_50%_55%,rgba(34,211,238,0.12),transparent_28%)]",
        cardBorder: "border-violet-400/20",
        cardBg: "from-violet-950/35 via-zinc-950/80 to-cyan-950/20",
        badge: "text-cyan-300/90",
        button: "from-purple-500 via-violet-500 to-cyan-400 shadow-[0_0_24px_rgba(139,92,246,0.28)]",
      };

  return (
    <main className="relative min-h-[calc(100vh-7rem)] overflow-hidden px-6 py-10 flex items-center justify-center">
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
          showEntryGlow ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-0 bg-black/30" />
        <div className={`absolute inset-0 ${theme.glow}`} />
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl motion-safe:animate-pulse" />
      </div>

      <section
        className={`relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border bg-linear-to-br backdrop-blur-xl p-8 md:p-10 text-white shadow-2xl shadow-violet-950/40 ${theme.cardBorder} ${theme.cardBg}`}
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 ring-1 ring-violet-400/20 overflow-hidden shadow-[0_0_22px_rgba(139,92,246,0.18)] motion-safe:animate-pulse">
          <img
            src="/logo/dd-app-icon-master.png"
            alt="Dopamine Dungeon"
            className="h-14 w-14 object-contain"
          />
        </div>

        <div className="text-center">
          <p className={`mb-3 text-xs uppercase tracking-[0.25em] ${theme.badge}`}>
            Invitation accepted
          </p>
          <h1 className="mb-3 text-3xl md:text-4xl font-bold tracking-tight bg-linear-to-r from-white via-violet-100 to-cyan-100 bg-clip-text text-transparent">
            You have entered the dungeon
          </h1>
          <p className="mx-auto max-w-xl text-zinc-300 leading-relaxed">
            Your campaign access is ready. The party awaits, the chaos is legally binding,
            and your next questionable decision is only one button away.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Link
            to={homePath}
            className={`inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold text-white bg-linear-to-r transition hover:brightness-110 motion-safe:hover:-translate-y-0.5 ${theme.button}`}
          >
            Enter Home
          </Link>
          <p className="text-xs text-zinc-500 text-center">
            You can always use the sidebar to explore sessions, items, and everything else that now owns part of your soul.
          </p>
        </div>
      </section>
    </main>
  );
}
