import assert from "node:assert/strict";
import { test } from "node:test";
import { importTs } from "./loadTs.mjs";

const {
  checkSponsoredPublication,
  findUserOperation,
  innerFromPollLogs,
  PUBLISH_MESSAGE_TOPIC,
  USER_OPERATION_EVENT_TOPIC,
  DEFAULT_TRUSTED_ENTRY_POINTS,
} = await importTs("../src/lib/sponsored/verifier.ts", import.meta.url);

const USER_OP = "0x" + "11".repeat(32);
const OTHER_OP = "0x" + "22".repeat(32);
const POLL = "0x" + "29".repeat(20);
const ACCOUNT = "0x" + "a1".repeat(20);
const OTHER = "0x" + "a2".repeat(20);
const BUNDLER = "0x" + "bb".repeat(20);
const ENTRY = DEFAULT_TRUSTED_ENTRY_POINTS[0];
const FAKE = "0x" + "ee".repeat(20);

function padded(addr) {
  return "0x" + addr.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

function successData(success) {
  const nonce = "00".repeat(64);
  const flag = success ? "01" : "00";
  return "0x" + nonce.slice(0, 64) + flag.padStart(64, "0") + "00".repeat(64);
}

function userOpLog({ hash = USER_OP, sender = ACCOUNT, success = true, address = ENTRY } = {}) {
  return {
    address,
    topics: [USER_OPERATION_EVENT_TOPIC, hash, padded(sender), padded("0x" + "cc".repeat(20))],
    data: successData(success),
  };
}

function publishLog(poll = POLL) {
  return { address: poll, topics: [PUBLISH_MESSAGE_TOPIC] };
}

function vendor(phase, extras = {}) {
  return {
    transactionId: "tx-lab-1",
    phase,
    userOperationHash: USER_OP,
    transactionHash: "0x" + "ab".repeat(32),
    ...extras,
  };
}

function check(overrides = {}) {
  return checkSponsoredPublication({
    participant: ACCOUNT,
    pollAddress: POLL,
    lookup: {
      vendor: vendor("confirmed"),
      vendorLookup: "ok",
      outerReceipt: {
        status: 1,
        from: BUNDLER,
        to: ENTRY,
        logs: [userOpLog(), publishLog()],
      },
      outerReceiptLookup: "ok",
      inner: {
        ...innerFromPollLogs({ logs: [publishLog()] }, POLL, ACCOUNT),
        linkedToUserOperation: true,
      },
      trustedEntryPoints: DEFAULT_TRUSTED_ENTRY_POINTS,
      ...overrides,
    },
  });
}

test("sponsored confirm needs trusted user-op success, linked PublishMessage, and the participant as caller", () => {
  const result = check();
  assert.equal(result.status, "confirmed");
  assert.equal(result.pollMatch, true);
  assert.equal(result.accountMatch, true);
});

test("P1-shaped from/to are not used: bundler → EntryPoint can still confirm when linked", () => {
  const result = check();
  assert.notEqual(result.outerFrom.toLowerCase(), ACCOUNT.toLowerCase());
  assert.notEqual(result.outerTo.toLowerCase(), POLL.toLowerCase());
  assert.equal(result.status, "confirmed");
});

test("a mined bundle with UserOperationEvent.success=false is reverted, not confirmed", () => {
  const result = check({
    outerReceipt: {
      status: 1,
      from: BUNDLER,
      to: ENTRY,
      logs: [userOpLog({ success: false }), publishLog()],
    },
  });
  assert.equal(result.status, "reverted");
});

test("vendor confirmed plus a bundle receipt without this user-op event stays unverified", () => {
  const result = check({
    vendor: vendor("confirmed", { userOperationHash: OTHER_OP }),
    outerReceipt: {
      status: 1,
      from: BUNDLER,
      to: ENTRY,
      logs: [userOpLog({ hash: USER_OP }), publishLog()],
    },
  });
  assert.equal(result.status, "unverified");
});

test("untrusted emitter cannot supply UserOperationEvent success", () => {
  assert.equal(findUserOperation({ logs: [userOpLog({ address: FAKE })] }, USER_OP), null);
});

test("a null RPC receipt after vendor confirmed is pending, not vendor failure", () => {
  const result = check({ outerReceipt: null, outerReceiptLookup: "null" });
  assert.equal(result.status, "pending");
});

test("timeout after broadcast is outcome-unknown, not 'nothing happened'", () => {
  const result = check({ vendorLookup: "timeout" });
  assert.equal(result.status, "outcome-unknown");
});

test("sponsorship denied is denied, not a user-paid fallback", () => {
  const result = check({ vendor: vendor("denied") });
  assert.equal(result.status, "denied");
});

test("missing vendor identifiers cannot confirm from logs alone", () => {
  const result = check({ vendor: null, vendorLookup: "missing" });
  assert.equal(result.status, "unverified");
});

test("PublishMessage from the poll with the wrong observed caller stays unverified", () => {
  const result = check({
    inner: {
      ...innerFromPollLogs({ logs: [publishLog()] }, POLL, OTHER),
      linkedToUserOperation: true,
    },
    outerReceipt: {
      status: 1,
      from: BUNDLER,
      to: ENTRY,
      logs: [userOpLog({ sender: OTHER }), publishLog()],
    },
  });
  assert.equal(result.status, "unverified");
  assert.equal(result.pollMatch, true);
  assert.equal(result.accountMatch, false);
});

test("UserOperationEvent.sender does not substitute for linked observedCaller", () => {
  const result = check({
    inner: {
      ...innerFromPollLogs({ logs: [publishLog()] }, POLL, null),
      linkedToUserOperation: false,
    },
  });
  assert.equal(result.status, "unverified");
  assert.equal(result.accountMatch, false);
});

test("findUserOperation refuses to guess when the hash is missing", () => {
  const found = findUserOperation({ logs: [userOpLog()] }, null);
  assert.equal(found, null);
});
