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
const { createReceiptStore, receiptKey } = await import(
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
const receipt = { txHash: "0xhash", submittedAt: 1757000000000 };

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
