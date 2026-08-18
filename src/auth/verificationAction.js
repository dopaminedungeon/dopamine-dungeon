export function readVerificationAction(search) {
  const params = new URLSearchParams(search);
  const oobCode = params.get("oobCode") || "";
  const mode = params.get("mode") || "";

  if (mode !== "verifyEmail" || !oobCode) {
    return { valid: false, oobCode: "" };
  }

  return { valid: true, oobCode };
}

export function getVerificationFailureState(error, currentUserVerified = false) {
  if (currentUserVerified) return "already-verified";

  const code = typeof error?.code === "string" ? error.code : "";
  if (code === "auth/expired-action-code") return "expired";
  if (
    code === "auth/invalid-action-code" ||
    code === "auth/invalid-continue-uri" ||
    code === "auth/unauthorized-continue-uri"
  ) {
    return "invalid";
  }
  return "failure";
}
