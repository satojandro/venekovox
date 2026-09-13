import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const manifest = ts.transpileModule(readFileSync(new URL("../../src/polls/manifest.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const manifestUrl = "data:text/javascript;base64," + Buffer.from(manifest).toString("base64");
const source = ts.transpileModule(readFileSync(new URL("../../src/polls/descriptor.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText.replaceAll('from "./manifest"', `from "${manifestUrl}"`);
const { readConfiguredDescriptor } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const { FLAGSHIP_NATIONALITIES } = await import(manifestUrl);

const franceEnv = {
  VITE_CHAIN_ID: "11155111",
  VITE_MACI_ADDRESS: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
  VITE_POLL_ID: "1",
};

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

test("returns an operator descriptor bound to the configured poll", () => {
  const descriptor = readConfiguredDescriptor(franceEnv);
  assert.equal(descriptor.schemaVersion, 1);
  assert.equal(descriptor.metadataSource, "operator");
  assert.equal(descriptor.pollId, "1");
  assert.equal(descriptor.expectedVoteOptions, 6);
  assert.equal(descriptor.expectedMode, 2);
  assert.equal(descriptor.options.length, 6);
  assert.equal(descriptor.options[0].index, 0);
  assert.equal(descriptor.options[5].label.en, "Other / None of these");
  assert.match(descriptor.question.en, /French presidential election/);
  assert.match(descriptor.question.en, /Poll 1/);
  assert.match(descriptor.description.en, /18\+/);
  assert.match(descriptor.description.en, /Australian/);
});

test("does not apply the flagship preset to original polls 0 or 1", () => {
  assert.equal(readConfiguredDescriptor({ ...franceEnv, VITE_POLL_PRESET: "superintelligence-v1" }), null);
  assert.equal(
    readConfiguredDescriptor({ ...franceEnv, VITE_POLL_ID: "0", VITE_POLL_PRESET: "superintelligence-v1" }),
    null,
  );
});

test("rejects an unknown poll preset instead of labeling the deployment", () => {
  assert.equal(readConfiguredDescriptor({ ...franceEnv, VITE_POLL_PRESET: "mystery-v9" }), null);
});

test("binds flagship metadata only to a non-protected configured poll", () => {
  const descriptor = readConfiguredDescriptor({
    ...franceEnv,
    VITE_POLL_ID: "2",
    VITE_POLL_PRESET: "superintelligence-v1",
    VITE_POLL_ADDRESS: "0x3333333333333333333333333333333333333333",
  });
  assert.equal(descriptor.preset, "superintelligence-v1");
  assert.equal(descriptor.expectedVoteOptions, 3);
  assert.equal(descriptor.expectedMode, 2);
  assert.equal(descriptor.options.length, 3);
  assert.equal(descriptor.options[0].index, 0);
  assert.equal(descriptor.options[1].index, 1);
  assert.equal(descriptor.options[2].index, 2);
  assert.equal(descriptor.options[0].label.en, "Support");
  assert.equal(descriptor.expectedPollAddress, "0x3333333333333333333333333333333333333333");
  assert.match(descriptor.question.en, /artificial superintelligence/);
  assert.equal(FLAGSHIP_NATIONALITIES.length, 30);
  assert.equal(FLAGSHIP_NATIONALITIES.includes("Czech Republic"), true);
  assert.equal(FLAGSHIP_NATIONALITIES.includes("Czechia"), false);
  assert.equal(FLAGSHIP_NATIONALITIES.includes("United Kingdom"), false);
});


test("main poll 3 keeps its pause question, options and chain guards even with an older preset", () => {
  for (const preset of [undefined, "superintelligence-v1"]) {
    const d = readConfiguredDescriptor({ ...franceEnv, VITE_POLL_ID: "3", VITE_POLL_PRESET: preset });
    assert.equal(d.question.en, "Should development of superintelligence be paused?");
    assert.deepEqual(d.options.map(o => o.label.en), ["Yes, pause it", "No, keep going", "Unsure"]);
    assert.equal(d.expectedVoteOptions, 3);
    assert.equal(d.expectedMode, 2);
    assert.equal(d.preset, undefined);
    assert.doesNotMatch(d.description.en, /no one can see/);
  }
});

test("unknown poll does not inherit France choices or claim an open window", () => {
  const d = readConfiguredDescriptor({ ...franceEnv, VITE_POLL_ID: "99" });
  assert.equal(d.options.length, 0);
  assert.equal(d.expectedVoteOptions, 0);
  assert.equal(d.question.en, "Poll 99");
});
