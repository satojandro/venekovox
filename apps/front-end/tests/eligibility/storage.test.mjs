import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function loadTs(relative) {
  const source = await readFile(new URL(relative, import.meta.url), "utf8");
  const ts = await import("typescript");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

function memoryStorage() {
  const data = {};
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const { saveEligibility, loadEligibility, loadEligibilityForAccount, clearEligibility } = await loadTs(
  "../../src/eligibility/storage.ts",
);

test("eligibility storage keeps evidence and refuses proofs", () => {
  const storage = memoryStorage();
  const record = {
    venue: "zkpassport",
    account: "0xabc",
    evidence: "0xdead",
    signature: "0xsig",
    issuedAt: 1,
    expiresAt: 9999999999,
  };
  saveEligibility(record, storage);
  assert.deepEqual(loadEligibility(storage), record);
  assert.equal(loadEligibilityForAccount("0xAbC", 2, storage).evidence, "0xdead");
  assert.throws(() => loadEligibilityForAccount("0xdef", 2, storage), /different account/);
  clearEligibility(storage);
  assert.equal(loadEligibility(storage), null);
});

test("eligibility storage rejects a payload that contains proofs", () => {
  const storage = memoryStorage();
  assert.throws(
    () =>
      saveEligibility(
        {
          venue: "zkpassport",
          account: "0xabc",
          evidence: "0xdead",
          signature: "0xsig",
          issuedAt: 1,
          expiresAt: 2,
          proofs: [{ nope: true }],
        },
        storage,
      ),
    /MUST_NOT_STORE_PROOFS/,
  );
});

test("Auth.tsx no longer uses the fake Self flag or Self QR", async () => {
  const auth = await readFile(new URL("../../src/pages/Auth.tsx", import.meta.url), "utf8");
  const request = await readFile(new URL("../../src/eligibility/request.ts", import.meta.url), "utf8");
  assert.equal(auth.includes("venekovox_verified"), false);
  assert.equal(auth.includes("@selfxyz/qrcode"), false);
  assert.match(auth, /ZKPassport/);
  assert.match(request, /handleResult/);
});
