import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function load(rel) {
  const source = ts.transpileModule(readFileSync(new URL(rel, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const fn = new Function("require", "module", "exports", source);
  fn(require, module, module.exports);
  return module.exports;
}

const snapshot = load("../src/trees/snapshot.ts");

test("contiguous signup indexes start at 1", () => {
  snapshot.assertContiguousSignupIndexes([
    { stateIndex: "1", publicKeyX: "1", publicKeyY: "2" },
    { stateIndex: "2", publicKeyX: "3", publicKeyY: "4" },
  ]);
  assert.throws(() => snapshot.assertContiguousSignupIndexes([{ stateIndex: "1" }, { stateIndex: "3" }]), /gap/);
});

test("same-size reorg is detected by fingerprint, not count", () => {
  const a = {
    provenance: { blockNumber: 10, blockHash: "0xaaa" },
    leafFingerprint: snapshot.leafFingerprint([{ stateIndex: "1", publicKeyX: "1", publicKeyY: "1" }]),
  };
  const b = {
    provenance: { blockNumber: 10, blockHash: "0xbbb" },
    leafFingerprint: snapshot.leafFingerprint([{ stateIndex: "1", publicKeyX: "9", publicKeyY: "9" }]),
  };
  assert.equal(snapshot.provenanceChanged(a.provenance, b.provenance), true);
  assert.equal(snapshot.sameSizeReorg(a, b, 1, 1), true);
  assert.equal(snapshot.shouldRebuildCache(a, { blockNumber: 10, blockHash: "0xbbb" }), true);
});

test("lagging indexer head with the same hash is not a rebuild by itself", () => {
  const cache = {
    provenance: { blockNumber: 10, blockHash: "0xaaa" },
    leafFingerprint: "1:1:1",
  };
  assert.equal(snapshot.shouldRebuildCache(cache, { blockNumber: 10, blockHash: "0xaaa" }), false);
  assert.equal(snapshot.shouldRebuildCache(cache, { blockNumber: 11, blockHash: "0xccc" }), true);
  assert.equal(
    snapshot.shouldRebuildCache(cache, { blockNumber: 10, blockHash: "0xaaa", hasIndexingErrors: true }),
    true,
  );
});

test("collectPages rejects a gap across pages", async () => {
  await assert.rejects(
    () =>
      snapshot.collectPages({
        pageSize: 1,
        fetchPage: async (cursor) => {
          if (cursor === 0n) return [{ stateIndex: "1", publicKeyX: "1", publicKeyY: "1" }];
          if (cursor === 1n) return [{ stateIndex: "3", publicKeyX: "3", publicKeyY: "4" }];
          return [];
        },
      }),
    /gap/,
  );
});

test("older voter leafIndex is the signup slot, not the tip", () => {
  const leaves = [
    { stateIndex: "1", publicKeyX: "11", publicKeyY: "12" },
    { stateIndex: "2", publicKeyX: "21", publicKeyY: "22" },
  ];
  assert.equal(snapshot.findLeafIndex(leaves, "11", "12"), 1);
});

test("non-power-of-two LeanIMT proof index can differ from leafIndex", () => {
  const { LeanIMT } = require("@zk-kit/lean-imt");
  const crypto = require("@maci-protocol/crypto");
  const tree = new LeanIMT(crypto.hashLeanIMT);
  tree.insert(crypto.PAD_KEY_HASH);
  tree.insert(crypto.hashLeftRight(11n, 12n));
  tree.insert(crypto.hashLeftRight(21n, 22n));
  assert.equal(tree.size, 3);
  const proof = tree.generateProof(2);
  assert.equal(proof.leaf, crypto.hashLeftRight(21n, 22n));
  assert.notEqual(proof.index, 2);
  assert.ok(tree.verifyProof(proof));
});

test("tampered sibling list fails verification", () => {
  const { LeanIMT } = require("@zk-kit/lean-imt");
  const crypto = require("@maci-protocol/crypto");
  const tree = new LeanIMT(crypto.hashLeanIMT);
  tree.insert(crypto.PAD_KEY_HASH);
  tree.insert(crypto.hashLeftRight(11n, 12n));
  const proof = tree.generateProof(1);
  proof.siblings[0] = (proof.siblings[0] ?? 0n) + 1n;
  assert.equal(tree.verifyProof(proof), false);
});

test("wrong-key leaf is rejected by findLeafIndex", () => {
  assert.throws(
    () => snapshot.findLeafIndex([{ stateIndex: "1", publicKeyX: "1", publicKeyY: "1" }], "9", "9"),
    /not in this signup snapshot/,
  );
});
