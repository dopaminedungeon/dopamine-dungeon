export function requiresEmailVerification(firebaseUser) {
  if (!firebaseUser) return false;

  return firebaseUser.emailVerified !== true;
}

export function getApplicationUser(
  firebaseUser,
  profileInitializationStatus,
  skipProfileInitialization = false
) {
  if (!firebaseUser || requiresEmailVerification(firebaseUser)) return null;
  if (!skipProfileInitialization && profileInitializationStatus !== "ready") {
    return null;
  }

  return firebaseUser;
}
