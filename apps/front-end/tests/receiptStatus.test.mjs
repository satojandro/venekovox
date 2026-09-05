import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../src/lib/receiptStatus.ts", import.meta.url), "utf8");
let javascript;
try {
  const ts = await import("typescript");
  javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
  const { stripTypeScriptTypes } = await import("node:module");
  if (!stripTypeScriptTypes) throw new Error("Install workspace dependencies to run this test on Node 20.");
  javascript = stripTypeScriptTypes(source);
}
const {
  checkReceiptStatus,
  decodePollAddress,
  encodeGetPollCall,
  GET_POLL_SELECTOR,
  PUBLISH_MESSAGE_TOPIC,
  paddedAddressTopic,
} = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

const TX = "0x" + "cd".repeat(32);
const MACI = "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a";
const POLL = "0x29D39dD442c91dAc51a292fd04a9A7Edd16c22CB";
const OTHER_POLL = "0x" + "11".repeat(20);
const ENTRY = "0x" + "5F".repeat(20);
const BUNDLER = "0x" + "bb".repeat(20);
const ACCOUNT = "0x" + "a1".repeat(20);
const OTHER_ACCOUNT = "0x" + "a2".repeat(20);
const PROCESSOR = "0x" + "33".repeat(20);
const TALLY = "0x" + "44".repeat(20);

function word(addr) {
  return addr.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

function encodePollContracts(poll) {
  return "0x" + word(poll) + word(PROCESSOR) + word(TALLY);
}

function publishLog(poll) {
  return { address: poll, topics: [PUBLISH_MESSAGE_TOPIC] };
}

function fakeProvider({ receipt, poll = POLL, calls } = {}) {
  return {
    async getTransactionReceipt() {
      return receipt;
    },
    async call(to, data) {
      calls?.push({ to, data });
      if (to.toLowerCase() !== MACI.toLowerCase()) throw new Error("unexpected call target");
      assert.equal(data, encodeGetPollCall(0n));
      return encodePollContracts(poll);
    },
  };
}

test("invalid tx hash short-circuits to unverified without querying the chain", async () => {
  let called = false;
  const result = await checkReceiptStatus({
    provider: {
      async getTransactionReceipt() {
        called = true;
        return null;
      },
      async call() {
        called = true;
        return "0x";
      },
    },
    txHash: "0xabc",
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
  assert.equal(result.status, "unverified");
  assert.equal(called, false);
});

test("successful Poll PublishMessage from the participating account is confirmed", async () => {
  const calls = [];
  const result = await checkReceiptStatus({
    provider: fakeProvider({
      receipt: { status: 1, to: POLL, from: ACCOUNT, logs: [publishLog(POLL)] },
      calls,
    }),
    txHash: TX,
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
  assert.equal(result.status, "confirmed");
  assert.equal(result.pollMatch, true);
  assert.equal(result.accountMatch, true);
  assert.equal(result.pollAddress.toLowerCase(), POLL.toLowerCase());
  assert.equal(calls.length, 1);
});

test("poll resolution and log comparison are case-insensitive", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({
      receipt: {
        status: 1,
        to: POLL.toLowerCase(),
        from: ACCOUNT.toUpperCase(),
        logs: [{ address: POLL.toLowerCase(), topics: [PUBLISH_MESSAGE_TOPIC.toUpperCase()] }],
      },
    }),
    txHash: TX,
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
  assert.equal(result.status, "confirmed");
});

test("successful MACI call without a Poll PublishMessage is unexpected, never confirmed", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({
      receipt: {
        status: 1,
        to: MACI,
        from: ACCOUNT,
        logs: [{ address: MACI, topics: ["0x" + "ab".repeat(32)] }],
      },
    }),
    txHash: TX,
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
  assert.equal(result.status, "unexpected");
  assert.equal(result.pollMatch, false);
  assert.equal(result.accountMatch, true);
});

test("PublishMessage from a different poll is unexpected", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({
      receipt: { status: 1, to: OTHER_POLL, from: ACCOUNT, logs: [publishLog(OTHER_POLL)] },
      poll: POLL,
    }),
    txHash: TX,
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
  assert.equal(result.status, "unexpected");
  assert.equal(result.pollMatch, false);
  assert.equal(result.accountMatch, true);
});

test("direct Poll publish from a different account is unexpected", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({
      receipt: { status: 1, to: POLL, from: OTHER_ACCOUNT, logs: [publishLog(POLL)] },
    }),
    txHash: TX,
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
  assert.equal(result.status, "unexpected");
  assert.equal(result.pollMatch, true);
  assert.equal(result.accountMatch, false);
});

test("indirect smart-account publish is confirmed when the account appears in logs", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({
      receipt: {
        status: 1,
        to: ENTRY,
        from: BUNDLER,
        logs: [
          { address: ENTRY, topics: ["0x" + "11".repeat(32), paddedAddressTopic(ACCOUNT)] },
          publishLog(POLL),
        ],
      },
    }),
    txHash: TX,
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
  assert.equal(result.status, "confirmed");
  assert.equal(result.pollMatch, true);
  assert.equal(result.accountMatch, true);
});

test("status 0 receipt is reverted", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({
      receipt: { status: 0, to: POLL, from: ACCOUNT, logs: [] },
    }),
    txHash: TX,
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
  assert.equal(result.status, "reverted");
});

test("no receipt found is pending, never failed", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({ receipt: null }),
    txHash: TX,
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
  assert.equal(result.status, "pending");
});

test("a chain error is unavailable, never failed", async () => {
  const result = await checkReceiptStatus({
    provider: {
      async getTransactionReceipt() {
        throw new Error("rpc down");
      },
      async call() {
        return encodePollContracts(POLL);
      },
    },
    txHash: TX,
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
  assert.equal(result.status, "unavailable");
});

test("failed poll resolution cannot confirm a successful receipt", async () => {
  const result = await checkReceiptStatus({
    provider: {
      async getTransactionReceipt() {
        return { status: 1, to: POLL, from: ACCOUNT, logs: [publishLog(POLL)] };
      },
      async call() {
        throw new Error("maci unreachable");
      },
    },
    txHash: TX,
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
  assert.equal(result.status, "unavailable");
  assert.equal(result.pollMatch, false);
});

test("a legacy receipt without status carries no success signal: stays pending", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({
      receipt: { status: undefined, to: POLL, from: ACCOUNT, logs: [publishLog(POLL)] },
    }),
    txHash: TX,
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
  assert.equal(result.status, "pending");
});

test("getPoll encoding and decoding round-trip the poll address", () => {
  assert.equal(encodeGetPollCall(0n), GET_POLL_SELECTOR + "0".repeat(64));
  assert.equal(decodePollAddress(encodePollContracts(POLL)).toLowerCase(), POLL.toLowerCase());
  assert.equal(decodePollAddress("0x" + "0".repeat(64)), null);
});
