import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../../src/polls/backendSchedule.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { parseBackendSchedule, readBackendSchedule } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);

const valid = {
  pollAddress: "0x29D39dD442c91dAc51a292fd04a9A7Edd16c22CB",
  startTime: "3600",
  endTime: "3600",
  status: "INVALID_WINDOW",
  blockNumber: 99,
  blockHash: "0xabc",
};

test("accepts a complete backend schedule and rejects invented results", () => {
  assert.equal(parseBackendSchedule(valid).status, "INVALID_WINDOW");
  assert.equal(parseBackendSchedule({ ...valid, results: { yes: 12 } }).status, "INVALID_WINDOW");
  assert.equal(parseBackendSchedule({ ...valid, status: "WINNING" }), null);
});

test("reads /polls/configured from the verify origin", async () => {
  const calls = [];
  const schedule = await readBackendSchedule("http://localhost:3100/verify", async (url) => {
    calls.push(String(url));
    return { ok: true, json: async () => valid };
  });
  assert.deepEqual(calls, ["http://localhost:3100/polls/configured"]);
  assert.equal(schedule.pollAddress, valid.pollAddress);
});
