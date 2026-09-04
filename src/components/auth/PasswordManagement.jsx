import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { reload } from "firebase/auth";

import { auth } from "../../firebase/firebase";
import {
  GOOGLE_PROVIDER_ID,
  PASSWORD_PROVIDER_ID,
  captureFirebaseCredentialState,
  classifyCredentialMigrationError,
  getSignInMethodState,
  hasConnectedProvider,
  isIdentityContinuityResponseValid,
  isVerifiedGoogleFirstCredentialState,
  preservesVerifiedGoogleFirstCredentialState,
  clearPendingCredentialMigration,
} from "../../auth/credentialMigration";
import { getPasswordRequirements } from "../../auth/authMessages";
import { validatePasswordForAuth } from "../../auth/passwordValidation";
import {
  linkPasswordToFirebaseUser,
  reauthenticateFirebaseUserWithGoogle,
  reauthenticatePasswordUser,
  updateFirebaseUserPassword,
} from "../../auth/firebaseCredentialMigration";
import {
  getApiMe,
  getIdentityContinuity,
  restoreVerifiedPasswordLink,
} from "../../data/api/apiClient";
import GoogleProviderLinking from "./GoogleProviderLinking";
import PasswordField from "./PasswordField";
import PasswordRequirements from "./PasswordRequirements";

