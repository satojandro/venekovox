import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ethersUrl = pathToFileURL(require.resolve("ethers")).href;

function transpile(file) {
  return ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

const timeoutUrl =
  "data:text/javascript;base64," +
  Buffer.from(transpile(new URL("../../src/polls/timeout.ts", import.meta.url))).toString("base64");
const source = transpile(new URL("../../src/polls/backendSchedule.ts", import.meta.url))
  .replaceAll('from "ethers"', `from "${ethersUrl}"`)
  .replaceAll('from "./timeout"', `from "${timeoutUrl}"`);
const { parseBackendSchedule, readBackendSchedule, scheduleFitsManifest, scheduleMatchesDescriptor } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);

const descriptor = {
  chainId: "11155111",
  maciAddress: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
  pollId: "0",
  expectedVoteOptions: 6,
  expectedMode: 2,
};

const valid = {
  chainId: "11155111",
  maciAddress: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
  pollId: "0",
  pollAddress: "0x29D39dD442c91dAc51a292fd04a9A7Edd16c22CB",
  tallyAddress: "0x4444444444444444444444444444444444444444",
  startTime: "3600",
  endTime: "3600",
  voteOptions: "6",
  mode: "2",
  status: "INVALID_WINDOW",
  blockNumber: 99,
  blockHash: "0xabc",
};

test("accepts a complete backend schedule and rejects invented results", () => {
  assert.equal(parseBackendSchedule(valid).status, "INVALID_WINDOW");
  assert.equal(parseBackendSchedule({ ...valid, results: { yes: 12 } }).status, "INVALID_WINDOW");
  assert.equal(parseBackendSchedule({ ...valid, status: "WINNING" }), null);
});

test("rejects a schedule that omits chain, MACI or poll identity", () => {
  const { chainId: _c, ...noChain } = valid;
  const { maciAddress: _m, ...noMaci } = valid;
  const { pollId: _p, ...noPoll } = valid;
  assert.equal(parseBackendSchedule(noChain), null);
  assert.equal(parseBackendSchedule(noMaci), null);
  assert.equal(parseBackendSchedule(noPoll), null);
});

test("matches identity even when the MACI address casing differs", () => {
  assert.equal(
    scheduleMatchesDescriptor(parseBackendSchedule(valid), {
      ...descriptor,
      maciAddress: descriptor.maciAddress.toLowerCase(),
    }),
    true,
  );
  assert.equal(scheduleMatchesDescriptor(parseBackendSchedule({ ...valid, pollId: "99" }), descriptor), false);
  assert.equal(scheduleMatchesDescriptor(parseBackendSchedule({ ...valid, chainId: "1" }), descriptor), false);
});

test("rejects a deployment whose option count or mode does not match the manifest", () => {
  assert.equal(scheduleFitsManifest(parseBackendSchedule(valid), descriptor), true);
  assert.equal(scheduleFitsManifest(parseBackendSchedule({ ...valid, voteOptions: "3" }), descriptor), false);
  assert.equal(scheduleFitsManifest(parseBackendSchedule({ ...valid, mode: "0" }), descriptor), false);
  assert.equal(
    scheduleFitsManifest(parseBackendSchedule(valid), {
      ...descriptor,
      expectedPollAddress: "0x5555555555555555555555555555555555555555",
    }),
    false,
  );
});

test("reads /polls/configured from the verify origin", async () => {
  const calls = [];
  const schedule = await readBackendSchedule("http://localhost:3100/verify", descriptor, async (url) => {
    calls.push(String(url));
    return { ok: true, json: async () => valid };
  });
  assert.deepEqual(calls, ["http://localhost:3100/polls/configured"]);
  assert.equal(schedule.pollAddress, valid.pollAddress);
  assert.equal(schedule.pollId, "0");
});

test("does not accept another poll's open window for the configured poll", async () => {
  const foreign = {
    ...valid,
    pollId: "99",
    status: "OPEN",
    startTime: "1",
    endTime: "9999999999",
  };
  const schedule = await readBackendSchedule("http://localhost:3100/verify", descriptor, async () => ({
    ok: true,
    json: async () => foreign,
  }));
  assert.equal(schedule, null);
});
