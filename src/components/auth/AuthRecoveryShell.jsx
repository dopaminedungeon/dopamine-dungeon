import GradientBackground from "../GradientBackground";

export default function AuthRecoveryShell({ title, description, children }) {
  return (
    <GradientBackground>
      <main className="min-h-screen text-zinc-100">
        <div className="relative mx-auto flex min-h-screen w-full items-center justify-center px-[16px] py-[32px] sm:py-[48px]">
          <section className="w-[calc(100vw-32px)] max-w-[480px]" aria-labelledby="recovery-title">
            <header className="mb-[32px] flex w-full items-center gap-[20px]" data-testid="auth-brand">
              <img
                src="/logo/icon-192.png"
                alt=""
                className="h-[64px] w-[64px] rounded-lg border border-zinc-700 bg-zinc-900"
              />
              <div>
                <p className="text-[clamp(22px,1.5rem,30px)] leading-[1.2] font-semibold text-purple-300">Dopamine Dungeon</p>
                <p className="mt-[4px] text-[clamp(16px,1.125rem,22px)] leading-[1.35] text-zinc-400">TTRPG Manager</p>
              </div>
            </header>

            <div className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-[24px] shadow-2xl shadow-black/30 sm:p-[36px]" data-testid="auth-card">
              <h1 id="recovery-title" className="text-[clamp(28px,1.875rem,38px)] leading-[1.2] font-semibold text-white">
                {title}
              </h1>
              {description && (
                <p className="mt-[12px] text-[clamp(16px,1.0625rem,20px)] leading-[1.6] text-zinc-400">
                  {description}
                </p>
              )}
              {children}
            </div>
          </section>
        </div>
      </main>
    </GradientBackground>
  );
}
