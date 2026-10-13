import { createAuthTestRunner } from "./auth-test-runner-lib.mjs";

const runner = createAuthTestRunner();

try {
  process.exitCode = await runner.run(process.argv.slice(2));
} catch (error) {
  console.error(`[auth-test-runner] ${error.message}`);
  process.exitCode = 1;
}
