import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["src/**/*.test.js", "src/firebase/browserFirestoreRetirement.test.ts", "src/server/**/*.test.ts", "api/**/*.test.ts", "scripts/**/*.test.ts"],
    restoreMocks: true,
  },
});
