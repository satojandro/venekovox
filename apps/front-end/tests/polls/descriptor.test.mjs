import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../../src/polls/descriptor.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { readConfiguredDescriptor } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

test("rejects missing or malformed deployment env", () => {
  assert.equal(readConfiguredDescriptor({}), null);
  assert.equal(
    readConfiguredDescriptor({
      VITE_CHAIN_ID: "11155111",
      VITE_MACI_ADDRESS: "not-an-address",
      VITE_POLL_ID: "0",
    }),
    null,
  );
});

test("poll 1 — France presidential election (6 options)", () => {
  const descriptor = readConfiguredDescriptor({
    VITE_CHAIN_ID: "11155111",
    VITE_MACI_ADDRESS: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
    VITE_POLL_ID: "1",
  });
  assert.equal(descriptor.schemaVersion, 1);
  assert.equal(descriptor.metadataSource, "operator");
  assert.equal(descriptor.pollId, "1");
  assert.equal(descriptor.options.length, 6);
  assert.equal(descriptor.options[0].index, 0);
  assert.equal(descriptor.options[5].label.en, "Other / None of these");
  assert.match(descriptor.question.en, /French presidential election/);
  assert.match(descriptor.question.en, /Poll 1/);
});

test("poll 3 — flagship superintelligence question (3 options)", () => {
  const descriptor = readConfiguredDescriptor({
    VITE_CHAIN_ID: "11155111",
    VITE_MACI_ADDRESS: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
    VITE_POLL_ID: "3",
  });
  assert.equal(descriptor.pollId, "3");
  assert.equal(descriptor.options.length, 3);
  assert.match(descriptor.question.en, /superintelligence/);
  assert.match(descriptor.question.es, /superinteligencia/);
  assert.equal(descriptor.options[0].label.en, "Yes, pause it");
  assert.equal(descriptor.options[1].label.en, "No, keep going");
  assert.equal(descriptor.options[2].label.en, "Unsure");
});

test("unknown poll ID uses fallback metadata", () => {
  const descriptor = readConfiguredDescriptor({
    VITE_CHAIN_ID: "11155111",
    VITE_MACI_ADDRESS: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
    VITE_POLL_ID: "99",
  });
  assert.equal(descriptor.pollId, "99");
  assert.match(descriptor.question.en, /open on Sepolia/);
});
