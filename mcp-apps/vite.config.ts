import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

// CSP eval-elimination plugin: replaces all Function() eval patterns with safe equivalents.
//
// 1. Zod JIT check: `new Function("")` -> `return!1` (disables JIT, Zod uses standard parser)
//    Minifiers may alias Function to a local variable first, so we handle both forms:
//    - Direct:  try{return new Function(""),!0}catch{return!1}
//    - Aliased: try{const t=Function;return new t(""),!0}catch{return!1}
// 2. Lodash global detection: `Function("return this")()` -> `globalThis` (always available in
//    modern browsers, including sandboxed iframes where self.Object===Object fails)
//
// We patch in both renderChunk (for JS chunks) and generateBundle with enforce:"post"
// (for the final inlined HTML, after vite-plugin-singlefile runs).
const EVAL_PATTERN = /try\{(?:const \w+=Function;)?return new (?:Function|\w+)\(""\),!0\}catch(?:\([^)]*\))?\{return!1\}/g;
const LODASH_GLOBAL_PATTERN = /Function\(["']return this["']\)\(\)/g;

function patchEval(code: string): string {
  return code.replace(EVAL_PATTERN, "return!1").replace(LODASH_GLOBAL_PATTERN, "globalThis");
}

const noNewFunction = {
  name: "no-new-function",
  enforce: "post" as const,
  renderChunk(code: string) {
    return { code: patchEval(code), map: null };
  },
  generateBundle(_: unknown, bundle: Record<string, { type: string; source?: string; code?: string }>) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type === "asset" && typeof chunk.source === "string") {
        chunk.source = patchEval(chunk.source);
      }
    }
  },
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [preact(), viteSingleFile(), tailwindcss(), noNewFunction],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "ui"),
      react: path.resolve(__dirname, "node_modules/preact/compat"),
      "react-dom": path.resolve(__dirname, "node_modules/preact/compat"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/preact/jsx-runtime"),
      "react-dom/test-utils": path.resolve(__dirname, "node_modules/preact/test-utils"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: process.env.INPUT,
    },
  },
});
