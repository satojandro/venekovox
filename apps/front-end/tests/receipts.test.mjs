import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

// Execute the real TypeScript receipt store without a bundler.
const source = await readFile(new URL("../src/lib/receipts.ts", import.meta.url), "utf8");
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
const { createReceiptStore, parseStoredReceipt, receiptKey } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    _map: map,
  };
}

const ctx = { chainId: 11155111n, maciAddress: "0xMACI", pollId: 0n, account: "0xAbC" };
const receipt = { txHash: "0x" + "ab".repeat(32), submittedAt: 1757000000000 };

test("receipt key is context-scoped and checksum-insensitive", () => {
  const key = receiptKey(ctx);
  assert.match(key, /^venekovox_receipt:v1:11155111:0xmaci:0:0xabc$/);
  // Same context, different case => same key.
  assert.equal(
    receiptKey(ctx),
    receiptKey({ chainId: 11155111n, maciAddress: "0xmAci", pollId: 0n, account: "0xAbC" }),
  );
  // Different wallet, chain or poll => different key.
  assert.notEqual(key, receiptKey({ ...ctx, account: "0xOther" }));
  assert.notEqual(key, receiptKey({ ...ctx, chainId: 1n }));
  assert.notEqual(key, receiptKey({ ...ctx, pollId: 1n }));
});

test("save then load round-trips within the same context", () => {
  const storage = fakeStorage();
  const store = createReceiptStore(storage);
  store.save(ctx, receipt);
  assert.deepEqual(store.load(ctx), receipt);
});

test("missing, corrupt or malformed storage means 'unable to confirm', never success", () => {
  const storage = fakeStorage();
  const store = createReceiptStore(storage);
  assert.equal(store.load(ctx), null); // nothing stored
  storage.setItem(receiptKey(ctx), "{not json");
  assert.equal(store.load(ctx), null); // corrupt
  storage.setItem(receiptKey(ctx), JSON.stringify({ submittedAt: 123 })); // missing txHash
  assert.equal(store.load(ctx), null); // malformed
  storage.setItem(receiptKey(ctx), JSON.stringify({ txHash: "nothex", submittedAt: 123 }));
  assert.equal(store.load(ctx), null); // not a tx hash
});

test("a receipt saved for wallet A does not load under wallet B", () => {
  const storage = fakeStorage();
  const store = createReceiptStore(storage);
  store.save(ctx, receipt);
  assert.equal(store.load({ ...ctx, account: "0xOther" }), null);
});

test("an unavailable storage backend throws on save and reads as unconfirmed", () => {
  const store = createReceiptStore(undefined);
  assert.throws(() => store.save(ctx, receipt), /storage is unavailable/);
  assert.equal(store.load(ctx), null);
});

test("strict receipt shape: only real 0x-prefixed 64-hex hashes load", () => {
  const storage = fakeStorage();
  const store = createReceiptStore(storage);
  const good = { txHash: "0x" + "ab".repeat(32), submittedAt: 1757000000000 };

  storage.setItem(receiptKey(ctx), JSON.stringify(good));
  assert.deepEqual(store.load(ctx), good);
  // Uppercase hex is a valid keccak serialization too.
  storage.setItem(receiptKey(ctx), JSON.stringify({ ...good, txHash: "0x" + "AB".repeat(32) }));
  assert.notEqual(store.load(ctx), null);

  // Anything that is not exactly 64 hex chars after 0x is rejected — the old
  // code accepted ANY string with an "0x" prefix (G11).
  const rejects = [
    "0xabc",
    "0x" + "ab".repeat(31), // too short
    "0x" + "ab".repeat(32) + "00", // too long
    "0x" + "zz".repeat(32), // non-hex
    "0xhash",
    0,
  ];
  for (const txHash of rejects) {
    storage.setItem(receiptKey(ctx), JSON.stringify({ ...good, txHash }));
    assert.equal(store.load(ctx), null, `should reject ${String(txHash).slice(0, 10)}…`);
  }
});

test("receipt timestamps must be finite positive numbers", () => {
  const storage = fakeStorage();
  const store = createReceiptStore(storage);
  for (const submittedAt of [0, -1, NaN, "1757000000000", null]) {
    storage.setItem(receiptKey(ctx), JSON.stringify({ txHash: "0x" + "ab".repeat(32), submittedAt }));
    assert.equal(store.load(ctx), null, `should reject submittedAt=${String(submittedAt)}`);
  }
});

test("parseStoredReceipt labels the failure reason for diagnostics", () => {
  const goodHash = "0x" + "ab".repeat(32);
  assert.deepEqual(parseStoredReceipt("{not json"), { ok: false, reason: "invalid-json" });
  assert.deepEqual(parseStoredReceipt(JSON.stringify({ txHash: "0xabc", submittedAt: 1757000000000 })), {
    ok: false,
    reason: "invalid-tx-hash",
  });
  assert.deepEqual(parseStoredReceipt(JSON.stringify({ txHash: goodHash, submittedAt: 0 })), {
    ok: false,
    reason: "invalid-time",
  });
  assert.deepEqual(parseStoredReceipt(JSON.stringify({ txHash: goodHash, submittedAt: 1757000000000 })), {
    ok: true,
    receipt: { txHash: goodHash, submittedAt: 1757000000000 },
  });
});