function failureMessage(error, operation) {
  const kind = classifyCredentialMigrationError(error);
  if (kind === "identity-conflict") {
    return "This sign-in method belongs to a different account. No accounts or Dopamine Dungeon data were merged.";
  }
  if (kind === "reauthentication-cancelled") {
    return "Google confirmation was cancelled. You can try again.";
  }
  if (operation === "change" && (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-login-credentials")) {
    return "Your current password could not be confirmed.";
  }
  if (kind === "reauthentication-required") {
    return "Recent authentication is required before changing this sign-in method.";
  }
  return operation === "change"
    ? "Could not update your password. Please try again."
    : "Could not configure your password. Please try again.";
}

export default function PasswordManagement({
  firebaseUser,
  onProviderStateChange,
}) {
  const originalUidRef = useRef(firebaseUser?.uid || "");
  const originalEmailRef = useRef(firebaseUser?.email || "");
  const neonUserIdRef = useRef("");
  const operationRef = useRef(false);
  const [providers, setProviders] = useState(null);
  const [providerStateStatus, setProviderStateStatus] = useState("loading");
  const [mode, setMode] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState(null);
  const [status, setStatus] = useState({ type: null, message: "" });
  const [submitting, setSubmitting] = useState(false);

  const clearSensitiveState = () => {
    setCurrentPassword("");
    setPassword("");
    setConfirmation("");
    setShowCurrentPassword(false);
    setShowPassword(false);
    setShowConfirmation(false);
  };

  const currentFirebaseUserIsOriginal = () => {
    const currentUser = auth.currentUser;
    return Boolean(
      currentUser &&
        currentUser.uid === originalUidRef.current &&
        currentUser.email === originalEmailRef.current
    );
  };

  async function verifyContinuity({ initial = false } = {}) {
    if (!currentFirebaseUserIsOriginal()) return false;
    try {
      // `/api/me` is the existing authenticated reconciliation boundary. For a
      // Firebase-verified account it records (without replacing) the first
      // `users.email_verified_at` timestamp under the exact Firebase UID.
      const reconciled = await getApiMe();
      const result = await getIdentityContinuity();
      if (
        !isIdentityContinuityResponseValid(
          result,
          originalUidRef.current,
          initial ? "" : neonUserIdRef.current
        )
      ) {
        return false;
      }
      if (reconciled?.user?.id !== result.neonUserId) return false;
      if (initial) {
        neonUserIdRef.current = result.neonUserId;
      }
      return true;
    } catch {
      return false;
    }
  }

  async function refreshProviderState() {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentFirebaseUserIsOriginal()) {
      setProviders(null);
      setProviderStateStatus("unavailable");
      return false;
    }
    try {
      await reload(currentUser);
      const nextProviders = getSignInMethodState(currentUser);
      setProviders(nextProviders);
      setProviderStateStatus(nextProviders ? "ready" : "unavailable");
      return Boolean(nextProviders);
    } catch {
      setProviders(null);
      setProviderStateStatus("unavailable");
      return false;
    }
  }

  useEffect(() => {
    refreshProviderState();
    // The authenticated identity is captured by the mounted profile session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      if (!password) {
        if (!cancelled) setPasswordValidation(null);
        return;
      }
      try {
        const validation = await validatePasswordForAuth(auth, password);
        if (!cancelled) setPasswordValidation(validation);
      } catch {
        if (!cancelled) setPasswordValidation(null);
      }
    }, password ? 150 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [password]);

  function beginPasswordAction(nextMode) {
    clearSensitiveState();
    setStatus({ type: null, message: "" });
    setMode(nextMode);
  }

  async function handleGoogleReauthentication() {
    if (operationRef.current) return;
    operationRef.current = true;
    setSubmitting(true);
    setStatus({ type: null, message: "" });
    clearSensitiveState();
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentFirebaseUserIsOriginal()) throw new Error("identity");
      await reauthenticateFirebaseUserWithGoogle(currentUser);
      if (!currentFirebaseUserIsOriginal()) throw new Error("identity");
      setMode("set");
    } catch (error) {
      setStatus({ type: "error", message: failureMessage(error, "set") });
    } finally {
      operationRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (operationRef.current || !mode) return;
    setStatus({ type: null, message: "" });

    if (password !== confirmation) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    operationRef.current = true;
    setSubmitting(true);
    try {
      const validation = await validatePasswordForAuth(auth, password);
      setPasswordValidation(validation);
      if (!validation.isValid) {
        setStatus({ type: "error", message: "Your password does not meet the requirements." });
        return;
      }

      if (!(await refreshProviderState())) {
        clearSensitiveState();
        setStatus({ type: "error", message: "Your sign-in method state is temporarily unavailable. Try again later." });
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser || !currentFirebaseUserIsOriginal() || !(await verifyContinuity({ initial: !neonUserIdRef.current }))) {
        clearSensitiveState();
        setStatus({ type: "error", message: "Your sign-in method state is temporarily unavailable. Try again later." });
        return;
      }

      if (mode === "set") {
        const preLinkState = captureFirebaseCredentialState(currentUser);
        if (!isVerifiedGoogleFirstCredentialState(preLinkState)) {
          clearSensitiveState();
          setStatus({
            type: "error",
            message: "Your email must be verified before you can add a password.",
          });
          return;
        }

        // Keep the token in this function scope only. The server independently
        // verifies its email_verified claim if a provider link unexpectedly
        // drops Firebase's current verified state.
        const preLinkVerifiedToken = await currentUser.getIdToken(true);

        // This Profile Settings flow is not the legacy credential-migration
        // verification flow. A stale, UID-scoped session latch must not cause
        // a verified Google account to request another verification email.
        clearPendingCredentialMigration();
        await linkPasswordToFirebaseUser(currentUser, originalEmailRef.current, password);

        clearSensitiveState();
        if (!(await refreshProviderState())) {
          setStatus({ type: "error", message: "Your sign-in method state is temporarily unavailable. Try again later." });
          return;
        }

        const postLinkState = captureFirebaseCredentialState(auth.currentUser);
        if (
          postLinkState?.uid !== preLinkState.uid ||
          postLinkState.email !== preLinkState.email ||
          !postLinkState.providerIds.includes(GOOGLE_PROVIDER_ID) ||
          !postLinkState.providerIds.includes(PASSWORD_PROVIDER_ID)
        ) {
          setStatus({
            type: "error",
            message: "Your account identity changed unexpectedly while adding a password. No password setup was confirmed. Please sign in again and contact support if this continues.",
          });
          return;
        }
        if (!postLinkState.emailVerified) {
          await restoreVerifiedPasswordLink(preLinkVerifiedToken);
          await auth.currentUser?.getIdToken(true);
          if (!(await refreshProviderState())) {
            setStatus({ type: "error", message: "Your sign-in method state is temporarily unavailable. Try again later." });
            return;
          }
        }
        if (
          !preservesVerifiedGoogleFirstCredentialState(
            preLinkState,
            captureFirebaseCredentialState(auth.currentUser)
          )
        ) {
          setStatus({
            type: "error",
            message: "Your verified Google account could not be confirmed after password setup. Please sign in again and contact support if this continues.",
          });
          return;
        }
      } else {
        await reauthenticatePasswordUser(currentUser, originalEmailRef.current, currentPassword);
        if (!currentFirebaseUserIsOriginal()) throw new Error("identity");
        await updateFirebaseUserPassword(currentUser, password);
      }

      clearSensitiveState();
      if (!(await refreshProviderState()) || !hasConnectedProvider(auth.currentUser, PASSWORD_PROVIDER_ID) || !(await verifyContinuity())) {
        setStatus({ type: "error", message: "Your password changed, but account continuity could not be confirmed. Try again later." });
        return;
      }
      setMode(null);
      setStatus({ type: "success", message: mode === "set" ? "Password configured" : "Password updated" });
      onProviderStateChange?.();
    } catch (error) {
      clearSensitiveState();
      if (classifyCredentialMigrationError(error) === "reauthentication-required" && mode === "set" && providers?.hasGoogle) {
        setMode("reauthenticate-google");
        setStatus({ type: "error", message: "Recent authentication is required. Confirm your Google sign-in, then enter a new password again." });
      } else {
        setStatus({ type: "error", message: failureMessage(error, mode) });
      }
    } finally {
      operationRef.current = false;
      setSubmitting(false);
    }
  }

  const passwordRequirements = getPasswordRequirements(passwordValidation);
  const isChange = mode === "change";

  return (
    <section className="bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Sign-in methods</h2>
        <p className="text-zinc-500 text-sm mt-1">
          Manage sign-in methods for your account only.
        </p>
      </div>

      {!providers ? (
        <p className="text-sm text-zinc-400" role="status">
          {providerStateStatus === "unavailable"
            ? "Sign-in method state is temporarily unavailable. Try again later."
            : "Checking sign-in methods…"}
        </p>
      ) : (
        <>
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-white">Google</p>
              <p className={providers.hasGoogle ? "text-sm text-emerald-300" : "text-sm text-zinc-400"}>
                {providers.hasGoogle ? "Connected" : "Not connected"}
              </p>
            </div>
          </div>
          <div className="border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-white">Email &amp; password</p>
              <p className={providers.hasPassword ? "text-sm text-emerald-300" : "text-sm text-amber-300"}>
                {providers.hasPassword ? "Password configured" : "No password configured"}
              </p>
            </div>
            {!mode ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => beginPasswordAction(providers.hasPassword ? "change" : "set")}
                className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
              >
                {providers.hasPassword ? "Change password" : "Set password"}
              </button>
            ) : null}
          </div>
        </div>
        {!providers.hasGoogle && providers.hasPassword ? (
          <GoogleProviderLinking
            firebaseUser={firebaseUser}
            onComplete={async () => {
              await refreshProviderState();
              setStatus({ type: "success", message: "Google sign-in is connected" });
              onProviderStateChange?.();
            }}
          />
        ) : null}
        </>
      )}

      {mode === "reauthenticate-google" ? (
        <div className="space-y-3">
          <p className="text-sm text-zinc-300">
            Confirm your Google sign-in before setting a password.
          </p>
          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogleReauthentication}
            className="w-full rounded-md bg-purple-600 px-4 py-3 font-bold text-white disabled:opacity-60"
          >
            {submitting ? "Confirming…" : "Confirm with Google"}
          </button>
        </div>
      ) : null}

      {mode === "set" || mode === "change" ? (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm text-zinc-400">
            Account email: <span className="text-zinc-200">{originalEmailRef.current || "Unavailable"}</span>
          </p>
          {isChange ? (
            <PasswordField
              id="current-password"
              label="Current password"
              name="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              visible={showCurrentPassword}
              onToggleVisibility={() => setShowCurrentPassword((visible) => !visible)}
              visibilityLabel="current password"
            />
          ) : null}
          <PasswordField
            id="new-password"
            label="New password"
            name="newPassword"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            visible={showPassword}
            onToggleVisibility={() => setShowPassword((visible) => !visible)}
            visibilityLabel="new password"
          />
          <PasswordRequirements requirements={passwordRequirements} />
          <PasswordField
            id="confirm-new-password"
            label="Confirm new password"
            name="confirmNewPassword"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            visible={showConfirmation}
            onToggleVisibility={() => setShowConfirmation((visible) => !visible)}
            visibilityLabel="confirm new password"
          />
          <button
            type="submit"
            disabled={submitting || !password || !confirmation || (isChange && !currentPassword)}
            className="w-full rounded-md bg-purple-600 px-4 py-3 font-bold text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {submitting ? "Saving…" : isChange ? "Change password" : "Set password"}
          </button>
        </form>
      ) : null}

      {status.message ? (
        <div
          className={`flex gap-3 rounded-md border p-4 text-sm ${
            status.type === "success"
              ? "border-emerald-900/80 bg-emerald-950/40 text-emerald-100"
              : "border-amber-900/80 bg-amber-950/40 text-amber-100"
          }`}
          role={status.type === "success" ? "status" : "alert"}
        >
          {status.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <span>{status.message}</span>
        </div>
      ) : null}
    </section>
  );
}
