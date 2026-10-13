import { access, mkdtemp, rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { delimiter, isAbsolute, relative } from "node:path";

const require = createRequire(import.meta.url);

export const AUTH_EMULATOR_HOST = "127.0.0.1:9099";
export const EMULATOR_HUB_URL = "http://127.0.0.1:4400/emulators";
export const PROJECT_ID = "demo-dopamine-dungeon";

const STARTUP_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 250;
const STOP_TIMEOUT_MS = 5_000;

class RunnerError extends Error {}

function waitForExit(child) {
  if (child.exitCode !== null && child.exitCode !== undefined) {
    return Promise.resolve(child.exitCode ?? 1);
  }

  return new Promise((resolve) => {
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isSafeTemporaryDirectory(directory, temporaryRoot) {
  return (
    isAbsolute(directory) &&
    directory !== temporaryRoot &&
    !relative(temporaryRoot, directory).startsWith("..")
  );
}

function firebaseFailureMessage(exitCode, output) {
  const portConflict = /EADDRINUSE|port .*?(?:taken|in use|already)/i.test(output);
  const detail = output.trim() ? ` Firebase output: ${output.trim()}` : "";

  if (portConflict) {
    return new RunnerError(
      `Firebase Auth emulator could not start because port 9099 or 4400 is already in use.${detail}`
    );
  }

  return new RunnerError(
    `Firebase Auth emulator exited before readiness with code ${exitCode}.${detail}`
  );
}

export function createAuthTestRunner(overrides = {}) {
  const dependencies = {
    access,
    fetch: globalThis.fetch,
    mkdtemp,
    now: Date.now,
    offSignal: process.removeListener.bind(process),
    onSignal: process.once.bind(process),
    path: process.env.PATH ?? "",
    processEnv: process.env,
    processExecPath: process.execPath,
    removeDirectory: rm,
    requireResolve: require.resolve,
    sleep: delay,
    spawn,
    spawnSync,
    stderr: process.stderr,
    stdout: process.stdout,
    temporaryRoot: tmpdir(),
    ...overrides,
  };

  function resolveCli(packagePath, label) {
    try {
      return dependencies.requireResolve(packagePath);
    } catch {
      throw new RunnerError(
        `The locally installed ${label} CLI is unavailable. Run pnpm install --frozen-lockfile, then retry. The auth test runner never installs or repairs dependencies.`
      );
    }
  }

  async function pathWithJava() {
    if (dependencies.spawnSync("java", ["-version"], { stdio: "ignore" }).status === 0) {
      return dependencies.path;
    }

    const candidates = [
      "/opt/homebrew/opt/openjdk@21/bin",
      "/usr/local/opt/openjdk@21/bin",
    ];

    for (const candidate of candidates) {
      try {
        await dependencies.access(`${candidate}/java`);
        return `${candidate}${delimiter}${dependencies.path}`;
      } catch {
        // Continue to the next supported local JDK location.
      }
    }

    throw new RunnerError(
      "Java 11 or newer is required. Install it before running Firebase emulators."
    );
  }

  function createTestEnvironment(javaPath, configurationDirectory) {
    return {
      ...dependencies.processEnv,
      PATH: javaPath,
      NODE_ENV: "test",
      NO_UPDATE_NOTIFIER: "1",
      XDG_CONFIG_HOME: configurationDirectory,
      DD_AUTH_TEST_MODE: "true",
      VITE_AUTH_TEST_MODE: "true",
      FIREBASE_PROJECT_ID: PROJECT_ID,
      GCLOUD_PROJECT: PROJECT_ID,
      FIREBASE_AUTH_EMULATOR_HOST: AUTH_EMULATOR_HOST,
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    };
  }

  function startAuthEmulator(firebaseCli, environment) {
    const child = dependencies.spawn(
      dependencies.processExecPath,
      [
        firebaseCli,
        "emulators:start",
        "--only",
        "auth",
        "--project",
        PROJECT_ID,
      ],
      { env: environment, stdio: ["ignore", "pipe", "pipe"] }
    );
    let output = "";

    const recordOutput = (chunk, destination) => {
      const text = String(chunk);
      output = `${output}${text}`.slice(-8_000);
      destination.write(text);
    };

    child.stdout?.on("data", (chunk) => recordOutput(chunk, dependencies.stdout));
    child.stderr?.on("data", (chunk) => recordOutput(chunk, dependencies.stderr));

    return { child, output: () => output };
  }

  async function waitForAuthEmulator(emulator) {
    const deadline = dependencies.now() + STARTUP_TIMEOUT_MS;

    while (dependencies.now() < deadline) {
      if (emulator.child.exitCode !== null && emulator.child.exitCode !== undefined) {
        throw firebaseFailureMessage(emulator.child.exitCode ?? 1, emulator.output());
      }

      try {
        const response = await dependencies.fetch(EMULATOR_HUB_URL);
        const emulators = await response.json();
        if (response.ok && emulators.auth?.port === 9099) return;
      } catch {
        // The hub is not ready yet.
      }

      await dependencies.sleep(POLL_INTERVAL_MS);
    }

    if (emulator.child.exitCode !== null && emulator.child.exitCode !== undefined) {
      throw firebaseFailureMessage(emulator.child.exitCode ?? 1, emulator.output());
    }

    throw new RunnerError(
      "Timed out waiting for the Firebase Auth emulator on 127.0.0.1:9099. Check for a port conflict or Firebase startup output above."
    );
  }

  async function stopProcess(child, signal = "SIGINT") {
    if (!child || (child.exitCode !== null && child.exitCode !== undefined)) return;
    child.kill(signal);
    await Promise.race([waitForExit(child), dependencies.sleep(STOP_TIMEOUT_MS)]);
    if (child.exitCode === null || child.exitCode === undefined) child.kill("SIGKILL");
  }

  function watchSignals(getOwnedChildren) {
    let receivedSignal;
    let resolveSignal;
    const signalled = new Promise((resolve) => {
      resolveSignal = resolve;
    });
    const handlers = new Map();

    for (const signal of ["SIGINT", "SIGTERM"]) {
      const handler = () => {
        if (receivedSignal) return;
        receivedSignal = signal;
        void Promise.all(
          getOwnedChildren()
            .filter(Boolean)
            .map((child) => stopProcess(child, signal))
        ).finally(resolveSignal);
      };
      handlers.set(signal, handler);
      dependencies.onSignal(signal, handler);
    }

    return {
      async wait(operation) {
        await Promise.race([operation, signalled]);
        return receivedSignal;
      },
      remove() {
        for (const [signal, handler] of handlers) {
          dependencies.offSignal(signal, handler);
        }
      },
    };
  }

  async function withTemporaryConfiguration(run) {
    const directory = await dependencies.mkdtemp(
      `${dependencies.temporaryRoot}/dopamine-dungeon-firebase-`
    );
    if (!isSafeTemporaryDirectory(directory, dependencies.temporaryRoot)) {
      throw new RunnerError("Refusing to clean an unsafe Firebase configuration directory.");
    }

    try {
      return await run(directory);
    } finally {
      await dependencies.removeDirectory(directory, { recursive: true, force: true });
    }
  }

  async function runTest(playwrightArguments) {
    if (dependencies.processEnv.VERCEL_ENV) {
      throw new RunnerError("Auth emulator tests cannot run in a Vercel environment.");
    }

    const firebaseCli = resolveCli("firebase-tools/lib/bin/firebase.js", "Firebase Tools");
    const playwrightCli = resolveCli("@playwright/test/cli", "Playwright");
    const javaPath = await pathWithJava();

    return withTemporaryConfiguration(async (configurationDirectory) => {
      const environment = createTestEnvironment(javaPath, configurationDirectory);
      const emulator = startAuthEmulator(firebaseCli, environment);
      let playwright;
      const signals = watchSignals(() => [emulator.child, playwright]);

      try {
        const startupSignal = await signals.wait(waitForAuthEmulator(emulator));
        if (startupSignal) return startupSignal === "SIGINT" ? 130 : 143;
        playwright = dependencies.spawn(
          dependencies.processExecPath,
          [playwrightCli, "test", ...playwrightArguments],
          { env: environment, stdio: "inherit" }
        );
        const playwrightSignal = await signals.wait(waitForExit(playwright));
        if (playwrightSignal) return playwrightSignal === "SIGINT" ? 130 : 143;
        return playwright.exitCode ?? 1;
      } finally {
        signals.remove();
        await stopProcess(emulator.child);
      }
    });
  }

  async function runEmulator() {
    if (dependencies.processEnv.VERCEL_ENV) {
      throw new RunnerError("Auth emulator tests cannot run in a Vercel environment.");
    }

    const firebaseCli = resolveCli("firebase-tools/lib/bin/firebase.js", "Firebase Tools");
    const javaPath = await pathWithJava();

    return withTemporaryConfiguration(async (configurationDirectory) => {
      const emulator = startAuthEmulator(
        firebaseCli,
        createTestEnvironment(javaPath, configurationDirectory)
      );
      const signals = watchSignals(() => [emulator.child]);

      try {
        const signal = await signals.wait(waitForExit(emulator.child));
        if (signal) return signal === "SIGINT" ? 130 : 143;
        return emulator.child.exitCode ?? 1;
      } finally {
        signals.remove();
        await stopProcess(emulator.child);
      }
    });
  }

  return {
    run(arguments_) {
      const [mode, ...argumentsAfterMode] = arguments_;
      if (mode === "test") return runTest(argumentsAfterMode);
      if (mode === "emulator") return runEmulator();
      throw new RunnerError("Use auth-test-runner.mjs with either 'emulator' or 'test'.");
    },
  };
}
