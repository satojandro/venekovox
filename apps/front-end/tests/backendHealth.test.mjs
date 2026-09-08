import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function transpile(file) {
  return ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

const timeoutUrl =
  "data:text/javascript;base64," +
  Buffer.from(transpile(new URL("../src/polls/timeout.ts", import.meta.url))).toString("base64");
const js = transpile(new URL("../src/lib/backendHealth.ts", import.meta.url)).replaceAll(
  'from "../polls/timeout"',
  `from "${timeoutUrl}"`,
);
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

test("a hung /health request is down after the deadline", async () => {
  const started = Date.now();
  const health = await readBackendHealth(
    "http://localhost:3100/verify",
    () => new Promise(() => {}),
    40,
  );
  assert.equal(health.status, "down");
  assert.ok(Date.now() - started < 1000);
});


test("a stalled health JSON body is aborted and reported down", { timeout: 1000 }, async () => {
  let signal;
  const health = await readBackendHealth("http://localhost:3100/verify", async (_url, init) => {
    signal = init.signal;
    return { ok: true, json: () => new Promise(() => {}) };
  }, 20);
  assert.equal(health.status, "down");
  assert.equal(signal.aborted, true);
});
