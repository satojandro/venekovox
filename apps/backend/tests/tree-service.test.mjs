import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
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

const service = loadTs(new URL("../src/trees/service.ts", import.meta.url));
const lean = loadTs(new URL("../src/trees/leanTree.ts", import.meta.url));
const snapshot = loadTs(new URL("../src/trees/snapshot.ts", import.meta.url));

const MACI = "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a";
const env = {
  GRAPH_URL: "http://graph.example/query",
  MACI_ADDRESS: MACI,
  PUBLIC_RPC_URL: "http://rpc.example",
  GRAPH_TIMEOUT_MS: "50",
};

const leaves = [{ stateIndex: "1", publicKeyX: "11", publicKeyY: "12" }];

afterEach(() => {
  service.resetTreeService();
});

function expectedRoot() {
  return lean.buildSignUpTree(leaves).root;
}

test("click path serves a historically valid cache without waiting for a full rebuild", async () => {
  let leafPages = 0;
  service.setTreeTestHooks({
    fetchMeta: async () => ({ block: { number: 10, hash: "0xaaa" }, hasIndexingErrors: false }),
    fetchLeafPage: async () => {
      leafPages += 1;
      return { _meta: { block: { number: 10, hash: "0xaaa" }, hasIndexingErrors: false }, stateLeaves: leaves };
    },
    onChainRoot: async () => expectedRoot(),
  });

  const first = await service.getInclusionProof({
    maci: MACI,
    publicKeyX: "11",
    publicKeyY: "12",
    env,
  });
  assert.equal(first.leafIndex, 1);
  assert.equal(first.stateRootIndex, 1);
  const pagesAfterWarmup = leafPages;

  service.setTreeTestHooks({
    fetchMeta: async () => ({ block: { number: 11, hash: "0xbbb" }, hasIndexingErrors: false }),
    fetchLeafPage: async () => {
      leafPages += 1;
      await new Promise((resolve) => setTimeout(resolve, 400));
      return { _meta: { block: { number: 11, hash: "0xbbb" }, hasIndexingErrors: false }, stateLeaves: leaves };
    },
    onChainRoot: async () => expectedRoot(),
  });

  const started = Date.now();
  const second = await service.getInclusionProof({
    maci: MACI,
    publicKeyX: "11",
    publicKeyY: "12",
    env,
  });
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 200, `click waited ${elapsed}ms for a rebuild`);
  assert.equal(second.leafIndex, 1);
  assert.equal(second.stateRootIndex, 1);
  assert.equal(pagesAfterWarmup, 1);
});

test("a root-mismatched refresh does not keep an orphaned cache", async () => {
  service.setTreeTestHooks({
    fetchMeta: async () => ({ block: { number: 10, hash: "0xaaa" }, hasIndexingErrors: false }),
    fetchLeafPage: async () => ({
      _meta: { block: { number: 10, hash: "0xaaa" }, hasIndexingErrors: false },
      stateLeaves: leaves,
    }),
    onChainRoot: async () => expectedRoot(),
  });
  await service.getInclusionProof({ maci: MACI, publicKeyX: "11", publicKeyY: "12", env });

  service.setTreeTestHooks({
    fetchMeta: async () => ({ block: { number: 10, hash: "0xdead" }, hasIndexingErrors: false }),
    fetchLeafPage: async () => ({
      _meta: { block: { number: 10, hash: "0xdead" }, hasIndexingErrors: false },
      stateLeaves: [{ stateIndex: "1", publicKeyX: "99", publicKeyY: "99" }],
    }),
    onChainRoot: async () => 0n,
  });

  await assert.rejects(
    () => service.getInclusionProof({ maci: MACI, publicKeyX: "11", publicKeyY: "12", env }),
    /does not match|unavailable|ROOT_MISMATCH/i,
  );
});

test("appendSignupLeaves clones then insertMany; the published tree is unchanged", async () => {
  const extra = [{ stateIndex: "2", publicKeyX: "21", publicKeyY: "22" }];
  const original = lean.buildSignUpTree(leaves);
  const originalSize = original.size;
  const originalRoot = original.root;
  const originalProof = original.generateProof(1);

  const next = await lean.appendSignupLeaves(original, extra, 1);
  const rebuilt = lean.buildSignUpTree(leaves.concat(extra));

  assert.equal(original.size, originalSize);
  assert.equal(original.root, originalRoot);
  assert.ok(original.verifyProof(originalProof));
  assert.equal(next.size, originalSize + 1);
  assert.equal(next.root, rebuilt.root);
  assert.notEqual(next.root, original.root);
});

test("incremental refresh inserts only new leaves and publishes after the root check", async () => {
  const extra = [{ stateIndex: "2", publicKeyX: "21", publicKeyY: "22" }];
  const all = leaves.concat(extra);
  const root1 = lean.buildSignUpTree(leaves).root;
  const root2 = lean.buildSignUpTree(all).root;
  const pages = [];

  service.setTreeTestHooks({
    fetchMeta: async () => ({ block: { number: 10, hash: "0xaaa" }, hasIndexingErrors: false }),
    fetchLeafPage: async (_url, _timeout, args) => {
      pages.push({ cursor: String(args.cursor), first: args.first, block: args.block });
      return { _meta: { block: { number: 10, hash: "0xaaa" }, hasIndexingErrors: false }, stateLeaves: leaves };
    },
    onChainRoot: async (_rpc, _maci, index) => (Number(index) === 1 ? root1 : 0n),
  });
  await service.getInclusionProof({ maci: MACI, publicKeyX: "11", publicKeyY: "12", env });
  pages.length = 0;

  service.setTreeTestHooks({
    fetchMeta: async () => ({ block: { number: 11, hash: "0xbbb" }, hasIndexingErrors: false }),
    fetchLeafPage: async (_url, _timeout, args) => {
      pages.push({ cursor: String(args.cursor), first: args.first, block: args.block });
      const meta = { block: { number: 11, hash: "0xbbb" }, hasIndexingErrors: false };
      if (args.first === 1) return { _meta: meta, stateLeaves: leaves };
      return { _meta: meta, stateLeaves: extra };
    },
    onChainRoot: async (_rpc, _maci, index) => {
      if (Number(index) === 2) return root2;
      if (Number(index) === 1) return root1;
      return 0n;
    },
  });

  await service.refreshSnapshot(env);
  const proof = await service.getInclusionProof({ maci: MACI, publicKeyX: "11", publicKeyY: "12", env });
  assert.equal(proof.stateRootIndex, 2);
  assert.equal(proof.leafIndex, 1);
  assert.equal(
    pages.some((page) => page.cursor === "0" && page.first === 1000),
    false,
    "incremental append must not download every leaf again",
  );
  assert.ok(pages.some((page) => page.cursor === "1" && page.first === 1000));
});

test("canAppendLeaves rejects a replaced same-size set mixed as an append", () => {
  assert.equal(snapshot.canAppendLeaves(leaves, [{ stateIndex: "1", publicKeyX: "99", publicKeyY: "99" }]), false);
  assert.equal(snapshot.canAppendLeaves(leaves, [{ stateIndex: "2", publicKeyX: "21", publicKeyY: "22" }]), true);
  assert.equal(snapshot.historicalRootMatches(1n, 1n), true);
  assert.equal(snapshot.historicalRootMatches(1n, 2n), false);
});
