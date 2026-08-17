import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTH_EMULATOR_HOST,
  FIREBASE_TEST_PROJECT_ID,
  FIRESTORE_EMULATOR_HOST,
  getServerAuthRuntime,
} from "./authEmulatorSafety.js";

const safeEnvironment = {
  DD_AUTH_TEST_MODE: "true",
  NODE_ENV: "test",
  FIREBASE_PROJECT_ID: FIREBASE_TEST_PROJECT_ID,
  FIREBASE_AUTH_EMULATOR_HOST: AUTH_EMULATOR_HOST,
  FIRESTORE_EMULATOR_HOST,
};

test("server Auth emulator mode requires the complete local test environment", () => {
  assert.deepEqual(getServerAuthRuntime(safeEnvironment), {
    useAuthEmulator: true,
    projectId: FIREBASE_TEST_PROJECT_ID,
  });
});

test("server rejects emulator configuration in Vercel environments", () => {
  assert.throws(
    () => getServerAuthRuntime({ ...safeEnvironment, VERCEL_ENV: "preview" }),
    /explicit local test mode/
  );
  assert.throws(
    () => getServerAuthRuntime({ ...safeEnvironment, VERCEL_ENV: "production" }),
    /explicit local test mode/
  );
});

test("server rejects partial, non-local, and non-demo emulator configuration", () => {
  assert.throws(
    () => getServerAuthRuntime({ FIREBASE_AUTH_EMULATOR_HOST: AUTH_EMULATOR_HOST }),
    /explicit local test mode/
  );
  assert.throws(
    () => getServerAuthRuntime({ ...safeEnvironment, NODE_ENV: "development" }),
    /explicit local test mode/
  );
  assert.throws(
    () =>
      getServerAuthRuntime({
        ...safeEnvironment,
        FIREBASE_PROJECT_ID: "dopamine-dungeon-production",
      }),
    /explicit local test mode/
  );
});
