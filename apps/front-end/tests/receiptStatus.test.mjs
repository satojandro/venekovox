import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

// Execute the real TypeScript receipt-status verifier without a network or
// React harness: the provider is injected, so each outcome is deterministic.
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
const { checkReceiptStatus } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);

const TX = "0x" + "cd".repeat(32);
const MACI = "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a";
const OTHER = "0x" + "99".repeat(20);

function fakeProvider(receipt) {
  return {
    async getTransactionReceipt() {
      return receipt;
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
    },
    txHash: "0xabc",
    maciAddress: MACI,
  });
  assert.equal(result.status, "unverified");
  assert.equal(called, false);
});

test("successful receipt to the configured MACI contract is confirmed", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({ status: 1, to: MACI }),
    txHash: TX,
    maciAddress: MACI,
  });
  assert.equal(result.status, "confirmed");
  assert.equal(result.maciMatch, true);
});

test("recipient comparison is case-insensitive", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({ status: 1, to: MACI.toLowerCase() }),
    txHash: TX,
    maciAddress: MACI,
  });
  assert.equal(result.status, "confirmed");
  assert.equal(result.maciMatch, true);
});

test("successful receipt to a different contract is unexpected, never confirmed", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({ status: 1, to: OTHER }),
    txHash: TX,
    maciAddress: MACI,
  });
  assert.equal(result.status, "unexpected");
  assert.equal(result.maciMatch, false);
});

test("status 0 receipt is reverted", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({ status: 0, to: MACI }),
    txHash: TX,
    maciAddress: MACI,
  });
  assert.equal(result.status, "reverted");
  assert.equal(result.maciMatch, true);
});

test("no receipt found is pending, never failed", async () => {
  const result = await checkReceiptStatus({ provider: fakeProvider(null), txHash: TX, maciAddress: MACI });
  assert.equal(result.status, "pending");
});

test("a chain error is unavailable, never failed", async () => {
  const result = await checkReceiptStatus({
    provider: {
      async getTransactionReceipt() {
        throw new Error("rpc down");
      },
    },
    txHash: TX,
    maciAddress: MACI,
  });
  assert.equal(result.status, "unavailable");
});

test("a legacy receipt without status carries no success signal: stays pending", async () => {
  const result = await checkReceiptStatus({
    provider: fakeProvider({ status: undefined, to: MACI }),
    txHash: TX,
    maciAddress: MACI,
  });
  assert.equal(result.status, "pending");
});
