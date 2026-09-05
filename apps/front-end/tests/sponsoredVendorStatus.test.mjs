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

const { mapPrivyStatus, mapPrivyTransaction, mapPrivyWebhook, isSponsorshipDeniedStatus } = await loadModule(
  "../src/lib/sponsored/vendorStatus.ts",
);

test("broadcast returns identifiers, not a mined hash", () => {
  const view = mapPrivyTransaction({
    transaction_id: "tx-xyz789",
    status: "pending",
    user_operation_hash: "0x" + "ab".repeat(32),
    transaction_hash: "",
  });
  assert.equal(view.transactionId, "tx-xyz789");
  assert.equal(view.phase, "pending");
  assert.equal(view.transactionHash, null);
});

test("execution_reverted is a user-op failure, not bundle success", () => {
  assert.equal(mapPrivyStatus("execution_reverted"), "reverted");
  const view = mapPrivyWebhook({
    type: "transaction.execution_reverted",
    data: {
      transaction_id: "tx-xyz789",
      transaction_hash: "0x" + "cd".repeat(32),
      user_operation_hash: "0x" + "ab".repeat(32),
    },
  });
  assert.equal(view.phase, "reverted");
  assert.equal(view.transactionHash, "0x" + "cd".repeat(32));
});

test("confirmed webhook carries the outer hash without implying inner success by itself", () => {
  const view = mapPrivyWebhook({
    type: "transaction.confirmed",
    data: { transaction_id: "tx-1", transaction_hash: "0x" + "11".repeat(32) },
  });
  assert.equal(view.phase, "confirmed");
});

test("HTTP 402/403 map to sponsorship denied, not a prompt to pay ETH", () => {
  assert.equal(isSponsorshipDeniedStatus(402), true);
  assert.equal(isSponsorshipDeniedStatus(403), true);
  assert.equal(isSponsorshipDeniedStatus(500), false);
});
