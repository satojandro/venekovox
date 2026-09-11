// Live local-indexer parity gate (WP4) — the missing evidence from docs/status.md.
// Proves the running local graph-node's indexed StateLeaf rows rebuild the SAME
// state root that the MACI contract pins, at the same Sepolia block.
//
// Three independent sources, one assertion:
//   1. INDEXED  — StateLeaf entities from the LOCAL graph-node (state-leaves query, block-pinned)
//   2. RPC      — SignUp events re-fetched from the RPC up to the same block
//   3. ON-CHAIN — getStateRootOnIndexedSignUp(stateRootIndex) at that block
//   PASS requires indexed rows == rpc rows AND indexed root == rpc root == on-chain root.
//
// Usage:  node tests/live-parity.mjs   (env: GRAPH_URL, RPC, BLOCK, MACI_ADDRESS optional)
// Run on Node 22 with the repo's pinned toolchain (>=22 <23 per repo engines).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ethers } = require("ethers");

const sdkRequire = createRequire(new URL("../../../packages/sdk/package.json", import.meta.url));
const ts = require("typescript");
const { LeanIMT } = sdkRequire("@zk-kit/lean-imt");
const crypto = sdkRequire("@maci-protocol/crypto");
const { padKey } = sdkRequire("@maci-protocol/domainobjs");
const { hashLeftRight, PAD_KEY_HASH } = crypto;

