import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";

import { auth } from "../../firebase/firebase";
import { validatePasswordForAuth } from "../../auth/passwordValidation";
import {
  getAuthErrorMessage,
  getPasswordRequirements,
} from "../../auth/authMessages";
import GradientBackground from "../GradientBackground";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PasswordField({
  id,
  label,
  name,
  autoComplete,
  value,
  onChange,
  visible,
  onToggleVisibility,
  visibilityLabel,
}) {
  const toggleLabel = `${visible ? "Hide" : "Show"} ${visibilityLabel}`;

  return (
    <div>
      <label htmlFor={id} className="block text-[clamp(16px,1.0625rem,22px)] leading-[1.4] font-medium text-zinc-200">
        {label}
      </label>
      <div className="relative mt-[10px]">
        <LockKeyhole className="pointer-events-none absolute left-[16px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-zinc-500" aria-hidden="true" />
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={onChange}
          className="h-[56px] w-full rounded-md border border-zinc-700 bg-zinc-950 pl-[52px] pr-[60px] text-[clamp(16px,1rem,20px)] text-white outline-none transition focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-[6px] top-1/2 flex h-[44px] w-[44px] -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 hover:text-white focus-visible:outline-2 focus-visible:outline-purple-300"
          aria-label={toggleLabel}
          aria-pressed={visible}
          title={toggleLabel}
        >
          {visible ? <EyeOff className="h-[22px] w-[22px]" aria-hidden="true" /> : <Eye className="h-[22px] w-[22px]" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export default function AuthScreen({
  onGoogle,
  onEmailSignIn,
  onEmailRegistration,
}) {
  const [view, setView] = useState("choices");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegistering = view === "register";
  const passwordToValidate = isRegistering ? password : "";

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const result = await validatePasswordForAuth(auth, passwordToValidate);
        if (!cancelled) setPasswordValidation(result);
      } catch {
        if (!cancelled) setPasswordValidation(null);
      }
    }, passwordToValidate ? 150 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [passwordToValidate]);

  function openEmailView(nextView) {
    setView(nextView);
    setError("");
    setPassword("");
    setConfirmation("");
    setShowPassword(false);
    setShowConfirmation(false);
  }

  async function handleGoogle() {
    setError("");
    setSubmitting(true);
    try {
      await onGoogle();
    } catch (authError) {
      setError(getAuthErrorMessage(authError, "google"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (isRegistering && password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      if (isRegistering) {
        const validation = await validatePasswordForAuth(auth, password);
        setPasswordValidation(validation);
        if (!validation.isValid) {
          setError("Your password does not meet the requirements below.");
          return;
        }
        await onEmailRegistration(normalizedEmail, password);
      } else {
        await onEmailSignIn(normalizedEmail, password);
      }
    } catch (authError) {
      setError(
        getAuthErrorMessage(authError, isRegistering ? "register" : "sign-in")
      );
    } finally {
      setSubmitting(false);
    }
  }

  const passwordRequirements = getPasswordRequirements(passwordValidation);

  return (
    <GradientBackground>
      <main className="min-h-screen text-zinc-100">
        <div className="relative mx-auto flex min-h-screen w-full items-center justify-center px-[16px] py-[32px] sm:py-[48px]">
          <section className="w-[calc(100vw-32px)] max-w-[480px]" aria-labelledby="auth-title">
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
            {view === "choices" ? (
              <>
                <h1 id="auth-title" className="text-[clamp(28px,1.875rem,38px)] leading-[1.2] font-semibold text-white sm:whitespace-nowrap">
                  Sign in to your account
                </h1>
                <p className="mt-[12px] text-[clamp(16px,1.0625rem,20px)] leading-[1.6] text-zinc-400 sm:whitespace-nowrap">
                  Choose how you want to continue.
                </p>

                <div className="mt-[32px] grid gap-[16px]">
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={submitting}
                    className="flex min-h-[56px] w-full items-center justify-center gap-[12px] rounded-md border border-zinc-700 bg-zinc-800 px-[24px] py-[14px] text-[clamp(16px,1.0625rem,22px)] font-semibold whitespace-nowrap text-white transition hover:border-zinc-500 hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <LoaderCircle className="h-[22px] w-[22px] animate-spin" aria-hidden="true" />
                    ) : (
                      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white text-[clamp(14px,0.875rem,18px)] font-bold text-zinc-900" aria-hidden="true">
                        G
                      </span>
                    )}
                    Continue with Google
                  </button>
                  <button
                    type="button"
                    onClick={() => openEmailView("sign-in")}
                    disabled={submitting}
                    className="flex min-h-[56px] w-full items-center justify-center gap-[12px] rounded-md border border-zinc-700 bg-zinc-800 px-[24px] py-[14px] text-[clamp(16px,1.0625rem,22px)] font-semibold whitespace-nowrap text-white transition hover:border-zinc-500 hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Mail className="h-[22px] w-[22px]" aria-hidden="true" />
                    Continue with email
                  </button>
                </div>

                <p className="-mx-[16px] mt-[28px] flex flex-wrap items-center justify-center gap-x-[6px] text-center text-[clamp(16px,1.0625rem,20px)] leading-[1.45] text-zinc-400 sm:flex-nowrap">
                  <span>New to Dopamine Dungeon?</span>
                  <button
                    type="button"
                    onClick={() => openEmailView("register")}
                    className="inline-flex min-h-[44px] items-center px-[4px] align-middle font-semibold whitespace-nowrap text-purple-300 underline decoration-purple-400/70 underline-offset-4 hover:text-purple-100 hover:decoration-current focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                  >
                    Create an account
                  </button>
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openEmailView("choices")}
                  className="mb-[24px] inline-flex h-[48px] w-[48px] items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                  aria-label="Back to sign-in choices"
                  title="Back"
                >
                  <ArrowLeft className="h-[22px] w-[22px]" aria-hidden="true" />
                </button>

                <h1 id="auth-title" className="text-[clamp(28px,1.875rem,38px)] leading-[1.2] font-semibold text-white sm:whitespace-nowrap">
                  {isRegistering ? "Create your account" : "Sign in with email"}
                </h1>
                <p className={`mt-[12px] text-[clamp(16px,1.0625rem,20px)] leading-[1.6] text-zinc-400 ${isRegistering ? "" : "sm:whitespace-nowrap"}`}>
                  {isRegistering
                    ? "We'll send a verification link before you can enter the app."
                    : "Use the email and password for your account."}
                </p>

                <form className="mt-[32px] space-y-[24px]" onSubmit={handleSubmit} noValidate>
                  <label className="block text-[clamp(16px,1.0625rem,22px)] leading-[1.4] font-medium text-zinc-200">
                    Email address
                    <div className="relative mt-[10px]">
                      <Mail className="pointer-events-none absolute left-[16px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                      <input
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
                  </label>

                  <PasswordField
                    id="password"
                    label="Password"
                    name="password"
                    autoComplete={isRegistering ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    visible={showPassword}
                    onToggleVisibility={() => setShowPassword((visible) => !visible)}
                    visibilityLabel="password"
                  />

                  {isRegistering && (
                    <>
                      {passwordRequirements.length > 0 && (
                        <ul className="grid gap-[8px] text-[clamp(14px,0.875rem,18px)] leading-[1.4] text-zinc-400" aria-label="Password requirements">
                          {passwordRequirements.map((requirement) => (
                            <li key={requirement.key} className="flex items-center gap-2">
                              <Check className={`h-[16px] w-[16px] shrink-0 ${requirement.met ? "text-emerald-400" : "text-zinc-600"}`} aria-hidden="true" />
                              {requirement.label}
                            </li>
                          ))}
                        </ul>
                      )}

                      <PasswordField
                        id="password-confirmation"
                        label="Confirm password"
                        name="password-confirmation"
                        autoComplete="new-password"
                        value={confirmation}
                        onChange={(event) => setConfirmation(event.target.value)}
                        visible={showConfirmation}
                        onToggleVisibility={() => setShowConfirmation((visible) => !visible)}
                        visibilityLabel="confirm password"
                      />
                    </>
                  )}

                  {error && (
                    <div className="rounded-md border border-red-900/80 bg-red-950/50 px-[16px] py-[12px] text-[clamp(16px,1rem,20px)] leading-[1.5] text-red-200" role="alert" aria-live="polite">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex min-h-[56px] w-full items-center justify-center gap-[8px] rounded-md bg-purple-600 px-[24px] py-[14px] text-[clamp(16px,1.0625rem,22px)] font-bold whitespace-nowrap text-white transition hover:bg-purple-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting && <LoaderCircle className="h-[22px] w-[22px] animate-spin" aria-hidden="true" />}
                    {submitting
                      ? isRegistering ? "Creating account..." : "Signing in..."
                      : isRegistering ? "Create account" : "Sign in"}
                  </button>
                </form>

                <p className="mt-[28px] text-center text-[clamp(16px,1.0625rem,20px)] leading-[1.45] text-zinc-400">
                  {isRegistering ? "Already have an account?" : "Need an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => openEmailView(isRegistering ? "sign-in" : "register")}
                    className="inline-flex min-h-[44px] items-center px-[4px] align-middle font-semibold whitespace-nowrap text-purple-300 underline decoration-purple-400/70 underline-offset-4 hover:text-purple-100 hover:decoration-current focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                  >
                    {isRegistering ? "Sign in" : "Create one"}
                  </button>
                </p>
              </>
            )}

            {view === "choices" && error && (
              <div className="mt-[24px] rounded-md border border-red-900/80 bg-red-950/50 px-[16px] py-[12px] text-[clamp(16px,1rem,20px)] leading-[1.5] text-red-200" role="alert" aria-live="polite">
                {error}
              </div>
            )}
          </div>
          </section>
        </div>
      </main>
    </GradientBackground>
  );
}
