import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = ts.transpileModule(readFileSync(new URL("../../src/polls/timeout.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { withTimeout } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("rejects a promise that never settles", async () => {
  const started = Date.now();
  await assert.rejects(() => withTimeout(new Promise(() => {}), 40), /TIMEOUT/);
  assert.ok(Date.now() - started < 1000);
});

test("returns the value when it arrives in time", async () => {
  assert.equal(await withTimeout(Promise.resolve("ok"), 40), "ok");
});
