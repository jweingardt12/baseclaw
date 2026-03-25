import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [preact()],
  resolve: {
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
    alias: {
      "@": path.resolve(__dirname, "ui"),
      react: "preact/compat",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
      "react-dom/test-utils": "preact/test-utils",
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "ui/**/*.test.{ts,tsx}"],
    exclude: ["src/tools/__tests__/integration/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
