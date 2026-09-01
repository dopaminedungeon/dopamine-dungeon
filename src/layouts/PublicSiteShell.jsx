import { Link, Outlet } from "react-router-dom";

export default function PublicSiteShell() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/95">
        <nav
          aria-label="Public navigation"
          className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4"
        >
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-white"
            data-testid="public-brand"
          >
            Dopamine Dungeon
          </Link>

          <div className="flex items-center gap-4 text-sm">
            <Link
              to="/features"
              className="text-zinc-300 transition hover:text-white"
            >
              Features
            </Link>
            <Link
              to="/home"
              className="rounded-md bg-violet-500 px-4 py-2 font-semibold text-white transition hover:bg-violet-400"
              data-testid="enter-app"
            >
              Enter App
            </Link>
          </div>
        </nav>
      </header>

      <Outlet />
    </div>
  );
}

export function PublicHome() {
  return (
    <main
      className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-6xl items-center px-6 py-16"
      data-testid="public-home"
    >
      <section className="max-w-2xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-violet-300">
          TTRPG campaign management
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Organize the chaos of every campaign.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-300">
          Dopamine Dungeon keeps your campaign world, sessions, and party ready
          when your table is.
        </p>
      </section>
    </main>
  );
}

export function PublicFeatures() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16" data-testid="public-features">
      <h1 className="text-3xl font-bold text-white">Features</h1>
      <p className="mt-4 max-w-2xl text-zinc-300">
        Build a shared campaign workspace, manage your table, and keep every
        adventure organized.
      </p>
    </main>
  );
}
