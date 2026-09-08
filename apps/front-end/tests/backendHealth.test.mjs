import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/lib/backendHealth.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { readBackendHealth } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

test("maps /health healthy onto ok without calling /verify", async () => {
  const calls = [];
  const health = await readBackendHealth("http://localhost:3100/verify", async (url, init) => {
    calls.push({ url: String(url), method: init.method });
    return {
      ok: true,
      json: async () => ({ status: "healthy", service: "venekovox-backend" }),
    };
  });
  assert.deepEqual(calls, [{ url: "http://localhost:3100/health", method: "GET" }]);
  assert.equal(health.status, "ok");
});

test("a refused backend is down, not verified", async () => {
  const health = await readBackendHealth("http://localhost:3100/verify", async () => {
    throw new Error("ECONNREFUSED");
  });
  assert.equal(health.status, "down");
});
