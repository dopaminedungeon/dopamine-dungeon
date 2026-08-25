import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  LogOut,
  ShieldAlert,
} from "lucide-react";
import { reload } from "firebase/auth";

import { auth } from "../../firebase/firebase";
import { getPasswordRequirements } from "../../auth/authMessages";
import {
  classifyCredentialMigrationError,
  readPendingCredentialMigration,
  hasConnectedProvider,
  PASSWORD_PROVIDER_ID,
  storePendingCredentialMigration,
} from "../../auth/credentialMigration";
import { validatePasswordForAuth } from "../../auth/passwordValidation";
import {
  linkPasswordToFirebaseUser,
  reauthenticateFirebaseUserWithGoogle,
} from "../../auth/firebaseCredentialMigration";
import { getIdentityContinuity } from "../../data/api/apiClient";
import AuthRecoveryShell from "./AuthRecoveryShell";
import PasswordField from "./PasswordField";
import PasswordRequirements from "./PasswordRequirements";

const GENERIC_FAILURE = "Could not add this sign-in method. Please try again.";
const GENERIC_REAUTH_FAILURE = "Could not confirm your Google sign-in. Please try again.";

function Frame({ standalone, children }) {
  if (standalone) {
    return (
      <AuthRecoveryShell
        title="Add another way to sign in"
        description="Dopamine Dungeon now supports email and password authentication. Set a password for your existing account to continue."
      >
        {children}
      </AuthRecoveryShell>
    );
  }

  return <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4">{children}</div>;
}

