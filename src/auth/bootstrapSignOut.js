export const BOOTSTRAP_SIGN_OUT_ERROR_MESSAGE =
  "Could not sign out. Please try again.";

export function createBootstrapSignOutRunner() {
  let activeAttempt = null;

  return function runBootstrapSignOut({
    logout,
    onStart,
    onError,
    onSettled,
  }) {
    if (activeAttempt) return activeAttempt;

    onStart();

    activeAttempt = Promise.resolve()
      .then(() => logout())
      .catch(() => {
        onError(BOOTSTRAP_SIGN_OUT_ERROR_MESSAGE);
      })
      .finally(() => {
        activeAttempt = null;
        onSettled();
      });

    return activeAttempt;
  };
}
