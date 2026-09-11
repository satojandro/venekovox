import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function load(rel) {
  const file = new URL(rel, import.meta.url);
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const sdkRequire = createRequire(file);
  const fn = new Function("require", "module", "exports", source);
  fn(sdkRequire, module, module.exports);
  return module.exports;
}

const { MaciSubgraph, assertContiguousSignupIndexes } = load("../../../packages/sdk/ts/subgraph/maciSubgraph.ts");

test("MaciSubgraph paginates StateLeaves by stateIndex at one pinned block", async () => {
  const pages = {
    0: [
      { id: "0x01", stateIndex: "1", publicKeyX: "11", publicKeyY: "12" },
      { id: "0x02", stateIndex: "2", publicKeyX: "21", publicKeyY: "22" },
    ],
  };
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.variables.block, 99);
    const cursor = BigInt(body.variables.cursor);
    const page = pages[Number(cursor)] ?? [];
    return {
      ok: true,
      json: async () => ({
        data: {
          _meta: { block: { number: 99, hash: "0xabc" }, hasIndexingErrors: false },
          stateLeaves: page,
        },
      }),
    };
  };
  try {
    const subgraph = new MaciSubgraph("http://proxy.example/graph/query", 1000, 500);
    const { leaves, meta } = await subgraph.getStateLeaves("0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a", 99);
    assert.equal(leaves.length, 2);
    assert.equal(meta.block.number, 99);
    assertContiguousSignupIndexes(leaves);
  } finally {
    globalThis.fetch = original;
  }
});

test("MaciSubgraph rejects indexer errors and does not hang past timeout", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (!body.variables) {
      return {
        ok: true,
        json: async () => ({
          data: { _meta: { block: { number: 1, hash: "0x1" }, hasIndexingErrors: true } },
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        data: {
          _meta: { block: { number: 1, hash: "0x1" }, hasIndexingErrors: true },
          stateLeaves: [],
        },
      }),
    };
  };
  try {
    const subgraph = new MaciSubgraph("http://proxy.example/graph/query", 1000, 200);
    await assert.rejects(
      () => subgraph.getStateLeaves("0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a"),
      /hasIndexingErrors/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
