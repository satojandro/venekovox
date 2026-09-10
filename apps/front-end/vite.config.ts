import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const assertShim = fileURLToPath(new URL("./src/shims/assert.ts", import.meta.url));

// Force every `assert` import (including Node's builtin) onto the browser shim
// during Vite's dependency pre-bundle. resolve.alias alone is not enough because
// esbuild treats `assert` as a Node builtin.
function assertShimPlugin(): Plugin {
  return {
    name: "venekovox-assert-shim",
    enforce: "pre",
    resolveId(source) {
      if (source === "assert" || source === "node:assert") {
        return assertShim;
      }
      return undefined;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [assertShimPlugin(), react()],
  server: {
    port: 3000,
    host: true,
    // D10 lesson: ZKPassport live proofs require the dashboard-allowed origin.
    // app.uxisnear.com (CNAME → this Mini's Tailscale name) is the allowlisted
    // origin, so Vite must serve requests addressed to that hostname too.
    allowedHosts: ["app.uxisnear.com", "claudios-mac-mini.taila56fc2.ts.net"],
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": "/src",
      assert: assertShim,
      "node:assert": assertShim,
    },
  },
  // MACI workspace packages are CommonJS; ensure proper pre-bundling
  optimizeDeps: {
    include: ["@maci-protocol/sdk/browser", "@maci-protocol/domainobjs", "@zkpassport/sdk"],
    esbuildOptions: {
      resolveExtensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
      alias: {
        assert: assertShim,
        "node:assert": assertShim,
      },
    },
  },
});
