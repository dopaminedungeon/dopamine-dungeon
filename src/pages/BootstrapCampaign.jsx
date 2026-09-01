import CreateCampaignForm from "../components/bootstrap/CreateCampaignForm";
import BootstrapSignOutControl from "../components/bootstrap/BootstrapSignOutControl";
import BootstrapWorkspaceSwitcher from "../components/bootstrap/BootstrapWorkspaceSwitcher";
import GradientBackground from "../components/GradientBackground";

export default function BootstrapCampaign({ onLogout }) {
  return (
    <GradientBackground>
      <main className="relative flex min-h-screen w-full items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="absolute top-4 left-4 z-10 sm:top-6 sm:left-6 lg:left-8">
          <BootstrapWorkspaceSwitcher />
        </div>

        <div
          className="w-full max-w-[520px] space-y-5 pt-28 sm:pt-0"
          data-testid="campaign-bootstrap-content"
        >
          <section
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/30 sm:p-9"
            aria-labelledby="campaign-bootstrap-title"
            data-testid="campaign-bootstrap-card"
          >
            <header className="flex items-center gap-5" data-testid="campaign-bootstrap-brand">
              <img
                src="/logo/icon-192.png"
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg border border-zinc-700 bg-zinc-900"
              />
              <div>
                <p className="text-[clamp(22px,1.5rem,30px)] font-semibold leading-[1.2] text-purple-300">
                  Dopamine Dungeon
                </p>
                <p className="mt-1 text-[clamp(16px,1.125rem,22px)] leading-[1.35] text-zinc-400">
                  TTRPG Manager
                </p>
              </div>
            </header>

            <div className="my-8 border-t border-zinc-800" />

            <div>
              <h1
                id="campaign-bootstrap-title"
                className="text-[clamp(28px,1.875rem,38px)] font-semibold leading-[1.2] text-white"
              >
                Create your first campaign
              </h1>
              <p className="mt-3 text-[clamp(16px,1.0625rem,20px)] leading-[1.6] text-zinc-400">
                Your campaign is where sessions, characters, inventory, and story state come together.
              </p>
            </div>

            <CreateCampaignForm />
          </section>

          <BootstrapSignOutControl onLogout={onLogout} />
        </div>
      </main>
    </GradientBackground>
  );
}
