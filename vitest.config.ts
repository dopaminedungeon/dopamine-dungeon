import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["src/**/*.test.js", "src/server/**/*.test.ts", "api/**/*.test.ts"],
    restoreMocks: true,
  },
});
