import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function loadModule(relative) {
  const source = await readFile(new URL(relative, import.meta.url), "utf8");
  let javascript;
  try {
    const ts = await import("typescript");
    javascript = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    }).outputText;
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    const { stripTypeScriptTypes } = await import("node:module");
    if (!stripTypeScriptTypes) throw new Error("Install workspace dependencies to run this test on Node 20.");
    javascript = stripTypeScriptTypes(source);
  }
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

const { selectWalletKind, WalletAdapterNotApprovedError, SponsorshipUnavailableError } = await loadModule(
  "../src/lib/wallet/adapter.ts",
);
const { classifyAccountCode, EIP7702_DELEGATION_PREFIX } = await loadModule("../src/lib/wallet/delegation.ts");
const { decodeProbedLog } = await loadModule("../src/lib/sponsored/probe.ts");

test("injected is the only approved wallet source until E1–E6 pass", () => {
  assert.equal(selectWalletKind("injected"), "injected");
  assert.equal(selectWalletKind(""), "injected");
  assert.equal(selectWalletKind(undefined), "injected");
  assert.throws(() => selectWalletKind("privy"), WalletAdapterNotApprovedError);
  assert.throws(() => selectWalletKind("dynamic"), WalletAdapterNotApprovedError);
});

test("EIP-7702 code is delegated until cleared, not an empty EOA and not a generic contract", () => {
  const implementation = "0x" + "12".repeat(20);
  const code = EIP7702_DELEGATION_PREFIX + implementation.slice(2);
  const delegated = classifyAccountCode(code);
  assert.equal(delegated.kind, "eip-7702-delegated");
  assert.equal(delegated.implementation, implementation);
  assert.equal(classifyAccountCode("0x").kind, "empty-eoa");
  assert.equal(classifyAccountCode("0x60806040").kind, "contract");
});

test("a Probed log reports contract caller separately from tx.origin", () => {
  const caller = "0x" + "cc".repeat(20);
  const origin = "0x" + "aa".repeat(20);
  const observation = decodeProbedLog({
    topics: [
      "0x" + "11".repeat(32),
      "0x" + caller.slice(2).padStart(64, "0"),
      "0x" + origin.slice(2).padStart(64, "0"),
    ],
    data: "0x" + (1000n).toString(16).padStart(64, "0"),
  });
  assert.equal(observation.caller.toLowerCase(), caller.toLowerCase());
  assert.equal(observation.origin.toLowerCase(), origin.toLowerCase());
  assert.equal(observation.gasPrice, 1000n);
});

test("sponsorship-unavailable is a distinct, recoverable error class", () => {
  const error = new SponsorshipUnavailableError("no credits");
  assert.equal(error.code, "sponsorship-unavailable");
  assert.equal(error.name, "SponsorshipUnavailableError");
});
