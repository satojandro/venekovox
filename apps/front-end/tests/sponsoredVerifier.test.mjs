import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function loadModule(relative) {
  const source = await readFile(new URL(relative, import.meta.url), "utf8");
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
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

const {
  checkSponsoredPublication,
  findUserOperation,
  innerFromPollLogs,
  PUBLISH_MESSAGE_TOPIC,
  USER_OPERATION_EVENT_TOPIC,
  DEFAULT_TRUSTED_ENTRY_POINTS,
} = await loadModule("../src/lib/sponsored/verifier.ts");

const POLL = "0x29D39dD442c91dAc51a292fd04a9A7Edd16c22CB";
const ACCOUNT = "0x" + "a1".repeat(20);
const BOB = "0x" + "b0".repeat(20);
const BUNDLER = "0x" + "bb".repeat(20);
const ENTRY = DEFAULT_TRUSTED_ENTRY_POINTS[1];
const FAKE_ENTRY = "0x" + "ee".repeat(20);
const FORWARDER = "0x" + "cc".repeat(20);
const ALICE_OP = "0x" + "ab".repeat(32);
const BOB_OP = "0x" + "b1".repeat(32);

function padded(addr) {
  return "0x" + addr.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

function userOpLog({ hash = ALICE_OP, sender = ACCOUNT, success = true, address = ENTRY } = {}) {
  const word = (value) => value.toString(16).padStart(64, "0");
  return {
    address,
    topics: [USER_OPERATION_EVENT_TOPIC, hash, padded(sender), padded("0x" + "dd".repeat(20))],
    data: "0x" + word(0) + word(success ? 1 : 0) + word(0) + word(0),
  };
}

function publishLog(poll = POLL) {
  return { address: poll, topics: [PUBLISH_MESSAGE_TOPIC] };
}

function vendorConfirmed(overrides = {}) {
  return {
    transactionId: "tx-xyz789",
    phase: "confirmed",
    userOperationHash: ALICE_OP,
    transactionHash: "0x" + "cd".repeat(32),
    ...overrides,
  };
}

function linkedInner(observedCaller = ACCOUNT) {
  return {
    pollAddress: POLL,
    hasPublishMessage: true,
    observedCaller,
    linkedToUserOperation: true,
  };
}

function lookup(overrides = {}) {
  return {
    vendor: vendorConfirmed(),
    vendorLookup: "ok",
    outerReceipt: {
      status: 1,
      from: BUNDLER,
      to: ENTRY,
      logs: [userOpLog(), publishLog()],
    },
    outerReceiptLookup: "ok",
    inner: linkedInner(),
    trustedEntryPoints: DEFAULT_TRUSTED_ENTRY_POINTS,
    ...overrides,
  };
}

function check(lookupOverrides = {}) {
  return checkSponsoredPublication({
    participant: ACCOUNT,
    pollAddress: POLL,
    lookup: lookup(lookupOverrides),
  });
}

test("sponsored confirm requires trusted EntryPoint user-op success, linked Poll event, and inner caller", async () => {
  const result = check();
  assert.equal(result.status, "confirmed");
  assert.equal(result.pollMatch, true);
  assert.equal(result.accountMatch, true);
  assert.equal(result.outerFrom.toLowerCase(), BUNDLER.toLowerCase());
  assert.equal(result.outerTo.toLowerCase(), ENTRY.toLowerCase());
});

test("a mined bundle to EntryPoint is not confirmation by itself", async () => {
  const result = check({ inner: null });
  assert.equal(result.status, "unverified");
  assert.equal(result.outerFrom.toLowerCase(), BUNDLER.toLowerCase());
});

test("Alice's successful non-vote user-op is not confirmed by Bob's PublishMessage in the same bundle", async () => {
  // Alice's op succeeded without calling the Poll; Bob published in the same bundle.
  // Co-presence must stay unverified — even if someone guesses Alice as the caller.
  const result = check({
    outerReceipt: {
      status: 1,
      from: BUNDLER,
      to: ENTRY,
      logs: [
        userOpLog({ hash: ALICE_OP, sender: ACCOUNT, success: true }),
        userOpLog({ hash: BOB_OP, sender: BOB, success: true }),
        publishLog(),
      ],
    },
    inner: {
      pollAddress: POLL,
      hasPublishMessage: true,
      // No execution link to Alice's user-op (Bob published).
      observedCaller: BOB,
      linkedToUserOperation: false,
    },
  });
  assert.equal(result.status, "unverified");
  assert.equal(result.pollMatch, false);
});

test("UserOperationEvent.sender alone cannot attribute a co-located PublishMessage to this operation", async () => {
  const result = check({
    inner: {
      pollAddress: POLL,
      hasPublishMessage: true,
      observedCaller: null,
      linkedToUserOperation: false,
    },
  });
  assert.equal(result.status, "unverified");
  assert.equal(result.accountMatch, false);
});

test("a UserOperationEvent from an untrusted emitter is rejected", async () => {
  const found = findUserOperation(
    {
      status: 1,
      logs: [userOpLog({ address: FAKE_ENTRY })],
    },
    ALICE_OP,
    DEFAULT_TRUSTED_ENTRY_POINTS,
  );
  assert.equal(found, null);

  const result = check({
    outerReceipt: {
      status: 1,
      from: BUNDLER,
      to: ENTRY,
      logs: [userOpLog({ address: FAKE_ENTRY }), publishLog()],
    },
  });
  assert.equal(result.status, "unverified");
});

test("vendor confirmed without a matching UserOperationEvent stays unverified", async () => {
  const result = check({
    outerReceipt: { status: 1, from: BUNDLER, to: ENTRY, logs: [publishLog()] },
  });
  assert.equal(result.status, "unverified");
});

test("a failed UserOperationEvent is reverted even when the outer receipt succeeded", async () => {
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

test("P1-style outer from/to matching the participant/Poll is still unverified without linked inner caller", async () => {
  const result = check({
    outerReceipt: { status: 1, from: ACCOUNT, to: POLL, logs: [publishLog()] },
    inner: { pollAddress: POLL, hasPublishMessage: true, observedCaller: null, linkedToUserOperation: false },
  });
  assert.equal(result.status, "unverified");
  assert.equal(result.accountMatch, false);
});

test("vendor execution_reverted is reverted even when the outer receipt succeeded", async () => {
  const result = check({
    vendor: vendorConfirmed({ phase: "reverted" }),
    outerReceipt: { status: 1, from: BUNDLER, to: ENTRY, logs: [] },
  });
  assert.equal(result.status, "reverted");
});

test("a missing RPC receipt after vendor confirmation is pending, not failure", async () => {
  const result = check({
    outerReceipt: null,
    outerReceiptLookup: "null",
  });
  assert.equal(result.status, "pending");
});

test("a timeout after broadcast is outcome-unknown, not nothing-happened", async () => {
  const result = check({
    vendorLookup: "timeout",
    vendor: vendorConfirmed({ phase: "pending" }),
  });
  assert.equal(result.status, "outcome-unknown");
});

test("sponsorship denied stays denied and does not look like a user-paid send", async () => {
  const result = check({
    vendor: vendorConfirmed({ phase: "denied" }),
    outerReceipt: null,
    outerReceiptLookup: "null",
    inner: null,
  });
  assert.equal(result.status, "denied");
});

test("vendor pending stays pending even if a PublishMessage log is already cached", async () => {
  const result = check({
    vendor: vendorConfirmed({ phase: "pending" }),
  });
  assert.equal(result.status, "pending");
});

test("inner caller mismatch cannot confirm, even with a linked Poll event", async () => {
  const result = check({
    inner: linkedInner(FORWARDER),
  });
  assert.equal(result.status, "unverified");
  assert.equal(result.pollMatch, true);
  assert.equal(result.accountMatch, false);
});

test("vendor lookup errors are unavailable, never failed", async () => {
  const result = check({ vendorLookup: "error" });
  assert.equal(result.status, "unavailable");
});

test("replaced user-ops are outcome-unknown", async () => {
  const result = check({ vendor: vendorConfirmed({ phase: "replaced" }) });
  assert.equal(result.status, "outcome-unknown");
});

test("innerFromPollLogs does not treat a bundler as the participant and defaults unlinked", () => {
  const inner = innerFromPollLogs(
    { status: 1, from: BUNDLER, to: ENTRY, logs: [publishLog()] },
    POLL,
    ACCOUNT,
  );
  assert.equal(inner.hasPublishMessage, true);
  assert.equal(inner.observedCaller.toLowerCase(), ACCOUNT.toLowerCase());
  assert.equal(inner.linkedToUserOperation, false);
});
