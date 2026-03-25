import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tools/__tests__/integration/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 30000,
    pool: "forks",
    reporters: ["verbose"],
  },
});
