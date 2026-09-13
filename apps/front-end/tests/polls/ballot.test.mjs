import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = ts.transpileModule(readFileSync(new URL("../../src/polls/ballot.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { ballotIndex, canSubmitBallot, assertBallotIndex } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);

const options = [
  { index: 0, label: { en: "Support", es: "A favor" } },
  { index: 1, label: { en: "Oppose", es: "En contra" } },
  { index: 2, label: { en: "Unsure", es: "No estoy seguro/a" } },
];

test("submits the option's stored index, not its display position", () => {
  const shuffled = [options[2], options[0], options[1]];
  assert.equal(ballotIndex(shuffled, 2), 2);
  assert.equal(assertBallotIndex({ options: shuffled }, 1), 1);
  assert.equal(ballotIndex(shuffled, 9), null);
});

test("requires an explicit selection before submit", () => {
  assert.equal(canSubmitBallot({ options, selected: null, locked: false, busy: false }), false);
  assert.equal(canSubmitBallot({ options, selected: 1, locked: false, busy: false }), true);
  assert.equal(canSubmitBallot({ options, selected: 1, locked: true, busy: false }), false);
  assert.equal(canSubmitBallot({ options, selected: 1, locked: false, busy: true }), false);
});
