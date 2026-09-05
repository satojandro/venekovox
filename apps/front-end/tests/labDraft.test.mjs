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

test("same transaction update that omits userOperationHash preserves the broadcast id", () => {
  const storage = fakeStorage();
  upsertLabDraft(
    {
      transactionId: "tx-same",
      chainId: "11155111",
      userOperationHash: "0x" + "11".repeat(32),
      intent: "probe",
    },
    storage,
  );
  const updated = upsertLabDraft(
    {
      transactionId: "tx-same",
      chainId: "11155111",
      // Status responses may omit the hash — must not erase it.
      transactionHash: "0x" + "ab".repeat(32),
    },
    storage,
  );
  assert.equal(updated.userOperationHash, "0x" + "11".repeat(32));
  assert.equal(updated.transactionHash, "0x" + "ab".repeat(32));
  assert.equal(updated.intent, "probe");
});

test("different transaction_id starts a fresh draft without inherited metadata", async () => {
  const storage = fakeStorage();
  const first = upsertLabDraft(
    {
      transactionId: "tx-old",
      chainId: "11155111",
      participant: "0x" + "a1".repeat(20),
      userOperationHash: "0x" + "11".repeat(32),
      transactionHash: "0x" + "ab".repeat(32),
      intent: "probe",
    },
    storage,
  );
  await new Promise((r) => setTimeout(r, 5));
  const next = upsertLabDraft({ transactionId: "tx-new", chainId: "11155111" }, storage);
  assert.notEqual(next.submittedAt, first.submittedAt);
  assert.equal(next.userOperationHash, undefined);
  assert.equal(next.transactionHash, undefined);
  assert.equal(next.participant, undefined);
  assert.equal(next.intent, undefined);
});

test("a caller-supplied submittedAt on a new transaction_id is honored — page must not pass a foreign clock", () => {
  const storage = fakeStorage();
  const first = upsertLabDraft({ transactionId: "tx-old", chainId: "11155111" }, storage);
  const stamped = upsertLabDraft(
    {
      transactionId: "tx-new",
      chainId: "11155111",
      submittedAt: first.submittedAt,
    },
    storage,
  );
  // Helper cannot know the clock is foreign; W1Experiment gates on submittedTxId.
  assert.equal(stamped.submittedAt, first.submittedAt);
});

test("throwing storage surfaces after identifiers exist in memory (persist regression)", () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota exceeded");
    },
  };
  assert.throws(
    () =>
      upsertLabDraft(
        {
          transactionId: "tx-broadcast",
          chainId: "11155111",
          userOperationHash: "0x" + "11".repeat(32),
        },
        storage,
      ),
    /quota exceeded/,
  );
});
