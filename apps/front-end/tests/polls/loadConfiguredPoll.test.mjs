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

function dataUrl(js) {
  return "data:text/javascript;base64," + Buffer.from(js).toString("base64");
}

const timeoutUrl = dataUrl(transpile(new URL("../../src/polls/timeout.ts", import.meta.url)));
const backendScheduleUrl = dataUrl(
  transpile(new URL("../../src/polls/backendSchedule.ts", import.meta.url))
    .replaceAll('from "ethers"', `from "${ethersUrl}"`)
    .replaceAll('from "./timeout"', `from "${timeoutUrl}"`),
);
const pollNameUrl = dataUrl(
  transpile(new URL("../../src/ens/pollName.ts", import.meta.url)).replaceAll('from "ethers"', `from "${ethersUrl}"`),
);
const scheduleUrl = dataUrl(
  transpile(new URL("../../src/polls/schedule.ts", import.meta.url))
    .replaceAll('from "ethers"', `from "${ethersUrl}"`)
    .replaceAll('from "../ens/pollName"', `from "${pollNameUrl}"`),
);
const rpcUrlModule = dataUrl(
  transpile(new URL("../../src/polls/rpc.ts", import.meta.url)).replaceAll('from "ethers"', `from "${ethersUrl}"`),
);
const loaderJs = transpile(new URL("../../src/polls/loadConfiguredPoll.ts", import.meta.url))
  .replaceAll('from "./backendSchedule"', `from "${backendScheduleUrl}"`)
  .replaceAll('from "./rpc"', `from "${rpcUrlModule}"`)
  .replaceAll('from "./schedule"', `from "${scheduleUrl}"`)
  .replaceAll('from "./timeout"', `from "${timeoutUrl}"`);
const { resolveConfiguredSchedule } = await import(dataUrl(loaderJs));

const descriptor = {
  schemaVersion: 1,
  chainId: "11155111",
  maciAddress: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
  pollId: "0",
  question: { en: "q", es: "q" },
  description: { en: "d", es: "d" },
  options: [],
  metadataSource: "operator",
  expectedVoteOptions: 6,
  expectedMode: 2,
  round: "open",
};

const rpcSchedule = {
  chainId: "11155111",
  maciAddress: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
  pollId: "0",
  pollAddress: "0x29D39dD442c91dAc51a292fd04a9A7Edd16c22CB",
  tallyAddress: "0x4444444444444444444444444444444444444444",
  startTime: "90",
  endTime: "120",
  voteOptions: "6",
  mode: "2",
  status: "OPEN",
  blockNumber: 1,
  blockHash: "0xrpc",
};

const backendBody = {
  ...rpcSchedule,
  status: "INVALID_WINDOW",
  startTime: "3600",
  endTime: "3600",
  blockHash: "0xbackend",
};

test("uses the backend schedule when it names the configured poll", async () => {
  const lookup = await resolveConfiguredSchedule({
    descriptor,
    verifyEndpoint: "http://localhost:3100/verify",
    rpcUrl: "http://rpc.test",
    fetchImpl: async () => ({ ok: true, json: async () => backendBody }),
    readRpcSchedule: async () => {
      throw new Error("RPC should not run when the backend identity matches");
    },
  });
  assert.equal(lookup.schedule.blockHash, "0xbackend");
  assert.equal(lookup.schedule.status, "INVALID_WINDOW");
});

test("ignores backend Poll 99 and reads the configured poll from RPC", async () => {
  const lookup = await resolveConfiguredSchedule({
    descriptor,
    verifyEndpoint: "http://localhost:3100/verify",
    rpcUrl: "http://rpc.test",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ ...backendBody, pollId: "99", status: "OPEN", startTime: "1", endTime: "9" }),
    }),
    createProvider: () => ({}),
    readRpcSchedule: async (_provider, maciAddress, pollId, chainId) => {
      assert.equal(pollId, "0");
      assert.equal(chainId, "11155111");
      assert.equal(maciAddress, descriptor.maciAddress);
      return rpcSchedule;
    },
  });
  assert.equal(lookup.schedule.pollId, "0");
  assert.equal(lookup.schedule.status, "OPEN");
  assert.equal(lookup.schedule.blockHash, "0xrpc");
});

test("a hung backend does not block the RPC fallback", async () => {
  const started = Date.now();
  const lookup = await resolveConfiguredSchedule({
    descriptor,
    verifyEndpoint: "http://localhost:3100/verify",
    rpcUrl: "http://rpc.test",
    backendTimeoutMs: 40,
    fetchImpl: () => new Promise(() => {}),
    createProvider: () => ({}),
    readRpcSchedule: async () => rpcSchedule,
  });
  assert.ok(Date.now() - started < 1000);
  assert.equal(lookup.schedule.blockHash, "0xrpc");
});

test("schedule loading does not call /health", async () => {
  const urls = [];
  await resolveConfiguredSchedule({
    descriptor,
    verifyEndpoint: "http://localhost:3100/verify",
    rpcUrl: null,
    fetchImpl: async (url) => {
      urls.push(String(url));
      return { ok: true, json: async () => backendBody };
    },
  });
  assert.deepEqual(urls, ["http://localhost:3100/polls/configured"]);
});


test("a stalled JSON body is aborted and falls back to RPC", { timeout: 1000 }, async () => {
  let signal;
  let rpcCalls = 0;
  const lookup = await resolveConfiguredSchedule({
    descriptor,
    verifyEndpoint: "http://localhost:3100/verify",
    rpcUrl: "http://rpc.test",
    backendTimeoutMs: 20,
    fetchImpl: async (_url, init) => {
      signal = init.signal;
      return { ok: true, json: () => new Promise(() => {}) };
    },
    createProvider: () => ({}),
    readRpcSchedule: async () => { rpcCalls++; return rpcSchedule; },
  });
  assert.equal(signal.aborted, true);
  assert.equal(rpcCalls, 1);
  assert.equal(lookup.schedule.blockHash, "0xrpc");
});

test("rejects an RPC schedule whose option count does not match the manifest", async () => {
  const lookup = await resolveConfiguredSchedule({
    descriptor,
    verifyEndpoint: "http://localhost:3100/verify",
    rpcUrl: "http://rpc.test",
    fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
    createProvider: () => ({}),
    readRpcSchedule: async () => ({ ...rpcSchedule, voteOptions: "3" }),
  });
  assert.equal(lookup.error, "POLL_MISMATCH");
});
