import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("browser joinPoll submits the resolved pinned index once", () => {
  const src = readFileSync(new URL("../../../packages/sdk/ts/browser/joinPoll.ts", import.meta.url), "utf8");
  assert.equal(/totalSignups\s*\(/.test(src), false);
  assert.equal(src.includes("useLatestStateIndex"), false);
  assert.match(src, /resolvePinnedJoinInputs/);
  assert.match(src, /submit once/);
});

test("each join source validates inside resolvePinnedJoinInputs before the next fallback", () => {
  const src = readFileSync(new URL("../../../packages/sdk/ts/user/joinWitness.ts", import.meta.url), "utf8");
  assert.match(src, /source: "service"/);
  assert.match(src, /source: "subgraph"/);
  assert.match(src, /source: "rpc"/);
  assert.match(src, /Invalid or incomplete service proof/);
});
