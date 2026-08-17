export const AUTH_EMULATOR_HOST = "127.0.0.1:9099";
export const FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
export const FIREBASE_TEST_PROJECT_ID = "demo-dopamine-dungeon";

export function getServerAuthRuntime(env) {
  const emulatorRequested =
    env.DD_AUTH_TEST_MODE === "true" || Boolean(env.FIREBASE_AUTH_EMULATOR_HOST);

  if (!emulatorRequested) {
    return { useAuthEmulator: false };
  }

  const isSafeTestMode =
    env.DD_AUTH_TEST_MODE === "true" &&
    env.NODE_ENV === "test" &&
    !env.VERCEL_ENV &&
    env.FIREBASE_PROJECT_ID === FIREBASE_TEST_PROJECT_ID &&
    env.FIREBASE_AUTH_EMULATOR_HOST === AUTH_EMULATOR_HOST &&
    env.FIRESTORE_EMULATOR_HOST === FIRESTORE_EMULATOR_HOST;

  if (!isSafeTestMode) {
    throw new Error(
      "Firebase emulators require explicit local test mode and the demo project."
    );
  }

  return {
    useAuthEmulator: true,
    projectId: FIREBASE_TEST_PROJECT_ID,
  };
}