export default function CredentialMigration({
  firebaseUser,
  onComplete,
  onLogout,
  standalone = false,
}) {
  const originalUidRef = useRef(firebaseUser?.uid || "");
  const originalEmailRef = useRef(firebaseUser?.email || "");
  const neonUserIdRef = useRef("");
  const linkingRef = useRef(false);
  const signingOutRef = useRef(false);
  const initialPreflightPromiseRef = useRef(null);
  const completingRef = useRef(false);
  const [stage, setStage] = useState("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function verifyContinuity({ initial = false } = {}) {
    const currentUser = auth.currentUser;
    if (
      !currentUser ||
      currentUser.uid !== originalUidRef.current ||
      currentUser.email !== originalEmailRef.current
    ) {
      return false;
    }

    try {
      const result = await getIdentityContinuity();
      if (!result?.neonUserId) return false;
      if (initial) {
        const pending = readPendingCredentialMigration(originalUidRef.current);
        if (pending) {
          neonUserIdRef.current = pending.neonUserId;
          return result.neonUserId === pending.neonUserId;
        }
        neonUserIdRef.current = result.neonUserId;
        storePendingCredentialMigration(
          originalUidRef.current,
          result.neonUserId
        );
      }
      return initial || result.neonUserId === neonUserIdRef.current;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function runPreflight() {
      setStage("checking");
      setError("");
      initialPreflightPromiseRef.current ||= verifyContinuity({ initial: true });
      const valid = await initialPreflightPromiseRef.current;
      if (cancelled) return;
      if (!valid) {
        setStage("unavailable");
      } else if (hasConnectedProvider(auth.currentUser, PASSWORD_PROVIDER_ID)) {
        try {
          setStage((await finishLinkedMigration()) ? "success" : "verification");
        } catch {
          setStage("verification");
        }
      } else {
        setStage("form");
      }
    }

    runPreflight();
    return () => {
      cancelled = true;
    };
    // The original identity is intentionally captured once for continuity checks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await validatePasswordForAuth(
          auth,
          stage === "form" ? password : ""
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
  }, [password, stage]);

  async function finishLinkedMigration() {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== originalUidRef.current) return false;

    await reload(currentUser);
    await currentUser.getIdToken(true);
    if (
      currentUser.uid !== originalUidRef.current ||
      currentUser.email !== originalEmailRef.current ||
      !hasConnectedProvider(currentUser, PASSWORD_PROVIDER_ID)
    ) {
      return false;
    }

    return verifyContinuity();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (linkingRef.current) return;
    setError("");

    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    linkingRef.current = true;
    setSubmitting(true);
    try {
      const validation = await validatePasswordForAuth(auth, password);
      setPasswordValidation(validation);
      if (!validation.isValid) {
        setError("Your password does not meet the requirements.");
        return;
      }

      const currentUser = auth.currentUser;
      if (
        !currentUser ||
        currentUser.uid !== originalUidRef.current ||
        currentUser.email !== originalEmailRef.current
      ) {
        setStage("unavailable");
        return;
      }

      await reload(currentUser);
      if (!hasConnectedProvider(currentUser, PASSWORD_PROVIDER_ID)) {
        await linkPasswordToFirebaseUser(
          currentUser,
          originalEmailRef.current,
          password
        );
      }

      setPassword("");
      setConfirmation("");
      if (await finishLinkedMigration()) {
        setStage("success");
      } else {
        setStage("verification");
      }
    } catch (migrationError) {
      setPassword("");
      setConfirmation("");
      const failure = classifyCredentialMigrationError(migrationError);
      if (failure === "reauthentication-required") {
        setStage("reauthentication");
      } else if (failure === "already-linked") {
        try {
          setStage((await finishLinkedMigration()) ? "success" : "verification");
        } catch {
          setStage("verification");
        }
      } else if (failure === "identity-conflict") {
        setStage("conflict");
      } else {
        setError(GENERIC_FAILURE);
      }
    } finally {
      linkingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleReauthentication() {
    if (linkingRef.current) return;
    linkingRef.current = true;
    setSubmitting(true);
    setError("");
    setPassword("");
    setConfirmation("");
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== originalUidRef.current) {
        setStage("unavailable");
        return;
      }
      await reauthenticateFirebaseUserWithGoogle(currentUser);
      if (
        auth.currentUser?.uid !== originalUidRef.current ||
        auth.currentUser?.email !== originalEmailRef.current
      ) {
        setStage("unavailable");
      } else {
        setStage("form");
      }
    } catch (reauthError) {
      const failure = classifyCredentialMigrationError(reauthError);
      setError(
        failure === "reauthentication-cancelled"
          ? "Google confirmation was cancelled. You can try again."
          : GENERIC_REAUTH_FAILURE
      );
    } finally {
      linkingRef.current = false;
      setSubmitting(false);
    }
  }

  async function retryPreflight() {
    setStage("checking");
    setError("");
    setStage((await verifyContinuity({ initial: true })) ? "form" : "unavailable");
  }

  async function retryPostLinkVerification() {
    setSubmitting(true);
    setError("");
    try {
      setStage((await finishLinkedMigration()) ? "success" : "verification");
    } catch {
      setStage("verification");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    setError("");
    try {
      await onLogout();
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      signingOutRef.current = false;
      setSigningOut(false);
    }
  }

  async function handleComplete() {
    if (completingRef.current) return;
    completingRef.current = true;
    setCompleting(true);
    try {
      await onComplete(auth.currentUser);
    } finally {
      completingRef.current = false;
      setCompleting(false);
    }
  }

  const passwordRequirements = getPasswordRequirements(passwordValidation);
  const isForm = stage === "form";

  return (
    <Frame standalone={standalone}>
      {!standalone && (
        <div className="mb-4">
          <h3 className="font-semibold text-white">Add another way to sign in</h3>
          <p className="mt-1 text-sm text-zinc-300">
            Dopamine Dungeon now supports email and password authentication. Set a password for your existing account to continue.
          </p>
        </div>
      )}

      {stage === "checking" && (
        <div className="mt-6 flex items-center gap-2 text-zinc-300" role="status">
          <LoaderCircle className="h-5 w-5 animate-spin text-purple-300" aria-hidden="true" />
          Checking account setup…
        </div>
      )}

      {isForm && (
        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="credential-migration-email" className="block text-base font-medium text-zinc-200">Email</label>
            <input
              id="credential-migration-email"
              type="email"
              value={originalEmailRef.current}
              readOnly
              className="mt-2 h-14 w-full rounded-md border border-zinc-700 bg-zinc-950 px-4 text-zinc-300"
            />
          </div>
          <PasswordField
            id="credential-migration-password"
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
            id="credential-migration-confirmation"
            label="Confirm password"
            name="confirm-password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            visible={showConfirmation}
            onToggleVisibility={() => setShowConfirmation((visible) => !visible)}
            visibilityLabel="confirm password"
          />
          {error && <div className="rounded-md border border-red-900/80 bg-red-950/50 px-4 py-3 text-red-200" role="alert" aria-live="polite">{error}</div>}
          <button type="submit" disabled={submitting} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-6 py-3 font-bold text-white hover:bg-purple-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting && <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {submitting ? "Setting password…" : "Set password"}
          </button>
        </form>
      )}

      {stage === "reauthentication" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-md border border-amber-900/80 bg-amber-950/40 p-4 text-amber-100" role="status">
            For your security, confirm your Google sign-in before setting a password. You will need to enter the password again afterward.
          </div>
          {error && <div className="text-red-200" role="alert" aria-live="polite">{error}</div>}
          <button type="button" disabled={submitting} onClick={handleReauthentication} className="min-h-14 w-full rounded-md bg-purple-600 px-6 py-3 font-bold text-white disabled:opacity-60">
            {submitting ? "Confirming…" : "Continue with Google"}
          </button>
        </div>
      )}

      {(stage === "unavailable" || stage === "verification" || stage === "conflict") && (
        <div className="mt-6 space-y-4">
          <div className="flex gap-3 rounded-md border border-amber-900/80 bg-amber-950/40 p-4 text-amber-100" role="alert">
            <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Account setup unavailable</p>
              <p className="mt-1 text-sm">
                {stage === "verification"
                  ? "Your sign-in method was added, but we could not verify account continuity. Try the check again."
                  : stage === "conflict"
                    ? "This credential belongs to a different account. No accounts or application data were merged."
                    : "We could not verify the existing application account. Try again or sign out."}
              </p>
            </div>
          </div>
          {error && <div className="text-red-200" role="alert" aria-live="polite">{error}</div>}
          {stage !== "conflict" && (
            <button type="button" disabled={submitting} onClick={stage === "verification" ? retryPostLinkVerification : retryPreflight} className="min-h-14 w-full rounded-md bg-purple-600 px-6 py-3 font-bold text-white disabled:opacity-60">
              {submitting ? "Checking…" : "Try again"}
            </button>
          )}
        </div>
      )}

      {stage === "success" && (
        <div className="mt-6 space-y-4">
          <div className="flex gap-3 rounded-md border border-emerald-900/80 bg-emerald-950/40 p-4 text-emerald-100" role="status">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Password sign-in is ready</p>
              <p className="mt-1 text-sm">Your Google sign-in remains connected to the same Dopamine Dungeon account.</p>
            </div>
          </div>
          <button type="button" disabled={completing} onClick={handleComplete} className="min-h-14 w-full rounded-md bg-purple-600 px-6 py-3 font-bold text-white disabled:opacity-60">
            {completing ? "Continuing…" : "Continue to Dopamine Dungeon"}
          </button>
        </div>
      )}

      {stage !== "success" && (
        <button type="button" disabled={signingOut} onClick={handleLogout} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-3 font-semibold text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:opacity-60">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      )}
    </Frame>
  );
}
