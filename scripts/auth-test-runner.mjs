import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import { delimiter } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const firebaseCli = require.resolve("firebase-tools/lib/bin/firebase.js");
const playwrightCli = require.resolve("@playwright/test/cli");
const projectId = "demo-dopamine-dungeon";
const emulatorHubUrl = "http://127.0.0.1:4400/emulators";

if (process.env.VERCEL_ENV) {
  throw new Error("Auth emulator tests cannot run in a Vercel environment.");
}

async function pathWithJava() {
  if (spawnSync("java", ["-version"], { stdio: "ignore" }).status === 0) {
    return process.env.PATH;
  }

  const candidates = [
    "/opt/homebrew/opt/openjdk@21/bin",
    "/usr/local/opt/openjdk@21/bin",
  ];

  for (const candidate of candidates) {
    try {
      await access(`${candidate}/java`);
      return `${candidate}${delimiter}${process.env.PATH ?? ""}`;
    } catch {
      // Continue to the next supported local JDK location.
    }
  }

  throw new Error(
    "Java 11 or newer is required. Install it before running Firebase emulators."
  );
}

const testEnvironment = {
  ...process.env,
  PATH: await pathWithJava(),
  NODE_ENV: "test",
  DD_AUTH_TEST_MODE: "true",
  VITE_AUTH_TEST_MODE: "true",
  FIREBASE_PROJECT_ID: projectId,
  GCLOUD_PROJECT: projectId,
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
};

function startAuthEmulator() {
  return spawn(
    process.execPath,
    [
      firebaseCli,
      "emulators:start",
      "--only",
      "auth",
      "--project",
      projectId,
    ],
    { env: testEnvironment, stdio: "inherit" }
  );
}

async function waitForAuthEmulator(emulatorProcess) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (emulatorProcess.exitCode !== null) {
      throw new Error(`Firebase Auth emulator exited with ${emulatorProcess.exitCode}.`);
    }

    try {
      const response = await fetch(emulatorHubUrl);
      const emulators = await response.json();
      if (response.ok && emulators.auth?.port === 9099) return;
    } catch {
      // The hub is not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Timed out waiting for the Firebase Auth emulator.");
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGINT");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

const mode = process.argv[2];

if (mode === "emulator") {
  const emulator = startAuthEmulator();
  process.once("SIGINT", () => emulator.kill("SIGINT"));
  process.once("SIGTERM", () => emulator.kill("SIGTERM"));
  emulator.once("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} else if (mode === "test") {
  const emulator = startAuthEmulator();

  try {
    await waitForAuthEmulator(emulator);
    const playwright = spawn(
      process.execPath,
      [playwrightCli, "test", ...process.argv.slice(3)],
      { env: testEnvironment, stdio: "inherit" }
    );
    const exitCode = await new Promise((resolve) =>
      playwright.once("exit", (code) => resolve(code ?? 1))
    );
    process.exitCode = exitCode;
  } finally {
    await stopProcess(emulator);
  }
} else {
  throw new Error("Use auth-test-runner.mjs with either 'emulator' or 'test'.");
}
