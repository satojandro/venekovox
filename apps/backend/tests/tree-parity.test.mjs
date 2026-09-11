import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(new URL("../../../packages/sdk/package.json", import.meta.url));
const ts = require("typescript");
const { LeanIMT } = sdkRequire("@zk-kit/lean-imt");
const crypto = sdkRequire("@maci-protocol/crypto");
const { padKey, Keypair } = sdkRequire("@maci-protocol/domainobjs");

function load(rel) {
  const source = ts.transpileModule(readFileSync(new URL(rel, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const fn = new Function("require", "module", "exports", source);
  fn(require, module, module.exports);
  return module.exports;
}

const lean = load("../src/trees/leanTree.ts");

test("PAD + indexed StateLeaves root matches RPC-key rebuild for the same snapshot", () => {
  const first = new Keypair();
  const second = new Keypair();
  const rows = [
    {
      stateIndex: "1",
      publicKeyX: first.publicKey.raw[0].toString(),
      publicKeyY: first.publicKey.raw[1].toString(),
    },
    {
      stateIndex: "2",
      publicKeyX: second.publicKey.raw[0].toString(),
      publicKeyY: second.publicKey.raw[1].toString(),
    },
  ];
  const indexed = lean.buildSignUpTree(rows);
  const fromKeys = new LeanIMT(crypto.hashLeanIMT);
  fromKeys.insert(padKey.hash());
  fromKeys.insert(first.publicKey.hash());
  fromKeys.insert(second.publicKey.hash());
  assert.equal(padKey.hash(), crypto.PAD_KEY_HASH);
  assert.equal(indexed.size, 3);
  assert.equal(fromKeys.size, 3);
  assert.equal(indexed.root, fromKeys.root);
  const older = indexed.generateProof(1);
  assert.ok(indexed.verifyProof(older));
  assert.equal(older.leaf, first.publicKey.hash());
});

test("incremental insertMany of the second leaf matches a full PAD+leaves rebuild", async () => {
  const first = new Keypair();
  const second = new Keypair();
  const firstRow = {
    stateIndex: "1",
    publicKeyX: first.publicKey.raw[0].toString(),
    publicKeyY: first.publicKey.raw[1].toString(),
  };
  const secondRow = {
    stateIndex: "2",
    publicKeyX: second.publicKey.raw[0].toString(),
    publicKeyY: second.publicKey.raw[1].toString(),
  };
  const cold = lean.buildSignUpTree([firstRow]);
  const appended = await lean.appendSignupLeaves(cold, [secondRow]);
  const rebuilt = lean.buildSignUpTree([firstRow, secondRow]);
  assert.equal(cold.size, 2);
  assert.equal(appended.size, 3);
  assert.equal(appended.root, rebuilt.root);
});
