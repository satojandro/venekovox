import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  // MACI workspace packages are CommonJS; ensure proper pre-bundling
  optimizeDeps: {
    include: ["@maci-protocol/sdk/browser", "@maci-protocol/domainobjs"],
    esbuildOptions: {
      resolveExtensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
    },
  },
});