// Load the production backend tree builder (transpiled, same trick as tree-parity.test.mjs)
function load(rel) {
  const source = ts.transpileModule(readFileSync(new URL(rel, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const fn = new Function("require", "module", "exports", source);
  fn(require, module, module.exports);
  return module.exports;
}

const GRAPH_URL = process.env.GRAPH_URL || "http://localhost:18000/subgraphs/name/venekovox-governance-v-2";
const RPC = process.env.RPC || "https://ethereum-sepolia-rpc.publicnode.com";
const MACI = process.env.MACI_ADDRESS || "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a";
const START_BLOCK = 11567000; // matches config/network.json

const MACI_ABI = JSON.parse(
  readFileSync(
    new URL("../../../packages/contracts/build/artifacts/contracts/MACI.sol/MACI.json", import.meta.url),
    "utf8",
  ),
).abi;

async function graphQuery(url, query, variables) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error("graph query failed: " + JSON.stringify(json.errors || json.error));
  return json.data;
}

async function fetchIndexedLeaves(block) {
  // mirrors queries/state-leaves.graphql (block-pinned, ordered by stateIndex, cursor-paginated)
  const query = `
    query StateLeaves($maci: Bytes!, $first: Int!, $cursor: BigInt!, $block: Int!) {
      _meta { block { number hash } hasIndexingErrors }
      stateLeaves(first: $first, orderBy: stateIndex, orderDirection: asc,
                  where: { maci: $maci, stateIndex_gt: $cursor }, block: { number: $block }) {
        id stateIndex publicKeyX publicKeyY timestamp
      }
    }`;
  const leaves = [];
  let cursor = 0n;
  let meta = null;
  for (;;) {
    const data = await graphQuery(GRAPH_URL, query, { maci: MACI, first: 1000, cursor: cursor.toString(), block });
    meta = data._meta;
    const page = data.stateLeaves;
    if (page.length === 0) break;
    for (const row of page) leaves.push(row);
    if (page.length < 1000) break;
    cursor = BigInt(page[page.length - 1].stateIndex);
  }
  return { leaves, meta };
}

async function fetchRpcSignUps(block) {
  const provider = new ethers.JsonRpcProvider(RPC);
  const iface = new ethers.Interface(MACI_ABI);
  const topic = iface.getEvent("SignUp").topicHash;
  const CHUNK = 49000;
  const logs = [];
  for (let from = START_BLOCK; from <= block; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, block);
    let retry = 0;
    for (;;) {
      try {
        logs.push(...(await provider.getLogs({ address: MACI, topics: [topic], fromBlock: from, toBlock: to })));
        break;
      } catch (e) {
        retry += 1;
        if (retry > 6) throw e;
        await new Promise((r) => setTimeout(r, 1500 * retry));
      }
    }
  }
  return logs
    .map((l) => {
      const d = iface.parseLog({ topics: l.topics, data: l.data });
      return {
        id: l.transactionHash.concat(l.index.toString()),
        stateIndex: d.args[0].toString(),
        publicKeyX: d.args[2].toString(),
        publicKeyY: d.args[3].toString(),
        timestamp: d.args[1].toString(),
      };
    })
    .sort((a, b) => BigInt(a.stateIndex) - BigInt(b.stateIndex));
}

async function onChainRootAt(provider, block, stateRootIndex) {
  const maci = new ethers.Contract(MACI, MACI_ABI, provider);
  const root = await maci.getStateRootOnIndexedSignUp(stateRootIndex, { blockTag: block });
  return "0x" + BigInt(root).toString(16).padStart(64, "0");
}

test("live local-indexer parity: indexed StateLeaf rows rebuild the pinned on-chain state root", async () => {
  // 0. Choose the target block from _meta (the synced head), or BLOCK env.
  const headData = await graphQuery(GRAPH_URL, `{ _meta { block { number hash } hasIndexingErrors } }`, {});
  const block = process.env.BLOCK ? Number(process.env.BLOCK) : headData._meta.block.number;
  const headHash = headData._meta.block.hash;
  assert.equal(headData._meta.hasIndexingErrors, false, "indexer must be clean");

  // 1. Indexed rows from the LOCAL graph-node at this block.
  const { leaves: indexedLeaves, meta } = await fetchIndexedLeaves(block);
  assert.equal(meta.hasIndexingErrors, false, "no indexing errors at pinned block");
  const servedBlock = meta.block.number;
  // graph-node resolves a historical block:number from its recent block cache;
  // a block that has left the cache is served at current head and _meta reports
  // the served height. Parity must be asserted at the block that was actually
  // served — all three sources below share it.
  if (servedBlock !== block) {
    console.log(
      `note: graph-node served block ${servedBlock} for requested ${block} (historical cache); using served block`,
    );
  }

  // 2. Independent RPC rebuild of the same SignUp events up to the same block.
  const rpcLeaves = await fetchRpcSignUps(servedBlock);
  assert.equal(
    indexedLeaves.length,
    rpcLeaves.length,
    `row count mismatch: indexed=${indexedLeaves.length} rpc=${rpcLeaves.length}`,
  );
  for (let i = 0; i < indexedLeaves.length; i += 1) {
    assert.equal(indexedLeaves[i].stateIndex, rpcLeaves[i].stateIndex, `stateIndex row ${i}`);
    assert.equal(indexedLeaves[i].publicKeyX, rpcLeaves[i].publicKeyX, `publicKeyX row ${i}`);
    assert.equal(indexedLeaves[i].publicKeyY, rpcLeaves[i].publicKeyY, `publicKeyY row ${i}`);
  }

  // 3. Build both trees with the PRODUCTION builder (PAD at 0, hashLeftRight per leaf).
  const lean = load(new URL("../src/trees/leanTree.ts", import.meta.url)); // apps/backend tree builder used by /trees service
  const indexedTree = lean.buildSignUpTree(indexedLeaves);
  const rpcTree = lean.buildSignUpTree(rpcLeaves);
  assert.equal(indexedTree.root, rpcTree.root, "indexed root must equal independent RPC rebuild root");
  const stateRootIndex = lean.snapshotStateRootIndex(indexedTree); // = tree.size - 1

  // 4. On-chain pinned root at the SAME block.
  const provider = new ethers.JsonRpcProvider(RPC);
  const onChainRoot = await onChainRootAt(provider, servedBlock, stateRootIndex);
  assert.equal(
    "0x" + BigInt(indexedTree.root).toString(16).padStart(64, "0"),
    onChainRoot,
    `indexed root must equal getStateRootOnIndexedSignUp(${stateRootIndex}) at block ${servedBlock}`,
  );

  // Record the gate evidence for the PR.
  console.log("\n=== LOCAL INDEXER PARITY — PASS ===");
  console.log("node head           :", headData._meta.block.number, headHash);
  console.log("requested block     :", block);
  console.log("served block        :", servedBlock);
  console.log("served block hash   :", meta.block.hash);
  console.log("indexed leaves      :", indexedLeaves.length);
  console.log("rpc leaves          :", rpcLeaves.length);
  console.log("stateRootIndex      :", stateRootIndex);
  console.log("indexed tree root   :", "0x" + BigInt(indexedTree.root).toString(16).padStart(64, "0"));
  console.log("rpc rebuild root    :", "0x" + BigInt(rpcTree.root).toString(16).padStart(64, "0"));
  console.log("on-chain root       :", onChainRoot);
  console.log("PAD leaf            :", "0x" + BigInt(PAD_KEY_HASH).toString(16).padStart(64, "0"));
  console.log("padKey.hash()==PAD  :", padKey.hash() === BigInt(PAD_KEY_HASH));
  console.log("checks              : indexed==rpc rows, indexedRoot==rpcRoot==onChainRoot, hasIndexingErrors=false");
});
