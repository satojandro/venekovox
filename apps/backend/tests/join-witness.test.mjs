import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(new URL("../../../packages/sdk/package.json", import.meta.url));
const ts = require("typescript");
const loaded = new Map();

function loadTs(fileUrl) {
  const abs = fileURLToPath(fileUrl);
  if (loaded.has(abs)) return loaded.get(abs).exports;
  const source = ts.transpileModule(readFileSync(abs, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  loaded.set(abs, module);
  const fileRequire = createRequire(fileUrl);
  const req = (id) => {
    if (id.startsWith(".")) {
      let candidate = join(dirname(abs), id);
      if (!candidate.endsWith(".ts") && existsSync(`${candidate}.ts`)) candidate = `${candidate}.ts`;
      if (candidate.endsWith(".ts")) return loadTs(pathToFileURL(candidate));
    }
    return fileRequire(id);
  };
  const fn = new Function("require", "module", "exports", source);
  fn(req, module, module.exports);
  return module.exports;
}

const { LeanIMT } = sdkRequire("@zk-kit/lean-imt");
const crypto = sdkRequire("@maci-protocol/crypto");
const { Keypair } = sdkRequire("@maci-protocol/domainobjs");
const inclusion = loadTs(new URL("../../../packages/sdk/ts/trees/inclusionProof.ts", import.meta.url));
const { joiningCircuitInputs } = loadTs(new URL("../../../packages/sdk/ts/user/utils.ts", import.meta.url));
const { resolvePinnedJoinInputs } = loadTs(new URL("../../../packages/sdk/ts/user/joinWitness.ts", import.meta.url));

function treeFor(keypair) {
  const tree = new LeanIMT(crypto.hashLeanIMT);
  tree.insert(crypto.PAD_KEY_HASH);
  tree.insert(keypair.publicKey.hash());
  return tree;
}

test("joiningCircuitInputs pads a copy; LeanIMT verification stays true", () => {
  const keypair = new Keypair();
  const tree = treeFor(keypair);
  const proof = tree.generateProof(1);
  const originalLength = proof.siblings.length;
  const originalSiblings = proof.siblings.slice();

  const inputs = joiningCircuitInputs(proof, 10n, keypair.privateKey, keypair.publicKey, 1n);

  assert.equal(proof.siblings.length, originalLength);
  assert.deepEqual(proof.siblings, originalSiblings);
  assert.ok(tree.verifyProof(proof));
  assert.equal(inclusion.paddedSiblings(proof, 10n).length, 10);
  assert.ok(Array.isArray(inputs.siblings));
  assert.equal(inputs.siblings.length, 10);
});

test("invalid service proof falls back to a validated subgraph witness", async () => {
  const keypair = new Keypair();
  const tree = treeFor(keypair);
  const proof = tree.generateProof(1);
  const tampered = {
    root: proof.root,
    leaf: proof.leaf,
    index: proof.index,
    siblings: proof.siblings.map((sibling, i) => (i === 0 ? sibling + 1n : sibling)),
  };
  assert.equal(tree.verifyProof(tampered), false);

  let rpcCalls = 0;
  const resolved = await resolvePinnedJoinInputs({
    maciContract: {
      getStateRootOnIndexedSignUp: async (index) => {
        if (Number(index) === 99) return 0n;
        return proof.root;
      },
    },
    maciAddress: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
    userMaciPublicKey: keypair.publicKey,
    userMaciPrivateKey: keypair.privateKey,
    pollId: 1n,
    stateTreeDepth: 10n,
    stateIndex: 1n,
    inclusionProof: tampered,
    pinnedStateRootIndex: 99,
    subgraphUrl: "http://127.0.0.1/graph/query",
    signer: {},
    prepareFromSubgraph: async () => ({
      inputs: { source: "subgraph" },
      inclusionProof: proof,
      stateRootIndex: 1,
      leafIndex: 1,
    }),
    prepareFromEvents: async () => {
      rpcCalls += 1;
      throw new Error("RPC should not run when subgraph validates");
    },
  });

  assert.equal(resolved.source, "subgraph");
  assert.equal(resolved.stateRootIndex, 1);
  assert.equal(resolved.circuitInputs.source, "subgraph");
  assert.equal(rpcCalls, 0);
});

test("invalid service and subgraph proofs fall through to RPC", async () => {
  const keypair = new Keypair();
  const tree = treeFor(keypair);
  const proof = tree.generateProof(1);
  const tampered = {
    ...proof,
    siblings: proof.siblings.map((sibling) => sibling + 1n),
  };

  const resolved = await resolvePinnedJoinInputs({
    maciContract: {
      getStateRootOnIndexedSignUp: async () => proof.root,
    },
    maciAddress: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
    userMaciPublicKey: keypair.publicKey,
    userMaciPrivateKey: keypair.privateKey,
    pollId: 1n,
    stateTreeDepth: 10n,
    stateIndex: 1n,
    inclusionProof: tampered,
    pinnedStateRootIndex: 1,
    subgraphUrl: "http://127.0.0.1/graph/query",
    signer: {},
    prepareFromSubgraph: async () => {
      throw new Error("subgraph down");
    },
    prepareFromEvents: async () => ({
      inputs: { source: "rpc" },
      inclusionProof: proof,
      stateRootIndex: 1,
      leafIndex: 1,
    }),
  });

  assert.equal(resolved.source, "rpc");
  assert.equal(resolved.stateRootIndex, 1);
});

test("a valid service proof is submitted once and does not call fallbacks", async () => {
  const keypair = new Keypair();
  const tree = treeFor(keypair);
  const proof = tree.generateProof(1);
  let subgraphCalls = 0;
  let rpcCalls = 0;

  const resolved = await resolvePinnedJoinInputs({
    maciContract: {
      getStateRootOnIndexedSignUp: async () => proof.root,
    },
    maciAddress: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
    userMaciPublicKey: keypair.publicKey,
    userMaciPrivateKey: keypair.privateKey,
    pollId: 1n,
    stateTreeDepth: 10n,
    stateIndex: 1n,
    inclusionProof: proof,
    pinnedStateRootIndex: 1,
    subgraphUrl: "http://127.0.0.1/graph/query",
    signer: {},
    prepareFromSubgraph: async () => {
      subgraphCalls += 1;
      throw new Error("unused");
    },
    prepareFromEvents: async () => {
      rpcCalls += 1;
      throw new Error("unused");
    },
  });

  assert.equal(resolved.source, "service");
  assert.equal(resolved.stateRootIndex, 1);
  assert.equal(subgraphCalls, 0);
  assert.equal(rpcCalls, 0);
  assert.ok(tree.verifyProof(proof));
});
