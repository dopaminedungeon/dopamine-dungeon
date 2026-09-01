import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

const publicLinks = [
  ["About Us", "/about"],
  ["Features", "/features"],
  ["Pricing", "/pricing"],
  ["Resources", "/resources"],
  ["Socials", "/socials"],
];

export default function PublicSiteShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="relative border-b border-zinc-800/90 bg-zinc-950/95">
        <nav
          aria-label="Public navigation"
          className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-[18px] sm:flex-nowrap sm:px-6 xl:gap-x-[28px] xl:py-[20px]"
        >
          <Link
            to="/"
            className="flex w-full shrink-0 items-center gap-2 whitespace-nowrap text-[18px] font-semibold tracking-tight text-white sm:w-auto sm:gap-3 sm:text-[22px]"
            data-testid="public-brand"
          >
            <img
              src="/logo/dd-app-icon-master.png"
              alt=""
              className="h-[36px] w-[36px] shrink-0 rounded-lg object-contain sm:h-[44px] sm:w-[44px]"
            />
            <span>Dopamine Dungeon</span>
          </Link>

          <div className="hidden flex-wrap items-center justify-end gap-x-[28px] gap-y-2 text-[16px] xl:flex">
            {publicLinks.map(([label, path]) => (
              <Link
                key={path}
                to={path}
                className="text-zinc-300 transition hover:text-white"
              >
                {label}
              </Link>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-zinc-800 sm:block" aria-hidden="true" />
            <Link
              to="/login"
              className="text-zinc-200 transition hover:text-white"
              data-testid="public-login"
            >
              Log in
            </Link>
            <Link
              to="/get-started"
              className="rounded-md border border-violet-400/60 px-4 py-2 font-semibold text-violet-200 transition hover:border-violet-300 hover:bg-violet-500/10 hover:text-white"
              data-testid="public-sign-up"
            >
              Sign up
            </Link>
          </div>

          <div className="flex w-full shrink-0 items-center justify-end gap-2 text-[14px] sm:w-auto sm:gap-3 sm:text-[16px] xl:hidden">
            <Link
              to="/login"
              className="text-zinc-200 transition hover:text-white"
            >
              Log in
            </Link>
            <Link
              to="/get-started"
              className="rounded-md border border-violet-400/60 px-3 py-2 font-semibold text-violet-200 transition hover:border-violet-300 hover:bg-violet-500/10 hover:text-white"
            >
              Sign up
            </Link>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-zinc-700 text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
              aria-expanded={menuOpen}
              aria-controls="public-mobile-menu"
              aria-label={menuOpen ? "Close public navigation" : "Open public navigation"}
              data-testid="public-menu-toggle"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div
            id="public-mobile-menu"
            role="menu"
            aria-label="Public menu"
            className="absolute right-4 top-full z-20 w-[min(220px,calc(100vw-32px))] rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl shadow-black/40 xl:hidden"
            data-testid="public-mobile-menu"
          >
            {publicLinks.map(([label, path]) => (
              <Link
                key={path}
                to={path}
                role="menuitem"
                className="block rounded-lg px-4 py-3 text-[15px] text-zinc-200 transition hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-300"
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </header>

      <Outlet />
    </div>
  );
}

export function PublicHome() {
  return (
    <main
      className="mx-auto grid min-h-[calc(100vh-84px)] w-full max-w-[1200px] items-center gap-10 px-6 py-10 text-center sm:py-14 lg:grid-cols-[minmax(0,600px)_minmax(420px,480px)] lg:justify-between lg:gap-16 lg:py-14 lg:text-left"
      data-testid="public-home"
    >
      <section className="w-full max-w-[600px]">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.25em] text-violet-300">
          TTRPG campaign management
        </p>
        <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-[clamp(56px,5vw,68px)]">
          Organize the chaos of every campaign.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-300">
          Dopamine Dungeon keeps your campaign world, sessions, and party ready
          when your table is.
        </p>
        <p
          className="mt-8 inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-violet-200"
          data-testid="coming-soon"
        >
          Coming soon
        </p>
        <div className="mt-8 flex justify-center lg:justify-start">
          <Link
            to="/home"
            className="inline-flex rounded-md bg-violet-500 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            data-testid="enter-dungeon"
          >
            Enter The Dungeon
          </Link>
        </div>
      </section>

      <aside
        aria-label="Dopamine Dungeon artwork placeholder"
        className="relative mx-auto flex aspect-square w-full max-w-[480px] items-center justify-center overflow-hidden rounded-[2rem] border border-violet-400/20 bg-[radial-gradient(circle_at_50%_38%,rgba(139,92,246,0.3),transparent_42%),linear-gradient(145deg,rgba(39,39,42,0.9),rgba(9,9,11,0.98))] shadow-2xl shadow-violet-950/30"
        data-testid="public-artwork"
      >
        <div className="absolute inset-8 rounded-[1.5rem] border border-white/10" />
        <img
          src="/logo/dd-app-icon-master.png"
          alt="Dopamine Dungeon"
          className="relative h-40 w-40 object-contain opacity-90 drop-shadow-[0_0_32px_rgba(167,139,250,0.45)] sm:h-52 sm:w-52"
        />
      </aside>
    </main>
  );
}

export function PublicFeatures() {
  return <PublicComingSoonPage title="Features" testId="public-features" />;
}

export function PublicComingSoonPage({ title, testId = "public-coming-soon" }) {
  return (
    <main
      className="mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-7xl items-center justify-center px-6 py-16"
      data-testid={testId}
    >
      <section className="w-full max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 text-center shadow-2xl shadow-black/20 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-300">
          Coming soon
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-400">
          This public section is reserved for a future release.
        </p>
      </section>
    </main>
  );
}

export function PublicSocialsPage() {
  return (
    <main
      className="mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-7xl items-center justify-center px-6 py-16"
      data-testid="public-socials"
    >
      <section className="w-full max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 text-center shadow-2xl shadow-black/20 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-300">
          Coming soon
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">Socials</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-400">
          Community links will be available here in a future release.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {["YouTube", "Discord", "Instagram"].map((label) => (
            <button
              key={label}
              type="button"
              disabled
              className="rounded-xl border border-dashed border-zinc-700 px-4 py-4 text-left text-sm font-semibold text-zinc-500"
            >
              {label}
              <span className="mt-1 block text-xs font-normal text-zinc-600">Unavailable — coming soon</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
