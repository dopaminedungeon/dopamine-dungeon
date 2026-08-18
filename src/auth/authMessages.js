const TEMPORARY_AUTH_ERROR_CODES = new Set([
  "auth/internal-error",
  "auth/network-request-failed",
  "auth/operation-not-allowed",
  "auth/quota-exceeded",
  "auth/too-many-requests",
]);

export const GENERIC_SIGN_IN_ERROR =
  "We couldn't sign you in with those credentials.";

export function getAuthErrorMessage(error, operation) {
  const code = typeof error?.code === "string" ? error.code : "";

  if (operation === "verification" && (code === "auth/too-many-requests" || error?.status === 429)) {
    return "Please wait before requesting another verification email.";
  }

  if (TEMPORARY_AUTH_ERROR_CODES.has(code)) {
    return "Authentication is temporarily unavailable. Please try again later.";
  }

  if (operation === "google" && code === "auth/popup-closed-by-user") {
    return "Google sign-in was cancelled.";
  }

  if (operation === "google") {
    return "We couldn't complete Google sign-in. Please try again.";
  }

  if (operation === "register") {
    return "We couldn't create your account. Check your details and try again.";
  }

  if (operation === "verification") {
    return "We couldn't verify your email status. Please try again.";
  }

  return GENERIC_SIGN_IN_ERROR;
}

export function getPasswordRequirements(validation) {
  if (!validation) return [];

  const options = validation.passwordPolicy?.customStrengthOptions ?? {};
  const requirements = [];

  if (options.minPasswordLength) {
    requirements.push({
      key: "min-length",
      label: `At least ${options.minPasswordLength} characters`,
      met: validation.meetsMinPasswordLength === true,
    });
  }

  if (options.maxPasswordLength) {
    requirements.push({
      key: "max-length",
      label: `No more than ${options.maxPasswordLength} characters`,
      met: validation.meetsMaxPasswordLength === true,
    });
  }

  const characterRequirements = [
    ["lowercase", "A lowercase letter", "containsLowercaseLetter"],
    ["uppercase", "An uppercase letter", "containsUppercaseLetter"],
    ["number", "A number", "containsNumericCharacter"],
    ["symbol", "A symbol", "containsNonAlphanumericCharacter"],
  ];

  characterRequirements.forEach(([key, label, statusKey]) => {
    if (options[statusKey]) {
      requirements.push({ key, label, met: validation[statusKey] === true });
    }
  });

  return requirements;
}
