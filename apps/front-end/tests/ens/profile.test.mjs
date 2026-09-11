import { test } from "node:test";
import assert from "node:assert/strict";
import { labels, profile } from "./load.mjs";

test("label rules match the 3–32 ASCII / ENSIP-15 hyphen contract", () => {
  assert.equal(labels.normalizeLabel("Ada"), "ada");
  for (const bad of ["ab", "xn--abc", "-ada", "ada-", "ADA!", "a".repeat(33)]) {
    assert.throws(() => labels.normalizeLabel(bad), /INVALID_LABEL/);
  }
});

test("forbidden ENS keys cannot be written by this app", () => {
  assert.throws(() => labels.assertSafeTextKey("xyz.venekovox.status"), /FORBIDDEN_RECORD/);
  assert.throws(() => labels.assertSafeTextKey("xyz.venekovox.nullifier"), /FORBIDDEN_RECORD/);
  labels.assertSafeTextKey("xyz.venekovox.profile-theme");
});

test("none / incomplete / ready follow on-chain facts, not receipts", () => {
  const account = "0x1111111111111111111111111111111111111111";
  const resolver = "0x2222222222222222222222222222222222222222";
  const none = profile.classifyProfileSetup({
    account,
    claimedName: "",
    predictedResolver: resolver,
    actualResolver: "0x0000000000000000000000000000000000000000",
    forwardAddr: "0x0000000000000000000000000000000000000000",
    theme: "",
    resolverCode: false,
  });
  assert.equal(none.phase, "none");
  assert.equal(none.nextOp, "deployResolver");

  const incomplete = profile.classifyProfileSetup({
    account,
    claimedName: "ada.people.venekovox.eth",
    predictedResolver: resolver,
    actualResolver: resolver,
    forwardAddr: "0x0000000000000000000000000000000000000000",
    theme: "",
    resolverCode: true,
  });
  assert.equal(incomplete.phase, "incomplete");
  assert.equal(incomplete.nextOp, "writeRecords");

  const ready = profile.classifyProfileSetup({
    account,
    claimedName: "ada.people.venekovox.eth",
    predictedResolver: resolver,
    actualResolver: resolver,
    forwardAddr: account,
    theme: "lime",
    resolverCode: true,
  });
  assert.equal(ready.phase, "ready");
  assert.equal(ready.nextOp, null);
});
