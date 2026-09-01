import CreateWorkspaceForm from "../components/bootstrap/CreateWorkspaceForm";
import BootstrapSignOutControl from "../components/bootstrap/BootstrapSignOutControl";
import GradientBackground from "../components/GradientBackground";

export default function BootstrapWorkspace({ onLogout }) {
  return (
    <GradientBackground>
      <main className="flex min-h-screen w-full items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-[480px] space-y-5">
          <section
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/30 sm:p-9"
            aria-labelledby="workspace-bootstrap-title"
            data-testid="workspace-bootstrap-card"
          >
            <header className="flex items-center gap-5" data-testid="workspace-bootstrap-brand">
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
                id="workspace-bootstrap-title"
                className="text-[clamp(28px,1.875rem,38px)] font-semibold leading-[1.2] text-white"
              >
                Create your first workspace
              </h1>
              <p className="mt-3 text-[clamp(16px,1.0625rem,20px)] leading-[1.6] text-zinc-400">
                Your workspace is the shared home for your campaigns.
              </p>
            </div>

            <CreateWorkspaceForm />
          </section>

          <BootstrapSignOutControl onLogout={onLogout} />
        </div>
      </main>
    </GradientBackground>
  );
}
