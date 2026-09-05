import assert from "node:assert/strict";
import { test } from "node:test";
import { importTs } from "./loadTs.mjs";

const { createSponsoredStore, parseSponsoredRecord, sponsoredKey } = await importTs(
  "../src/lib/sponsored/records.ts",
  import.meta.url,
);

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const ctx = { chainId: 11155111n, maciAddress: "0xMACI", pollId: 0n, account: "0xAbC" };
const record = { transactionId: "tx-xyz789", submittedAt: 1757000000000, userOperationHash: "0x" + "11".repeat(32) };

test("sponsored records persist without a transaction hash so refresh can reconcile", () => {
  const store = createSponsoredStore(fakeStorage());
  store.save(ctx, record);
  const loaded = store.load(ctx);
  assert.equal(loaded.transactionId, "tx-xyz789");
  assert.equal(loaded.transactionHash, undefined);
  assert.equal(loaded.userOperationHash, record.userOperationHash);
});

test("context scoping matches the P1 receipt namespace shape", () => {
  assert.match(sponsoredKey(ctx), /^venekovox_sponsored:v1:11155111:0xmaci:0:0xabc$/);
});

test("a later transaction hash can be stored once the vendor reports inclusion", () => {
  const store = createSponsoredStore(fakeStorage());
  store.save(ctx, { ...record, transactionHash: "0x" + "ab".repeat(32) });
  assert.equal(store.load(ctx).transactionHash, "0x" + "ab".repeat(32));
});

test("malformed records load as missing, never as confirmed intent", () => {
  assert.equal(parseSponsoredRecord("{").ok, false);
  assert.equal(parseSponsoredRecord(JSON.stringify({ submittedAt: 1 })).ok, false);
  assert.equal(createSponsoredStore(fakeStorage()).load(ctx), null);
});
