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
  PUBLISH_MESSAGE_SELECTOR,
  isPublishCalldata,
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
const TOKEN = "0x" + "77".repeat(20);
const PUBLISH_DATA = PUBLISH_MESSAGE_SELECTOR + "11".repeat(128);

function word(addr) {
  return addr.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

function encodePollContracts(poll) {
  return "0x" + word(poll) + word(PROCESSOR) + word(TALLY);
}

function publishLog(poll) {
  return { address: poll, topics: [PUBLISH_MESSAGE_TOPIC] };
}

function paddedAddressTopic(account) {
  return "0x" + account.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
}

function fakeProvider({ receipt, tx, poll = POLL, calls } = {}) {
  return {
    async getTransactionReceipt() {
      return receipt;
    },
    async getTransaction() {
      return tx ?? null;
    },
    async call(to, data) {
      calls?.push({ to, data });
      if (to.toLowerCase() !== MACI.toLowerCase()) throw new Error("unexpected call target");
      assert.equal(data, encodeGetPollCall(0n));
      return encodePollContracts(poll);
    },
  };
}

function check(receipt, tx, extras = {}) {
  return checkReceiptStatus({
    provider: fakeProvider({ receipt, tx, ...extras }),
    txHash: TX,
    maciAddress: MACI,
    pollId: 0n,
    account: ACCOUNT,
  });
}

test("invalid tx hash short-circuits to unverified without querying the chain", async () => {
  let called = false;
  const result = await checkReceiptStatus({
    provider: {
      async getTransactionReceipt() {
        called = true;
        return null;
      },
      async getTransaction() {
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

test("direct EOA publishMessage to the resolved Poll is confirmed", async () => {
  const calls = [];
  const result = await check({
    status: 1,
    to: POLL,
    from: ACCOUNT,
    logs: [publishLog(POLL)],
  }, { to: POLL, from: ACCOUNT, data: PUBLISH_DATA }, { calls });
  assert.equal(result.status, "confirmed");
  assert.equal(result.pollMatch, true);
  assert.equal(result.accountMatch, true);
  assert.equal(result.pollAddress.toLowerCase(), POLL.toLowerCase());
  assert.equal(calls.length, 1);
  assert.equal(isPublishCalldata(PUBLISH_DATA), true);
});

test("poll resolution and comparison are case-insensitive", async () => {
  const result = await check(
    {
      status: 1,
      to: POLL.toLowerCase(),
      from: ACCOUNT.toUpperCase(),
      logs: [{ address: POLL.toLowerCase(), topics: [PUBLISH_MESSAGE_TOPIC.toUpperCase()] }],
    },
    { to: POLL.toLowerCase(), from: ACCOUNT.toUpperCase(), data: PUBLISH_DATA.toUpperCase() },
  );
  assert.equal(result.status, "confirmed");
});

test("successful MACI call without a Poll publication is unexpected, never confirmed", async () => {
  const result = await check(
    {
      status: 1,
      to: MACI,
      from: ACCOUNT,
      logs: [{ address: MACI, topics: ["0x" + "ab".repeat(32)] }],
    },
    { to: MACI, from: ACCOUNT, data: "0xabcdef01" },
  );
  assert.equal(result.status, "unexpected");
  assert.equal(result.pollMatch, false);
  assert.equal(result.accountMatch, true);
});

test("PublishMessage from a different poll is unexpected", async () => {
  const result = await check(
    { status: 1, to: OTHER_POLL, from: ACCOUNT, logs: [publishLog(OTHER_POLL)] },
    { to: OTHER_POLL, from: ACCOUNT, data: PUBLISH_DATA },
    { poll: POLL },
  );
  assert.equal(result.status, "unexpected");
  assert.equal(result.pollMatch, false);
});

test("direct Poll publish from a different account is unexpected", async () => {
  const result = await check(
    { status: 1, to: POLL, from: OTHER_ACCOUNT, logs: [publishLog(POLL)] },
    { to: POLL, from: OTHER_ACCOUNT, data: PUBLISH_DATA },
  );
  assert.equal(result.status, "unexpected");
  assert.equal(result.pollMatch, true);
  assert.equal(result.accountMatch, false);
});

test("an unrelated log mentioning the account does not establish ownership", async () => {
  const result = await check(
    {
      status: 1,
      to: POLL,
      from: OTHER_ACCOUNT,
      logs: [
        publishLog(POLL),
        { address: TOKEN, topics: ["0x" + "dd".repeat(32), paddedAddressTopic(ACCOUNT)] },
      ],
    },
    { to: POLL, from: OTHER_ACCOUNT, data: PUBLISH_DATA },
  );
  assert.equal(result.status, "unexpected");
  assert.equal(result.accountMatch, false);
});

test("unknown indirect execution stays unverified, never confirmed", async () => {
  const result = await check(
    {
      status: 1,
      to: ENTRY,
      from: BUNDLER,
      logs: [
        { address: ENTRY, topics: ["0x" + "11".repeat(32), paddedAddressTopic(ACCOUNT)] },
        publishLog(POLL),
      ],
    },
    { to: ENTRY, from: BUNDLER, data: "0x" + "ee".repeat(32) },
  );
  assert.equal(result.status, "unverified");
  assert.equal(result.pollMatch, true);
});

test("Poll constructor placeholder PublishMessage is not a vote", async () => {
  const result = await check(
    {
      status: 1,
      to: null,
      from: ACCOUNT,
      contractAddress: POLL,
      logs: [publishLog(POLL)],
    },
    { to: null, from: ACCOUNT, data: "0x60806040" },
  );
  assert.equal(result.status, "unexpected");
});

test("a successful Poll call that is not publishMessage is not a vote", async () => {
  const result = await check(
    { status: 1, to: POLL, from: ACCOUNT, logs: [publishLog(POLL)] },
    { to: POLL, from: ACCOUNT, data: "0xdeadbeef" + "00".repeat(32) },
  );
  assert.equal(result.status, "unexpected");
});

test("status 0 receipt is reverted", async () => {
  const result = await check(
    { status: 0, to: POLL, from: ACCOUNT, logs: [] },
    { to: POLL, from: ACCOUNT, data: PUBLISH_DATA },
  );
  assert.equal(result.status, "reverted");
});

test("no receipt found is pending, never failed", async () => {
  const result = await check(null, null);
  assert.equal(result.status, "pending");
});

test("a chain error is unavailable, never failed", async () => {
  const result = await checkReceiptStatus({
    provider: {
      async getTransactionReceipt() {
        throw new Error("rpc down");
      },
      async getTransaction() {
        return null;
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
      async getTransaction() {
        return { to: POLL, from: ACCOUNT, data: PUBLISH_DATA };
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
  const result = await check(
    { status: undefined, to: POLL, from: ACCOUNT, logs: [publishLog(POLL)] },
    { to: POLL, from: ACCOUNT, data: PUBLISH_DATA },
  );
  assert.equal(result.status, "pending");
});

test("getPoll encoding and decoding round-trip the poll address", () => {
  assert.equal(encodeGetPollCall(0n), GET_POLL_SELECTOR + "0".repeat(64));
  assert.equal(decodePollAddress(encodePollContracts(POLL)).toLowerCase(), POLL.toLowerCase());
  assert.equal(decodePollAddress("0x" + "0".repeat(64)), null);
});
