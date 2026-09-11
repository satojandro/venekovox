import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

/**
 * Load the real browser joinPoll, but replace contract factories and the
 * snarkjs prover. That is the production orchestration: read → pin → prove →
 * submit once → confirm (or reconcile). A fake poll.joinPoll after the resolver
 * cannot prove this path.
 */
const require = createRequire(import.meta.url);
const sdkRequire = createRequire(new URL("../../../packages/sdk/package.json", import.meta.url));
const ts = require("typescript");
const loaded = new Map();

const harness = {
  maci: null,
  poll: null,
  proofCalls: 0,
};

const intercepts = new Map([
  [
    "@maci-protocol/contracts/typechain-types",
    {
      MACI__factory: { connect: () => harness.maci },
      Poll__factory: { connect: () => harness.poll },
    },
  ],
]);

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
    if (intercepts.has(id)) return intercepts.get(id);
    if (id.startsWith(".")) {
      let candidate = join(dirname(abs), id);
      if (!candidate.endsWith(".ts") && existsSync(`${candidate}.ts`)) candidate = `${candidate}.ts`;
      const normalized = candidate.replaceAll("\\", "/");
      if (normalized.endsWith("/browser/utils.ts")) {
        return {
          generateProofSnarkjs: async () => {
            harness.proofCalls += 1;
            return {
              proof: {
                pi_a: ["1", "2"],
                pi_b: [
                  ["3", "4"],
                  ["5", "6"],
                ],
                pi_c: ["7", "8"],
              },
            };
          },
          formatProofForVerifierContract: () => ["1", "2", "3", "4", "5", "6", "7", "8"],
        };
      }
      if (normalized.endsWith("/utils/contracts.ts")) {
        return { contractExists: async () => true };
      }
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
const { joinPoll } = loadTs(new URL("../../../packages/sdk/ts/browser/joinPoll.ts", import.meta.url));

const MACI = "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a";
const POLL = "0x00000000000000000000000000000000000000b1";

function treeWith(keys) {
  const tree = new LeanIMT(crypto.hashLeanIMT);
  tree.insert(crypto.PAD_KEY_HASH);
  for (const key of keys) tree.insert(key.publicKey.hash());
  return tree;
}

function installContracts({ pinTree, laterTree, wait }) {
  const pin = pinTree.size - 1;
  const pinRoot = pinTree.root;
  const laterIndex = laterTree ? laterTree.size - 1 : pin;
  const laterRoot = laterTree ? laterTree.root : pinRoot;
  let joined = false;
  const submits = [];
  harness.proofCalls = 0;
  harness.maci = {
    getPoll: async () => ({ poll: POLL }),
    getStateIndex: async () => 1n,
    stateTreeDepth: async () => 10n,
    getStateRootOnIndexedSignUp: async (index) => {
      const n = Number(index);
      if (n === pin) return pinRoot;
      if (n === laterIndex) return laterRoot;
      return 0n;
    },
    totalSignups: async () => {
      throw new Error("joinPoll must not read totalSignups after the proof is prepared");
    },
  };
  harness.poll = {
    pollNullifiers: async () => joined,
    joinPoll: async (_nullifier, _pubKey, stateRootIndex) => {
      submits.push(Number(stateRootIndex));
      joined = true;
      return {
        hash: "0xjoin",
        wait:
          wait ||
          (async () => ({
            status: 1,
            hash: "0xjoin",
            blockNumber: 50,
          })),
      };
    },
    filters: { PollJoined: {} },
    queryFilter: async () => [{ args: { _pollStateIndex: 1n, _voiceCreditBalance: 99n } }],
  };
  return { submits, pin };
}

function joinArgs(keypair, proof, pin) {
  return {
    maciAddress: MACI,
    privateKey: keypair.privateKey.serialize(),
    pollId: 1n,
    signer: { provider: {} },
    pollJoiningZkey: "unused.zkey",
    pollWasm: "unused.wasm",
    sgDataArg: "0x",
    ivcpDataArg: "0x",
    inclusionProof: proof,
    stateRootIndex: pin,
  };
}

test("browser joinPoll submits once with the pinned index", async () => {
  const keypair = new Keypair();
  const tree = treeWith([keypair]);
  const proof = tree.generateProof(1);
  const { submits, pin } = installContracts({ pinTree: tree });

  const result = await joinPoll(joinArgs(keypair, proof, pin));

  assert.deepEqual(submits, [1]);
  assert.equal(harness.proofCalls, 1);
  assert.equal(result.hash, "0xjoin");
  assert.equal(result.pollStateIndex, "1");
});

test("confirmation failure reconciles membership and does not submit again", async () => {
  const keypair = new Keypair();
  const tree = treeWith([keypair]);
  const proof = tree.generateProof(1);
  const { submits, pin } = installContracts({
    pinTree: tree,
    wait: async () => {
      throw new Error("RPC timeout waiting for receipt");
    },
  });

  await assert.rejects(
    () => joinPoll(joinArgs(keypair, proof, pin)),
    /submitted \(0xjoin\) but confirmation failed; membership appears on-chain/,
  );
  assert.deepEqual(submits, [1]);
  assert.equal(harness.proofCalls, 1);
});

test("a signup during preparation still submits the historical pin, not a newer index", async () => {
  const voter = new Keypair();
  const later = new Keypair();
  const pinTree = treeWith([voter]);
  const laterTree = treeWith([voter, later]);
  const proof = pinTree.generateProof(1);
  assert.notEqual(pinTree.root, laterTree.root);

  const { submits, pin } = installContracts({ pinTree, laterTree });
  assert.equal(pin, 1);

  const result = await joinPoll(joinArgs(voter, proof, pin));

  assert.deepEqual(submits, [1]);
  assert.notEqual(submits[0], laterTree.size - 1);
  assert.equal(result.hash, "0xjoin");
});
