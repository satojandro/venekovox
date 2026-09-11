import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = ts.transpileModule(readFileSync(new URL("../src/lib/inclusionProof.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { fetchJoinWitness, fetchJoinedParticipants } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

test("proof-service timeout or error returns null instead of throwing", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("AbortError");
  };
  try {
    const witness = await fetchJoinWitness({
      backendUrl: "http://localhost:3100",
      maci: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
      publicKeyX: "1",
      publicKeyY: "2",
      timeoutMs: 20,
    });
    assert.equal(witness, null);
  } finally {
    globalThis.fetch = original;
  }
});

test("joined-participants payload is not treated as votes", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      joinedParticipants: "4",
      indexedBlock: 12,
      indexedBlockHash: "0xabc",
      hasIndexingError: false,
      meaning: "joined_participants",
    }),
  });
  try {
    const stats = await fetchJoinedParticipants({ backendUrl: "http://localhost:3100", pollAddress: "0xpoll" });
    assert.equal(stats.joinedParticipants, "4");
    assert.equal(stats.indexedBlock, 12);
  } finally {
    globalThis.fetch = original;
  }
});
