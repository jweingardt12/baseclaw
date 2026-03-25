import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
    alias: {
      "@": path.resolve(__dirname, "ui"),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "ui/**/*.test.{ts,tsx}"],
    exclude: ["src/tools/__tests__/integration/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
