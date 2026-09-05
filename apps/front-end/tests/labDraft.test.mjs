import assert from "node:assert/strict";
import { test } from "node:test";
import { importTs } from "./loadTs.mjs";

const { loadLabDraft, parseLabDraft, upsertLabDraft } = await importTs(
  "../src/lib/sponsored/labDraft.ts",
  import.meta.url,
);

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test("lab draft persists transaction_id without a mined hash for E4 refresh", () => {
  const storage = fakeStorage();
  const draft = upsertLabDraft(
    {
      transactionId: "tx-xyz789",
      chainId: "11155111",
      participant: "0x" + "a1".repeat(20),
      userOperationHash: "0x" + "11".repeat(32),
      intent: "probe",
    },
    storage,
  );
  assert.equal(draft.transactionHash, undefined);
  const loaded = loadLabDraft(storage);
  assert.equal(loaded.transactionId, "tx-xyz789");
  assert.equal(loaded.submittedAt, draft.submittedAt);
});

test("updating the same transaction_id preserves the original submittedAt", async () => {
  const storage = fakeStorage();
  const first = upsertLabDraft({ transactionId: "tx-1", chainId: "11155111" }, storage);
  await new Promise((r) => setTimeout(r, 5));
  const second = upsertLabDraft(
    {
      transactionId: "tx-1",
      chainId: "11155111",
      transactionHash: "0x" + "ab".repeat(32),
    },
    storage,
  );
  assert.equal(second.submittedAt, first.submittedAt);
  assert.equal(second.transactionHash, "0x" + "ab".repeat(32));
});

test("malformed lab drafts are rejected", () => {
  assert.equal(parseLabDraft("{").ok, false);
  assert.equal(parseLabDraft(JSON.stringify({ transactionId: "tx-1" })).ok, false);
});
