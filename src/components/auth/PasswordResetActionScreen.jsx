import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";

import { getPasswordRequirements } from "../../auth/authMessages";
import {
  getPasswordResetFailureState,
  PASSWORD_RESET_SERVICE_ERROR,
  preparePasswordRecovery,
  readPasswordResetAction,
} from "../../auth/passwordRecovery";
import { validatePasswordForAuth } from "../../auth/passwordValidation";
import { isAuthTestMode } from "../../config/firebase/firebase";
import { auth } from "../../firebase/firebase";
import AuthRecoveryShell from "./AuthRecoveryShell";
import PasswordField from "./PasswordField";
import PasswordRequirements from "./PasswordRequirements";

const RESULT_CONTENT = {
  expired: {
    title: "Reset link expired",
    description: "This password-reset link has expired. Request a new email to continue safely.",
  },
  invalid: {
    title: "Reset link unavailable",
    description: "This password-reset link is invalid or has already been used. Request a new email to continue.",
  },
  failure: {
    title: "Password reset unavailable",
    description: PASSWORD_RESET_SERVICE_ERROR,
  },
  success: {
    title: "Password updated",
  },
};

export default function PasswordResetActionScreen() {
  const visualTestState = new URLSearchParams(window.location.search).get("testState");
  const initialState = isAuthTestMode && visualTestState && RESULT_CONTENT[visualTestState]
    ? visualTestState
    : "checking";
  const [state, setState] = useState(initialState);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const actionCode = useRef("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (isAuthTestMode && visualTestState && RESULT_CONTENT[visualTestState]) {
      return;
    }

    async function processAction() {
      setState("checking");
      setError("");
      try {
        await preparePasswordRecovery(auth);
        const action = readPasswordResetAction(window.location.search);
        if (!action.valid) {
          setState("invalid");
          return;
        }

        await verifyPasswordResetCode(auth, action.oobCode);
        actionCode.current = action.oobCode;
        window.history.replaceState(null, "", "/auth/reset-password");
        setState("ready");
      } catch (actionError) {
        setState(getPasswordResetFailureState(actionError));
      }
    }

    processAction();
  }, [verificationAttempt, visualTestState]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await validatePasswordForAuth(
          auth,
          state === "ready" ? password : ""
        );
        if (!cancelled) setPasswordValidation(result);
      } catch {
        if (!cancelled) setPasswordValidation(null);
      }
    }, password ? 150 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [password, state]);

  function retryVerification() {
    started.current = false;
    setVerificationAttempt((attempt) => attempt + 1);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const validation = await validatePasswordForAuth(auth, password);
      setPasswordValidation(validation);
      if (!validation.isValid) {
        setError("Your password does not meet the requirements.");
        return;
      }

      await confirmPasswordReset(auth, actionCode.current, password);
      actionCode.current = "";
      setPassword("");
      setConfirmation("");
      setState("success");
    } catch (resetError) {
      if (resetError?.code === "auth/weak-password") {
        setError("Your password does not meet the requirements.");
        return;
      }

      const failureState = getPasswordResetFailureState(resetError);
      if (failureState === "failure") {
        setError(PASSWORD_RESET_SERVICE_ERROR);
      } else {
        actionCode.current = "";
        setState(failureState);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "checking") {
    return (
      <AuthRecoveryShell
        title="Checking your reset link"
        description="Please wait while Firebase verifies this password-reset link."
      >
        <div className="mt-[32px] flex items-center gap-[10px] text-zinc-300" role="status">
          <LoaderCircle className="h-[22px] w-[22px] animate-spin text-purple-300" aria-hidden="true" />
          Verifying link…
        </div>
      </AuthRecoveryShell>
    );
  }

  if (state !== "ready") {
    const content = RESULT_CONTENT[state] ?? RESULT_CONTENT.failure;
    const isSuccess = state === "success";
    return (
      <AuthRecoveryShell title={content.title} description={content.description}>
        <div className={`mt-[28px] flex items-center gap-[10px] rounded-md border px-[16px] py-[14px] ${isSuccess ? "border-emerald-900/80 bg-emerald-950/40 text-emerald-200" : "border-amber-900/80 bg-amber-950/40 text-amber-200"}`} role={isSuccess ? "status" : "alert"}>
          {isSuccess ? <CheckCircle2 className="h-[20px] w-[20px] shrink-0" aria-hidden="true" /> : <AlertTriangle className="h-[20px] w-[20px] shrink-0" aria-hidden="true" />}
          {isSuccess
            ? "Your password has been changed successfully. You can now sign in with your new password."
            : "No application data was loaded."}
        </div>

        {state === "failure" && (
          <button
            type="button"
            onClick={retryVerification}
            className="mt-[24px] min-h-[56px] w-full rounded-md bg-purple-600 px-[24px] py-[14px] text-[clamp(16px,1.0625rem,22px)] font-bold text-white transition hover:bg-purple-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"
          >
            Try again
          </button>
        )}

        <a
          href={isSuccess ? "/" : "/auth/recover"}
          className="mt-[16px] flex min-h-[56px] w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 px-[24px] py-[14px] text-[clamp(16px,1.0625rem,22px)] font-semibold text-white transition hover:border-zinc-500 hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"
        >
          {isSuccess ? "Return to sign in" : "Request another reset"}
        </a>
      </AuthRecoveryShell>
    );
  }

  const passwordRequirements = getPasswordRequirements(passwordValidation);

  return (
    <AuthRecoveryShell
      title="Choose a new password"
      description="Use the same password requirements as account registration."
    >
      <form className="mt-[32px] space-y-[24px]" onSubmit={handleSubmit} noValidate>
        <PasswordField
          id="new-password"
          label="New password"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          visible={showPassword}
          onToggleVisibility={() => setShowPassword((visible) => !visible)}
          visibilityLabel="new password"
        />

        <PasswordRequirements requirements={passwordRequirements} />

        <PasswordField
          id="new-password-confirmation"
          label="Confirm new password"
          name="new-password-confirmation"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          visible={showConfirmation}
          onToggleVisibility={() => setShowConfirmation((visible) => !visible)}
          visibilityLabel="confirm new password"
        />

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
          {submitting ? "Updating password..." : "Update password"}
        </button>
      </form>
    </AuthRecoveryShell>
  );
}
