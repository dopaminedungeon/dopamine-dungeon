import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";

import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "../../auth/formValidation";
import {
  PASSWORD_RESET_CONFIRMATION,
  PASSWORD_RESET_SERVICE_ERROR,
  preparePasswordRecovery,
  shouldShowPasswordResetConfirmation,
} from "../../auth/passwordRecovery";
import { auth } from "../../firebase/firebase";
import { requestPasswordResetEmail } from "../../data/api/apiClient";
import AuthRecoveryShell from "./AuthRecoveryShell";

export default function PasswordRecoveryRequestScreen() {
  const [preparationState, setPreparationState] = useState("preparing");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [preparationAttempt, setPreparationAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPreparationState("preparing");

    preparePasswordRecovery(auth)
      .then(() => {
        if (!cancelled) setPreparationState("ready");
      })
      .catch(() => {
        if (!cancelled) setPreparationState("failure");
      });

    return () => {
      cancelled = true;
    };
  }, [preparationAttempt]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const normalizedEmail = normalizeEmailAddress(email);
    if (!isValidEmailAddress(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordResetEmail(normalizedEmail);
      setConfirmation(true);
      setEmail("");
    } catch (requestError) {
      if (shouldShowPasswordResetConfirmation(requestError)) {
        setConfirmation(true);
        setEmail("");
      } else {
        setError(PASSWORD_RESET_SERVICE_ERROR);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (preparationState === "preparing") {
    return (
      <AuthRecoveryShell
        title="Preparing password recovery"
        description="Please wait while we prepare a secure, signed-out recovery session."
      >
        <div className="mt-[32px] flex items-center gap-[10px] text-zinc-300" role="status">
          <LoaderCircle className="h-[22px] w-[22px] animate-spin text-purple-300" aria-hidden="true" />
          Loading…
        </div>
      </AuthRecoveryShell>
    );
  }

  if (preparationState === "failure") {
    return (
      <AuthRecoveryShell
        title="Password recovery unavailable"
        description={PASSWORD_RESET_SERVICE_ERROR}
      >
        <button
          type="button"
          onClick={() => setPreparationAttempt((attempt) => attempt + 1)}
          className="mt-[32px] min-h-[56px] w-full rounded-md bg-purple-600 px-[24px] py-[14px] text-[clamp(16px,1.0625rem,22px)] font-bold text-white transition hover:bg-purple-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"
        >
          Try again
        </button>
        <a href="/login" className="mt-[16px] flex min-h-[44px] items-center justify-center text-zinc-400 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300">
          Return to sign in
        </a>
      </AuthRecoveryShell>
    );
  }

  if (confirmation) {
    return (
      <AuthRecoveryShell
        title="Check your email"
        description={PASSWORD_RESET_CONFIRMATION}
      >
        <div className="mt-[28px] flex items-center gap-[10px] rounded-md border border-emerald-900/80 bg-emerald-950/40 px-[16px] py-[14px] text-emerald-200" role="status">
          <CheckCircle2 className="h-[20px] w-[20px] shrink-0" aria-hidden="true" />
          You can close this page after opening the instructions in your email.
        </div>
        <button
          type="button"
          onClick={() => {
            setConfirmation(false);
            setError("");
          }}
          className="mt-[24px] min-h-[56px] w-full rounded-md border border-zinc-700 bg-zinc-800 px-[24px] py-[14px] text-[clamp(16px,1.0625rem,22px)] font-semibold text-white transition hover:border-zinc-500 hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"
        >
          Request another reset
        </button>
        <a href="/login" className="mt-[12px] flex min-h-[44px] items-center justify-center text-zinc-400 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300">
          Return to sign in
        </a>
      </AuthRecoveryShell>
    );
  }

  return (
    <AuthRecoveryShell
      title="Reset your password"
      description="Enter your email address and we'll send password-reset instructions when the account supports password sign-in."
    >
      <form className="mt-[32px] space-y-[24px]" onSubmit={handleSubmit} noValidate>
        <label htmlFor="recovery-email" className="block text-[clamp(16px,1.0625rem,22px)] leading-[1.4] font-medium text-zinc-200">
          Email address
        </label>
        <div className="relative -mt-[14px]">
          <Mail className="pointer-events-none absolute left-[16px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            id="recovery-email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-[56px] w-full rounded-md border border-zinc-700 bg-zinc-950 pl-[52px] pr-[16px] text-[clamp(16px,1rem,20px)] text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
            placeholder="you@example.com"
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-900/80 bg-red-950/50 px-[16px] py-[12px] text-[clamp(16px,1rem,20px)] leading-[1.5] text-red-200" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-[56px] w-full items-center justify-center gap-[8px] rounded-md bg-purple-600 px-[24px] py-[14px] text-[clamp(16px,1.0625rem,22px)] font-bold text-white transition hover:bg-purple-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <LoaderCircle className="h-[22px] w-[22px] animate-spin" aria-hidden="true" />}
          {submitting ? "Sending instructions..." : "Send reset instructions"}
        </button>
      </form>

      <a href="/login" className="mt-[18px] flex min-h-[44px] items-center justify-center text-zinc-400 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300">
        Return to sign in
      </a>
    </AuthRecoveryShell>
  );
}
