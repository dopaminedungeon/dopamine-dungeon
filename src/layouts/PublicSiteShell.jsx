import { Link, Outlet } from "react-router-dom";

const publicLinks = [
  ["About Us", "/about"],
  ["Features", "/features"],
  ["Pricing", "/pricing"],
  ["Resources", "/resources"],
  ["Socials", "/socials"],
];

export default function PublicSiteShell() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/90 bg-zinc-950/95">
        <nav
          aria-label="Public navigation"
          className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-x-8 gap-y-4 px-6 py-4 lg:py-5"
        >
          <Link
            to="/"
            className="flex items-center gap-3 text-[22px] font-semibold tracking-tight text-white"
            data-testid="public-brand"
          >
            <img
              src="/logo/dd-app-icon-master.png"
              alt=""
              className="h-11 w-11 rounded-lg object-contain"
            />
            <span>Dopamine Dungeon</span>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-x-7 gap-y-2 text-base">
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
        </nav>
      </header>

      <Outlet />
    </div>
  );
}

export function PublicHome() {
  return (
    <main
      className="mx-auto grid min-h-[calc(100vh-84px)] w-full max-w-[1080px] items-center gap-10 px-6 py-10 sm:py-14 lg:grid-cols-[minmax(0,520px)_minmax(360px,400px)] lg:justify-between lg:gap-14 lg:py-14"
      data-testid="public-home"
    >
      <section className="w-full max-w-[520px]">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.25em] text-violet-300">
          TTRPG campaign management
        </p>
        <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-[clamp(52px,5vw,64px)]">
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
        <div className="mt-8">
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
        className="relative mx-auto flex aspect-square w-full max-w-[400px] items-center justify-center overflow-hidden rounded-[2rem] border border-violet-400/20 bg-[radial-gradient(circle_at_50%_38%,rgba(139,92,246,0.3),transparent_42%),linear-gradient(145deg,rgba(39,39,42,0.9),rgba(9,9,11,0.98))] shadow-2xl shadow-violet-950/30"
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
      className="mx-auto flex min-h-[calc(100vh-91px)] w-full max-w-7xl items-center px-6 py-16"
      data-testid={testId}
    >
      <section className="w-full max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl shadow-black/20 sm:p-12">
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
      className="mx-auto flex min-h-[calc(100vh-91px)] w-full max-w-7xl items-center px-6 py-16"
      data-testid="public-socials"
    >
      <section className="w-full max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl shadow-black/20 sm:p-12">
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
