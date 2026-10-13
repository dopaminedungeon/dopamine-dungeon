import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { createAuthTestRunner } from "./auth-test-runner-lib.mjs";

class FakeChild extends EventEmitter {
  exitCode: number | null = null;
  stderr = new EventEmitter();
  signals: string[] = [];

  constructor(private readonly exitOnKill = true) {
    super();
  }

  kill(signal: string) {
    this.signals.push(signal);
    if (this.exitOnKill && this.exitCode === null) {
      this.exitCode = signal === "SIGKILL" ? 137 : 0;
      queueMicrotask(() => this.emit("exit", this.exitCode));
    }
    return true;
  }
}

function createHarness(options: {
  emulator?: FakeChild;
  playwright?: FakeChild;
  fetch?: () => Promise<unknown>;
  missing?: string;
  now?: () => number;
  onSpawn?: () => void;
  sleep?: () => Promise<void>;
} = {}) {
  const emulator = options.emulator ?? new FakeChild();
  const playwright = options.playwright ?? new FakeChild();
  const parentEnvironment = { PATH: "/test/bin", USER_SETTING: "preserved" };
  const spawnCalls: Array<{ args: string[]; options: { env: Record<string, string> } }> = [];
  const removedDirectories: string[] = [];
  const signalHandlers = new Map<string, () => void>();
  let spawnCount = 0;

  const runner = createAuthTestRunner({
    fetch:
      options.fetch ??
      (async () => ({
        ok: true,
        json: async () => ({ auth: { port: 9099 } }),
      })),
    mkdtemp: async () => "/tmp/dopamine-dungeon-firebase-test",
    ...(options.now ? { now: options.now } : {}),
    offSignal: (signal: string) => signalHandlers.delete(signal),
    onSignal: (signal: string, handler: () => void) => signalHandlers.set(signal, handler),
    path: parentEnvironment.PATH,
    processEnv: parentEnvironment,
    removeDirectory: async (directory: string) => {
      removedDirectories.push(directory);
    },
    requireResolve: (packagePath: string) => {
      if (packagePath === options.missing) throw new Error("not installed");
      return `/dependencies/${packagePath}`;
    },
    sleep: options.sleep ?? (async () => {}),
    spawn: (_command: string, args: string[], spawnOptions: { env: Record<string, string> }) => {
      spawnCalls.push({ args, options: spawnOptions });
      options.onSpawn?.();
      spawnCount += 1;
      return spawnCount === 1 ? emulator : playwright;
    },
    spawnSync: () => ({ status: 0 }),
    stderr: { write: () => true },
    temporaryRoot: "/tmp",
  });

  return {
    emulator,
    parentEnvironment,
    playwright,
    removedDirectories,
    runner,
    signalHandlers,
    spawnCalls,
  };
}

describe("auth test runner", () => {
  it("isolates Firebase configuration in children and cleans it after Playwright succeeds", async () => {
    const harness = createHarness();
    harness.playwright.exitCode = 0;

    await expect(harness.runner.run(["test", "--grep", "@smoke"])).resolves.toBe(0);

    expect(harness.spawnCalls).toHaveLength(2);
    expect(harness.spawnCalls[0].options.env.XDG_CONFIG_HOME).toBe(
      "/tmp/dopamine-dungeon-firebase-test"
    );
    expect(harness.spawnCalls[1].options.env.XDG_CONFIG_HOME).toBe(
      "/tmp/dopamine-dungeon-firebase-test"
    );
    expect(harness.spawnCalls[0].options.env.NO_UPDATE_NOTIFIER).toBe("1");
    expect(harness.parentEnvironment).toEqual({ PATH: "/test/bin", USER_SETTING: "preserved" });
    expect(harness.removedDirectories).toEqual(["/tmp/dopamine-dungeon-firebase-test"]);
    expect(harness.emulator.signals).toEqual(["SIGINT"]);
    expect(harness.spawnCalls.flatMap((call) => call.args)).not.toContain("pnpm");
    expect(harness.spawnCalls.flatMap((call) => call.args)).not.toContain("corepack");
    expect(harness.removedDirectories.some((path) => path.includes("node_modules"))).toBe(false);
  });

  it("reports a Firebase exit before readiness and never starts Playwright", async () => {
    const harness = createHarness();
    harness.emulator.exitCode = 2;

    await expect(harness.runner.run(["test"])).rejects.toThrow(
      "Firebase Auth emulator exited before readiness with code 2"
    );

    expect(harness.spawnCalls).toHaveLength(1);
    expect(harness.removedDirectories).toEqual(["/tmp/dopamine-dungeon-firebase-test"]);
  });

  it("identifies a Firebase port conflict from the startup output", async () => {
    const emulator = new FakeChild();
    const harness = createHarness({
      emulator,
      fetch: async () => {
        throw new Error("not ready");
      },
      onSpawn: () =>
        queueMicrotask(() => {
          emulator.exitCode = 1;
          emulator.stderr.emit(
            "data",
            "Error: listen EADDRINUSE: address already in use 127.0.0.1:9099"
          );
        }),
    });

    await expect(harness.runner.run(["test"])).rejects.toThrow("port 9099 or 4400 is already in use");
    expect(harness.spawnCalls).toHaveLength(1);
  });

  it("stops the Firebase child and cleans the temporary configuration after readiness times out", async () => {
    let now = 0;
    const harness = createHarness({
      fetch: async () => {
        throw new Error("not ready");
      },
      now: () => now,
      sleep: async () => {
        now += 60_000;
      },
    });

    await expect(harness.runner.run(["test"])).rejects.toThrow("Timed out waiting");
    expect(harness.emulator.signals).toContain("SIGINT");
  });

  it("propagates a Playwright failure and still stops the emulator", async () => {
    const harness = createHarness();
    harness.playwright.exitCode = 7;

    await expect(harness.runner.run(["test"])).resolves.toBe(7);
    expect(harness.emulator.signals).toEqual(["SIGINT"]);
    expect(harness.removedDirectories).toEqual(["/tmp/dopamine-dungeon-firebase-test"]);
  });

  it("terminates the owned emulator when it receives SIGTERM", async () => {
    const harness = createHarness({
      fetch: () => new Promise(() => {}),
    });

    const promise = harness.runner.run(["test"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    harness.signalHandlers.get("SIGTERM")?.();

    await expect(promise).resolves.toBe(143);
    expect(harness.emulator.signals).toContain("SIGTERM");
  });

  it("gives an actionable missing-local-dependency error without starting a package manager", async () => {
    const harness = createHarness({ missing: "firebase-tools/lib/bin/firebase.js" });

    await expect(harness.runner.run(["test"])).rejects.toThrow(
      "Run pnpm install --frozen-lockfile"
    );
    expect(harness.spawnCalls).toHaveLength(0);
    expect(harness.removedDirectories).toHaveLength(0);
  });

  it("checks the locally installed Playwright CLI before starting Firebase", async () => {
    const harness = createHarness({ missing: "@playwright/test/cli" });

    await expect(harness.runner.run(["test"])).rejects.toThrow("locally installed Playwright CLI");
    expect(harness.spawnCalls).toHaveLength(0);
    expect(harness.removedDirectories).toHaveLength(0);
  });
});
