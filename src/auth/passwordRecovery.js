import { onAuthStateChanged, signOut } from "firebase/auth";

export const PASSWORD_RESET_CONFIRMATION =
  "If an account can use password authentication with that email address, we've sent instructions to reset its password.";

export const PASSWORD_RESET_SERVICE_ERROR =
  "Password recovery is temporarily unavailable. Please try again.";

const NON_IDENTIFYING_REQUEST_ERROR_CODES = new Set([
  "auth/invalid-email",
  "auth/missing-email",
  "auth/user-disabled",
  "auth/user-not-found",
]);

const INVALID_RESET_CODE_ERRORS = new Set([
  "auth/invalid-action-code",
  "auth/invalid-credential",
  "auth/invalid-continue-uri",
  "auth/missing-action-code",
  "auth/unauthorized-continue-uri",
  "auth/user-disabled",
  "auth/user-not-found",
]);

export function shouldShowPasswordResetConfirmation(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  return NON_IDENTIFYING_REQUEST_ERROR_CODES.has(code);
}

export function readPasswordResetAction(search) {
  const params = new URLSearchParams(search);
  const mode = params.get("mode") || "";
  const oobCode = params.get("oobCode") || "";

  if (mode !== "resetPassword" || !oobCode) {
    return { valid: false, oobCode: "" };
  }

  return { valid: true, oobCode };
}

export function getPasswordResetFailureState(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  if (code === "auth/expired-action-code") return "expired";
  if (INVALID_RESET_CODE_ERRORS.has(code)) return "invalid";
  return "failure";
}

export async function preparePasswordRecovery(auth) {
  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  } else {
    await new Promise((resolve) => {
      let unsubscribe = () => {};
      unsubscribe = onAuthStateChanged(auth, () => {
        unsubscribe();
        resolve();
      });
    });
  }
  if (auth.currentUser) {
    await signOut(auth);
  }
}
