export function requiresEmailVerification(firebaseUser) {
  if (!firebaseUser) return false;

  const hasPasswordCredential = firebaseUser.providerData?.some(
    (provider) => provider.providerId === "password"
  );

  return Boolean(hasPasswordCredential && !firebaseUser.emailVerified);
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
