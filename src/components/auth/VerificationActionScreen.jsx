import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LogIn,
} from "lucide-react";
import { applyActionCode, checkActionCode, reload } from "firebase/auth";

import { auth } from "../../firebase/firebase";
import {
  getVerificationFailureState,
  readVerificationAction,
} from "../../auth/verificationAction";
import {
  clearInvitationContext,
  getPostVerificationPath,
  preserveInvitationContext,
} from "../../auth/invitationContext";
import GradientBackground from "../GradientBackground";
import { isAuthTestMode } from "../../config/firebase/firebase";

const CONTENT = {
  checking: {
    icon: LoaderCircle,
    title: "Verifying your email",
    body: "Please wait while Dopamine Dungeon confirms your verification link.",
    tone: "text-purple-300",
  },
  success: {
    icon: CheckCircle2,
    title: "Email verified",
    body: "Your email is verified. Continuing to Dopamine Dungeon...",
    tone: "text-emerald-300",
  },
  "sign-in-required": {
    icon: CheckCircle2,
    title: "Email verified",
    body: "Your email is verified. Sign in once to continue securely.",
    tone: "text-emerald-300",
  },
  "already-verified": {
    icon: CheckCircle2,
    title: "Email already verified",
    body: "This address is already verified. Continue securely with your current session or sign in.",
    tone: "text-emerald-300",
  },
  expired: {
    icon: Clock3,
    title: "Verification link expired",
    body: "This verification link has expired. Return to verification to request a new email.",
    tone: "text-amber-300",
  },
  invalid: {
    icon: AlertTriangle,
    title: "Verification link unavailable",
    body: "This link is invalid or has already been used. Return to verification or sign in to continue.",
    tone: "text-amber-300",
  },
  failure: {
    icon: AlertTriangle,
    title: "Verification unavailable",
    body: "We could not process this verification link. Try again or return to sign in.",
    tone: "text-red-300",
  },
  "refresh-failed": {
    icon: AlertTriangle,
    title: "Email verified, sign-in needed",
    body: "Firebase confirmed your email, but this browser could not refresh your session. Sign in once to continue.",
    tone: "text-amber-300",
  },
  "access-failed": {
    icon: AlertTriangle,
    title: "Account access unavailable",
    body: "Your email is verified, but we could not finish resolving your account access. Try again before continuing.",
    tone: "text-amber-300",
  },
  "inactive-invitation": {
    icon: AlertTriangle,
    title: "Invitation no longer available",
    body: "Your email is verified, but this invitation was revoked, expired, or is no longer active.",
    tone: "text-amber-300",
  },
};

export default function VerificationActionScreen({
  accessResolutionStatus,
  onContinueVerifiedSession,
  onRetryAccessResolution,
  onSignOut,
}) {
  const visualTestState = new URLSearchParams(window.location.search).get("testState");
  const initialState = isAuthTestMode && visualTestState && CONTENT[visualTestState]
    ? visualTestState
    : "checking";
  const [state, setState] = useState(initialState);
  const [continuationPath, setContinuationPath] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    preserveInvitationContext();

    if (isAuthTestMode && visualTestState && CONTENT[visualTestState]) {
      return;
    }

    async function continueSession(nextState = "success") {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setState(nextState === "already-verified" ? nextState : "sign-in-required");
        return;
      }

      try {
        await reload(currentUser);
        if (!currentUser.emailVerified) {
          setState("sign-in-required");
          return;
        }
        const continued = await onContinueVerifiedSession(currentUser);
        if (!continued) {
          setState("refresh-failed");
          return;
        }
        setState(nextState);
        setContinuationPath(getPostVerificationPath());
      } catch {
        setState("refresh-failed");
      }
    }

    async function processAction() {
      const action = readVerificationAction(window.location.search);
      if (!action.valid) {
        setState("invalid");
        return;
      }

      try {
        await checkActionCode(auth, action.oobCode);
        await applyActionCode(auth, action.oobCode);
        await continueSession("success");
      } catch (error) {
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            await reload(currentUser);
          } catch {
            // The error state below remains recoverable.
          }
        }
        const failureState = getVerificationFailureState(
          error,
          auth.currentUser?.emailVerified === true
        );
        if (failureState === "already-verified") {
          await continueSession("already-verified");
          return;
        }
        setState(failureState);
      }
    }

    processAction();
  }, [onContinueVerifiedSession, visualTestState]);

  useEffect(() => {
    if (!continuationPath) return;

    if (accessResolutionStatus === "resolved") {
      window.location.replace(continuationPath);
    }
  }, [accessResolutionStatus, continuationPath]);

  const displayedState =
    continuationPath && accessResolutionStatus === "error"
      ? "access-failed"
      : continuationPath && accessResolutionStatus === "inactiveInvitation"
        ? "inactive-invitation"
      : state;
  const content = CONTENT[displayedState] ?? CONTENT.failure;
  const Icon = content.icon;
  const isBusy = displayedState === "checking" || displayedState === "success";
  const isAccessFailure = displayedState === "access-failed";
  const isInactiveInvitation = displayedState === "inactive-invitation";
  const canReturnToVerification = Boolean(auth.currentUser && !auth.currentUser.emailVerified);

  async function goToSignIn() {
    if (auth.currentUser) await onSignOut();
    window.location.replace(getPostVerificationPath());
  }

  function continueAfterInactiveInvitation() {
    clearInvitationContext();
    window.location.replace("/home");
  }

  return (
    <GradientBackground>
      <main className="min-h-screen text-zinc-100">
        <div className="relative mx-auto flex min-h-screen w-full items-center justify-center px-[16px] py-[32px] sm:py-[48px]">
          <section className="w-[calc(100vw-32px)] max-w-[480px] rounded-lg border border-zinc-800 bg-zinc-900 p-[24px] text-center shadow-2xl shadow-black/30 sm:p-[36px]" aria-labelledby="verification-result-title" data-testid="verification-result-card">
            <div className={`mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-full bg-white/5 ${content.tone}`}>
              <Icon className={`h-[32px] w-[32px] ${displayedState === "checking" ? "animate-spin" : ""}`} aria-hidden="true" />
            </div>
            <h1 id="verification-result-title" className="mt-[28px] text-[clamp(28px,1.875rem,38px)] leading-[1.2] font-semibold text-white">
              {content.title}
            </h1>
            <p className="mt-[14px] text-[clamp(16px,1.0625rem,22px)] leading-[1.6] text-zinc-400">
              {content.body}
            </p>

            {!isBusy && (
              <button
                type="button"
                onClick={
                  isAccessFailure
                    ? () => {
                        setState("success");
                        onRetryAccessResolution();
                      }
                    : isInactiveInvitation
                      ? continueAfterInactiveInvitation
                    : canReturnToVerification
                      ? () => window.location.replace(getPostVerificationPath())
                      : goToSignIn
                }
                className="mt-[32px] flex min-h-[56px] w-full items-center justify-center gap-[8px] rounded-md bg-purple-600 px-[24px] py-[14px] text-[clamp(16px,1.0625rem,22px)] font-bold text-white transition hover:bg-purple-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300"
              >
                <LogIn className="h-[22px] w-[22px]" aria-hidden="true" />
                {isAccessFailure
                  ? "Try again"
                  : isInactiveInvitation
                    ? "Continue"
                  : canReturnToVerification
                    ? "Return to verification"
                    : "Continue to sign in"}
              </button>
            )}
          </section>
        </div>
      </main>
    </GradientBackground>
  );
}
