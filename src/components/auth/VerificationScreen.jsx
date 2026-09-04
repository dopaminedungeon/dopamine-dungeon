import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";

import {
  formatRetryAfterSeconds,
  getAuthErrorMessage,
} from "../../auth/authMessages";
import GradientBackground from "../GradientBackground";

export default function VerificationScreen({
  email,
  onCheckVerification,
  onResendVerification,
  onLogout,
  verificationEmailSentAt,
  initialError = "",
}) {
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [serverRetryUntil, setServerRetryUntil] = useState(0);
  const cooldownUntil = Math.max(
    (verificationEmailSentAt ?? 0) + 60_000,
    serverRetryUntil
  );
  const cooldownSeconds = Math.max(
    0,
    Math.ceil((cooldownUntil - now) / 1000)
  );

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  async function runAction(nextAction, callback) {
    setAction(nextAction);
    setMessage("");
    setError("");
    try {
      const result = await callback();
      if (nextAction === "check" && result === false) {
        setError("Your email is not verified yet. Open the link in your email, then try again.");
      } else if (nextAction === "resend") {
        setServerRetryUntil(0);
        setMessage("A new verification email has been sent.");
      }
    } catch (authError) {
      if (
        authError?.status === 429 &&
        Number(authError?.retryAfterSeconds) > 0
      ) {
        const retryStartedAt = Date.now();
        setServerRetryUntil(
          retryStartedAt + Number(authError.retryAfterSeconds) * 1000
        );
        setNow(retryStartedAt);
      }
      setError(getAuthErrorMessage(authError, "verification"));
    } finally {
      setAction("");
    }
  }

  return (
    <GradientBackground>
      <main className="min-h-screen text-zinc-100">
        <div className="relative mx-auto flex min-h-screen w-full items-center justify-center px-[16px] py-[32px] sm:py-[48px]">
        <section className="w-[calc(100vw-32px)] max-w-[480px] rounded-lg border border-zinc-800 bg-zinc-900 p-[24px] text-center shadow-2xl shadow-black/30 sm:p-[36px]" aria-labelledby="verification-title" data-testid="auth-card">
          <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-full bg-purple-400/10 text-purple-300">
            <Mail className="h-[32px] w-[32px]" aria-hidden="true" />
          </div>
          <h1 id="verification-title" className="mt-[28px] text-[clamp(28px,1.875rem,38px)] leading-[1.2] font-semibold text-white sm:whitespace-nowrap">
            Verify your email
          </h1>
          <p className="mt-[14px] text-[clamp(16px,1.0625rem,22px)] leading-[1.6] text-zinc-400">
            We sent a verification link to <strong className="break-words font-semibold text-zinc-200">{email}</strong>. Verify your address before entering Dopamine Dungeon.
          </p>

          {message && (
            <div className="mt-[24px] flex items-center justify-center gap-[8px] rounded-md border border-emerald-900/80 bg-emerald-950/40 px-[16px] py-[12px] text-[clamp(14px,0.875rem,18px)] leading-[1.4] text-emerald-200" role="status">
              <CheckCircle2 className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              {message}
            </div>
          )}
          {error && (
            <div className="mt-[24px] rounded-md border border-red-900/80 bg-red-950/50 px-[16px] py-[12px] text-[clamp(14px,0.875rem,18px)] leading-[1.4] text-red-200" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => runAction("check", onCheckVerification)}
            disabled={Boolean(action)}
            className="mt-[32px] flex min-h-[56px] w-full items-center justify-center gap-[8px] rounded-md bg-purple-600 px-[24px] py-[14px] text-[clamp(16px,1.0625rem,22px)] font-bold whitespace-nowrap text-white transition hover:bg-purple-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {action === "check" && <LoaderCircle className="h-[22px] w-[22px] animate-spin" aria-hidden="true" />}
            I've verified my email
          </button>
          <button
            type="button"
            onClick={() => runAction("resend", onResendVerification)}
            disabled={Boolean(action) || cooldownSeconds > 0}
            className="mt-[16px] min-h-[56px] w-full rounded-md border border-zinc-700 bg-zinc-800 px-[24px] py-[14px] text-[clamp(16px,1.0625rem,22px)] font-semibold whitespace-nowrap text-white transition hover:border-zinc-500 hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cooldownSeconds > 0
              ? `Resend available in ${formatRetryAfterSeconds(cooldownSeconds)}`
              : "Resend verification email"}
          </button>
          <button
            type="button"
            onClick={onLogout}
            disabled={Boolean(action)}
            className="mt-[18px] inline-flex min-h-[44px] items-center justify-center px-[8px] text-[clamp(16px,1.0625rem,22px)] font-medium whitespace-nowrap text-zinc-400 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:opacity-60"
          >
            Use a different account
          </button>
          </section>
        </div>
      </main>
    </GradientBackground>
  );
}
