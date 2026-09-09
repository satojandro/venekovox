import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../../src/eligibility/dryRunJoin.ts", import.meta.url), "utf8");
const ts = await import("typescript");
let javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const ethersHref = new URL("file://" + require.resolve("ethers")).href;
javascript = javascript.replaceAll(`from "ethers"`, `from "${ethersHref}"`);
const { dryRunJoinGate } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

const maci = "0x1111111111111111111111111111111111111111";
const poll = "0x2222222222222222222222222222222222222222";
const policy = "0x3333333333333333333333333333333333333333";
const ethers = require("ethers");
const maciAbi = new ethers.Interface([
  "function getPoll(uint256) view returns (address poll, address messageProcessor, address tally)",
]);
const pollAbi = new ethers.Interface([
  "function extContracts() view returns (address maci, address verifier, address verifyingKeysRegistry, address policy, address initialVoiceCreditProxy)",
]);
const policyAbi = new ethers.Interface(["function enforce(address subject, bytes evidence)"]);

function provider(overrides = {}) {
  return {
    async call(tx) {
      if (overrides.call) return overrides.call(tx);
      if (tx.data.startsWith(maciAbi.getFunction("getPoll").selector)) {
        return maciAbi.encodeFunctionResult("getPoll", [poll, maci, maci]);
      }
      if (tx.data.startsWith(pollAbi.getFunction("extContracts").selector)) {
        return pollAbi.encodeFunctionResult("extContracts", [maci, maci, maci, policy, maci]);
      }
      if (tx.data.startsWith(policyAbi.getFunction("enforce").selector)) {
        if (tx.from.toLowerCase() !== poll.toLowerCase()) throw new Error("TargetOnly");
        return "0x";
      }
      throw new Error("unexpected call");
    },
  };
}

test("dry-run simulates Poll calling policy.enforce with join evidence", async () => {
  const result = await dryRunJoinGate({
    signer: { provider: provider() },
    maciAddress: maci,
    pollId: 0n,
    account: "0x4444444444444444444444444444444444444444",
    evidence: "0x1234",
    expectedPolicy: policy,
    expectedTarget: poll,
  });
  assert.equal(result.ok, true);
  assert.equal(result.policyAddress.toLowerCase(), policy.toLowerCase());
});

test("dry-run fails closed on empty evidence and policy mismatch", async () => {
  await assert.rejects(
    dryRunJoinGate({
      signer: { provider: provider() },
      maciAddress: maci,
      pollId: 0n,
      account: "0x4444444444444444444444444444444444444444",
      evidence: "0x",
    }),
    /empty gate evidence/,
  );
  await assert.rejects(
    dryRunJoinGate({
      signer: { provider: provider() },
      maciAddress: maci,
      pollId: 0n,
      account: "0x4444444444444444444444444444444444444444",
      evidence: "0x1234",
      expectedPolicy: "0x9999999999999999999999999999999999999999",
    }),
    /POLICY_ADDRESS/,
  );
});
