import { validatePassword } from "firebase/auth";

import { isAuthTestMode } from "../config/firebase/firebase";

const emulatorMinimumPasswordLength = 6;

export function validatePasswordForAuth(auth, password) {
  if (!isAuthTestMode) {
    return validatePassword(auth, password);
  }

  const meetsMinPasswordLength = password.length >= emulatorMinimumPasswordLength;

  return Promise.resolve({
    isValid: meetsMinPasswordLength,
    meetsMinPasswordLength,
    passwordPolicy: {
      customStrengthOptions: {
        minPasswordLength: emulatorMinimumPasswordLength,
      },
      allowedNonAlphanumericCharacters: "",
      enforcementState: "ENFORCE",
      forceUpgradeOnSignin: false,
    },
  });
}
