import { env } from "node:process";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const assertShim = fileURLToPath(new URL("./src/shims/assert.ts", import.meta.url));
const cryptoShim = fileURLToPath(new URL("./src/shims/crypto.ts", import.meta.url));

// Force every `assert`/`crypto` import (including Node builtins) onto the
// browser shims during Vite's dependency pre-bundle. resolve.alias alone is
// not enough because esbuild treats these as Node builtins. crypto is needed
// by MACI domainobjs (Keypair generation → packages/crypto keys.ts/babyjub.ts
// import { randomBytes } from "crypto").
function nodeBuiltinShimPlugin(): Plugin {
  return {
    name: "venekovox-node-builtin-shims",
    enforce: "pre",
    resolveId(source) {
      if (source === "assert" || source === "node:assert") {
        return assertShim;
      }
      if (source === "crypto" || source === "node:crypto") {
        return cryptoShim;
      }
      return undefined;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [nodeBuiltinShimPlugin(), react()],
  server: {
    // Keep the main deployment port; isolated previews may override it.
    port: Number(env.VITE_DEV_PORT || 3000),
    strictPort: true,
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
      crypto: cryptoShim,
      "node:crypto": cryptoShim,
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
        crypto: cryptoShim,
        "node:crypto": cryptoShim,
      },
    },
  },
});
