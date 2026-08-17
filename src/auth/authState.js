export function requiresEmailVerification(firebaseUser) {
  if (!firebaseUser) return false;

  const hasPasswordCredential = firebaseUser.providerData?.some(
    (provider) => provider.providerId === "password"
  );

  return Boolean(hasPasswordCredential && !firebaseUser.emailVerified);
}
