import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";
import { reload } from "firebase/auth";

import { auth } from "../../firebase/firebase";
import {
  classifyGoogleLinkingError,
  GOOGLE_PROVIDER_ID,
  hasConnectedProvider,
  isIdentityContinuityResponseValid,
} from "../../auth/credentialMigration";
import {
  getPendingGoogleCredentialFromError,
  linkGoogleToFirebaseUser,
  linkPendingGoogleCredentialToFirebaseUser,
  reauthenticatePasswordUser,
} from "../../auth/firebaseCredentialMigration";
import { getIdentityContinuity } from "../../data/api/apiClient";
import PasswordField from "./PasswordField";

const GENERIC_FAILURE = "Could not connect Google. Please try again.";
const GENERIC_PASSWORD_FAILURE = "Could not confirm your password. Please try again.";

export default function GoogleProviderLinking({
  firebaseUser,
  onComplete,
}) {
  const originalUidRef = useRef(firebaseUser?.uid || "");
  const originalEmailRef = useRef(firebaseUser?.email || "");
  const neonUserIdRef = useRef("");
  const pendingGoogleCredentialRef = useRef(null);
  const linkingRef = useRef(false);
  const initialPreflightPromiseRef = useRef(null);
  const [stage, setStage] = useState("checking");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      if (
        !isIdentityContinuityResponseValid(
          result,
          originalUidRef.current,
          initial ? "" : neonUserIdRef.current
        )
      ) {
        return false;
      }
      if (initial) {
        neonUserIdRef.current = result.neonUserId;
        return true;
      }
      return true;
    } catch {
      return false;
    }
  }

  async function finishLinkedSetup() {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== originalUidRef.current) {
      setStage("verification");
      return false;
    }

    await reload(currentUser);
    await currentUser.getIdToken(true);
    if (
      currentUser.uid !== originalUidRef.current ||
      currentUser.email !== originalEmailRef.current ||
      !hasConnectedProvider(currentUser, GOOGLE_PROVIDER_ID)
    ) {
      setStage("verification");
      return false;
    }

    if (!(await verifyContinuity())) {
      setStage("verification");
      return false;
    }

    pendingGoogleCredentialRef.current = null;
    setStage("success");
    onComplete?.(currentUser);
    return true;
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
      } else if (hasConnectedProvider(auth.currentUser, GOOGLE_PROVIDER_ID)) {
        try {
          await finishLinkedSetup();
        } catch {
          setStage("verification");
        }
      } else {
        setStage("ready");
      }
    }

    runPreflight();
    return () => {
      cancelled = true;
    };
    // The original identity is intentionally captured once for continuity checks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnectGoogle() {
    if (linkingRef.current) return;
    linkingRef.current = true;
    setSubmitting(true);
    setError("");
    pendingGoogleCredentialRef.current = null;

    try {
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
      if (hasConnectedProvider(currentUser, GOOGLE_PROVIDER_ID)) {
        await finishLinkedSetup();
        return;
      }

      setStage("popup");
      await linkGoogleToFirebaseUser(currentUser);
      setStage("verification");
      await finishLinkedSetup();
    } catch (linkError) {
      const pendingCredential = getPendingGoogleCredentialFromError(linkError);
      const failure = classifyGoogleLinkingError(linkError, {
        hasPendingCredential: Boolean(pendingCredential),
      });
      if (failure === "password-reauthentication-required") {
        pendingGoogleCredentialRef.current = pendingCredential;
        setStage("password-reauthentication");
        setError("");
      } else if (failure === "already-linked") {
        try {
          await finishLinkedSetup();
        } catch {
          setStage("verification");
        }
      } else if (failure === "cancelled") {
        pendingGoogleCredentialRef.current = null;
        setStage("ready");
        setError("Google sign-in was cancelled. You can try again.");
      } else if (failure === "identity-conflict") {
        pendingGoogleCredentialRef.current = null;
        setStage("conflict");
      } else {
        pendingGoogleCredentialRef.current = null;
        setStage("ready");
        setError(GENERIC_FAILURE);
      }
    } finally {
      linkingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handlePasswordConfirmation(event) {
    event.preventDefault();
    if (linkingRef.current) return;
    linkingRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      const currentUser = auth.currentUser;
      if (
        !currentUser ||
        currentUser.uid !== originalUidRef.current ||
        currentUser.email !== originalEmailRef.current
      ) {
        setStage("unavailable");
        return;
      }

      await reauthenticatePasswordUser(
        currentUser,
        originalEmailRef.current,
        password
      );
      if (
        auth.currentUser?.uid !== originalUidRef.current ||
        auth.currentUser?.email !== originalEmailRef.current
      ) {
        setStage("unavailable");
        return;
      }

      if (pendingGoogleCredentialRef.current) {
        await linkPendingGoogleCredentialToFirebaseUser(
          currentUser,
          pendingGoogleCredentialRef.current
        );
      } else {
        await linkGoogleToFirebaseUser(currentUser);
      }
      setPassword("");
      setStage("verification");
      await finishLinkedSetup();
    } catch (reauthError) {
      const failure = classifyGoogleLinkingError(reauthError);
      setPassword("");
      if (failure === "already-linked") {
        try {
          await finishLinkedSetup();
        } catch {
          setStage("verification");
        }
      } else if (failure === "password-reauthentication-failed") {
        setError(GENERIC_PASSWORD_FAILURE);
      } else if (failure === "identity-conflict") {
        pendingGoogleCredentialRef.current = null;
        setStage("conflict");
      } else if (failure === "password-reauthentication-required") {
        setError("Please confirm your password again before continuing.");
      } else {
        pendingGoogleCredentialRef.current = null;
        setError(GENERIC_FAILURE);
      }
    } finally {
      linkingRef.current = false;
      setSubmitting(false);
    }
  }

  async function retryPreflight() {
    setStage("checking");
    setError("");
    setStage((await verifyContinuity({ initial: true })) ? "ready" : "unavailable");
  }

  async function retryPostLinkVerification() {
    setSubmitting(true);
    setError("");
    try {
      await finishLinkedSetup();
    } catch {
      setStage("verification");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4">
      <div className="mb-4">
        <h3 className="font-semibold text-white">Connect Google sign-in</h3>
        <p className="mt-1 text-sm text-zinc-300">
          Add Google as another way to access this account.
        </p>
      </div>

      {stage === "checking" && (
        <div className="mt-6 flex items-center gap-2 text-zinc-300" role="status">
          <LoaderCircle className="h-5 w-5 animate-spin text-purple-300" aria-hidden="true" />
          Checking account setup...
        </div>
      )}

      {(stage === "ready" || stage === "popup") && (
        <div className="mt-6 space-y-4">
          {error && <div className="rounded-md border border-red-900/80 bg-red-950/50 px-4 py-3 text-red-200" role="alert" aria-live="polite">{error}</div>}
          <button type="button" disabled={submitting} onClick={handleConnectGoogle} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-6 py-3 font-bold text-white hover:bg-purple-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting && <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {stage === "popup" ? "Connecting..." : "Connect Google"}
          </button>
        </div>
      )}

      {stage === "password-reauthentication" && (
        <form className="mt-6 space-y-5" onSubmit={handlePasswordConfirmation} noValidate>
          <div className="rounded-md border border-amber-900/80 bg-amber-950/40 p-4 text-amber-100" role="status">
            Confirm your password before connecting this sign-in method.
          </div>
          <PasswordField
            id="google-linking-password"
            label="Password"
            name="current-password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            visible={showPassword}
            onToggleVisibility={() => setShowPassword((visible) => !visible)}
            visibilityLabel="password"
          />
          {error && <div className="rounded-md border border-red-900/80 bg-red-950/50 px-4 py-3 text-red-200" role="alert" aria-live="polite">{error}</div>}
          <button type="submit" disabled={submitting || !password} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-6 py-3 font-bold text-white hover:bg-purple-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting && <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {submitting ? "Confirming..." : "Confirm password"}
          </button>
        </form>
      )}

      {(stage === "unavailable" || stage === "verification" || stage === "conflict") && (
        <div className="mt-6 space-y-4">
          <div className="flex gap-3 rounded-md border border-amber-900/80 bg-amber-950/40 p-4 text-amber-100" role="alert">
            <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Google connection unavailable</p>
              <p className="mt-1 text-sm">
                {stage === "verification"
                  ? "This sign-in method was added, but we could not verify account continuity. Try the check again."
                  : stage === "conflict"
                    ? "This sign-in method belongs to a different account. No accounts or application data were merged."
                    : "We could not verify the existing application account. Try again later."}
              </p>
            </div>
          </div>
          {error && <div className="text-red-200" role="alert" aria-live="polite">{error}</div>}
          {stage !== "conflict" && (
            <button type="button" disabled={submitting} onClick={stage === "verification" ? retryPostLinkVerification : retryPreflight} className="min-h-14 w-full rounded-md bg-purple-600 px-6 py-3 font-bold text-white disabled:opacity-60">
              {submitting ? "Checking..." : "Try again"}
            </button>
          )}
        </div>
      )}

      {stage === "success" && (
        <div className="mt-6">
          <div className="flex gap-3 rounded-md border border-emerald-900/80 bg-emerald-950/40 p-4 text-emerald-100" role="status">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Google sign-in is connected</p>
              <p className="mt-1 text-sm">Google and Email / Password use the same Dopamine Dungeon account.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
