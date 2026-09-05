import assert from "node:assert/strict";
import { test } from "node:test";
import { importTs } from "./loadTs.mjs";

const { classifyAccountCode, EIP7702_DELEGATION_PREFIX } = await importTs(
  "../src/lib/wallet/delegation.ts",
  import.meta.url,
);
const { selectWalletKind, WalletAdapterNotApprovedError, SponsorshipUnavailableError } = await importTs(
  "../src/lib/wallet/adapter.ts",
  import.meta.url,
);
const { createPrivyAdapter } = await importTs("../src/lib/wallet/privy.ts", import.meta.url);
const { decodeProbedLog, summarizeProbeReceipt } = await importTs("../src/lib/sponsored/probe.ts", import.meta.url);
const { architectureMayBeApproved, parseEvidenceLog, emptyNotes } = await importTs(
  "../src/lib/w1/protocol.ts",
  import.meta.url,
);

test("EIP-7702 code is classified as persistent delegation, not an empty EOA", () => {
  const implementation = "0x" + "aa".repeat(20);
  const code = EIP7702_DELEGATION_PREFIX + implementation.slice(2);
  const result = classifyAccountCode(code);
  assert.equal(result.kind, "eip-7702-delegated");
  assert.equal(result.implementation.toLowerCase(), implementation);
  assert.equal(classifyAccountCode("0x").kind, "empty-eoa");
  assert.equal(classifyAccountCode("0x60806040").kind, "contract");
});

test("only the injected wallet kind is selectable until W1 evidence exists", () => {
  assert.equal(selectWalletKind(undefined), "injected");
  assert.equal(selectWalletKind("injected"), "injected");
  assert.throws(() => selectWalletKind("privy"), WalletAdapterNotApprovedError);
  assert.throws(() => createPrivyAdapter(), WalletAdapterNotApprovedError);
});

test("SponsorshipUnavailableError is a distinct, recoverable failure", () => {
  const error = new SponsorshipUnavailableError("no credits");
  assert.equal(error.code, "sponsorship-unavailable");
});

test("CallerProbe Probed logs decode caller vs origin without ethers", () => {
  const caller = "0x" + "a1".repeat(20);
  const origin = "0x" + "b2".repeat(20);
  const observation = decodeProbedLog({
    topics: ["0x" + "dd".repeat(32), "0x" + caller.slice(2).padStart(64, "0"), "0x" + origin.slice(2).padStart(64, "0")],
    data: "0x" + (123n).toString(16).padStart(64, "0") + "00".repeat(64),
  });
  assert.equal(observation.caller.toLowerCase(), caller);
  assert.equal(observation.origin.toLowerCase(), origin);
  assert.equal(observation.gasPrice, 123n);
});

test("diagnostic summary flags when the outer sender is not the contract caller", () => {
  const probe = "0x" + "33".repeat(20);
  const caller = "0x" + "a1".repeat(20);
  const bundler = "0x" + "bb".repeat(20);
  const summary = summarizeProbeReceipt({
    probeAddress: probe,
    receipt: {
      status: 1,
      from: bundler,
      to: probe,
      logs: [
        {
          address: probe,
          topics: ["0x" + "dd".repeat(32), "0x" + caller.slice(2).padStart(64, "0"), "0x" + bundler.slice(2).padStart(64, "0")],
          data: "0x" + "00".repeat(64),
        },
      ],
    },
  });
  assert.equal(summary.outerSenderDiffersFromCaller, true);
  assert.equal(summary.echoedCaller.toLowerCase(), caller);
  assert.equal(summary.outerFrom.toLowerCase(), bundler);
});

test("architecture stays unapproved until every E-row is marked pass", () => {
  const notes = emptyNotes();
  assert.equal(architectureMayBeApproved(notes), false);
  const parsed = parseEvidenceLog(JSON.stringify({ E1: { verdict: "pass", evidence: "screenshot", updatedAt: 1 } }));
  assert.equal(parsed.E1.verdict, "pass");
  assert.equal(parsed.E2.verdict, "not-run");
  assert.equal(architectureMayBeApproved(parsed), false);
});
