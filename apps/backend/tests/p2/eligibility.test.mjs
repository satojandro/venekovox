import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(process.env.P2_TOOLCHAIN_PACKAGE_JSON || import.meta.url);
const { Wallet, verifyTypedData, keccak256, toUtf8Bytes, ZeroAddress } = require("ethers");
import { load } from "./load.mjs";
const { EligibilityService, AUTHORIZATION_TYPES, authorizationDomain } = await load(
  "../../src/eligibility/authorization.ts",
);
const { accountControlVerifier } = await load("../../src/eligibility/accountControl.ts");
const alice = Wallet.createRandom(),
  bob = Wallet.createRandom(),
  issuer = Wallet.createRandom();
const config = {
  chainId: 11155111n,
  policyAddress: Wallet.createRandom().address,
  target: Wallet.createRandom().address,
  configId: keccak256(toUtf8Bytes("passport-18-v1")),
  action: keccak256(toUtf8Bytes("signup")),
  identityNamespace: "self-enterprise:test-org",
  environment: "test",
};
const provider = {
  getNetwork: async () => ({ chainId: 11155111n }),
  getCode: async () => "0x",
  call: async () => "0x",
};
function setup(overrides = {}, conf = config) {
  let now = 1000;
  let proofCalls = 0;
  let signCalls = 0;
  const deps = {
    verifyAccountControl: accountControlVerifier(provider, 11155111n),
    verifySelf: async (proof) => {
      proofCalls++;
      return proof;
    },
    sign: async (...args) => {
      signCalls++;
      return issuer.signTypedData(...args);
    },
    identityTagSecret: new Uint8Array(32).fill(7),
    now: () => now,
    ...overrides,
  };
  return {
    service: new EligibilityService(conf, deps),
    setNow: (n) => (now = n),
    calls: () => ({ proofCalls, signCalls }),
  };
}
const claims = (c) => ({ account: c.account, userDefinedData: c.userDefinedData, nullifier: "123" });
async function authorize(f, wallet = alice, mutate = (x) => x) {
  const c = f.service.createChallenge(wallet.address);
  return f.service.authorize(c.id, await wallet.signMessage(c.message), mutate(claims(c)));
}
test("valid bound proof issues a recoverable EIP-712 grant, without disclosures", async () => {
  const f = setup();
  const grant = await authorize(f);
  assert.equal(
    verifyTypedData(authorizationDomain(config), AUTHORIZATION_TYPES, grant.authorization, grant.signature),
    issuer.address,
  );
  assert.equal(grant.authorization.account, alice.address);
  assert.ok(grant.evidence.startsWith("0x"));
  assert.deepEqual(Object.keys(grant).sort(), ["authorization", "evidence", "signature"]);
  assert.ok(!JSON.stringify(grant).includes("nullifier"));
});
test("wrong account signature prevents Self verification and issuance", async () => {
  const f = setup();
  const c = f.service.createChallenge(alice.address);
  await assert.rejects(
    f.service.authorize(c.id, await bob.signMessage(c.message), claims(c)),
    /ACCOUNT_CONTROL_FAILED/,
  );
  assert.equal(f.calls().proofCalls, 0);
});
test("client verification flags cannot stand in for authenticated Self claims", async () => {
  const f = setup();
  const c = f.service.createChallenge(alice.address);
  await assert.rejects(f.service.authorize(c.id, await alice.signMessage(c.message), { verified: true }));
  assert.equal(f.calls().signCalls, 0);
});
for (const [name, mutate] of [
  ["wrong account", (p) => ({ ...p, account: bob.address })],
  ["changed context", (p) => ({ ...p, userDefinedData: p.userDefinedData + "00" })],
  ["missing nullifier", (p) => ({ ...p, nullifier: "" })],
  ["zero nullifier", (p) => ({ ...p, nullifier: "0" })],
  ["oversized nullifier", (p) => ({ ...p, nullifier: (1n << 256n).toString() })],
])
  test(name + " cannot issue", async () => {
    const f = setup();
    await assert.rejects(authorize(f, alice, mutate));
    assert.equal(f.calls().signCalls, 0);
  });
test("same document under two accounts yields the same one-use tag", async () => {
  const f = setup();
  const a = await authorize(f);
  const b = await authorize(f, bob);
  assert.equal(a.authorization.identityTag, b.authorization.identityTag);
});
test("equivalent numeric nullifiers cannot bypass uniqueness", async () => {
  const f = setup();
  const a = await authorize(f);
  const b = await authorize(f, bob, (p) => ({ ...p, nullifier: "000123" }));
  assert.equal(a.authorization.identityTag, b.authorization.identityTag);
});
test("policy-scoped tags do not expose the same tag across polls", async () => {
  const a = await authorize(setup());
  const b = await authorize(setup({}, { ...config, policyAddress: Wallet.createRandom().address }));
  assert.notEqual(a.authorization.identityTag, b.authorization.identityTag);
});
test("account authentication cannot be replayed across challenges or domains", async () => {
  const f = setup(),
    g = setup({}, { ...config, target: bob.address });
  const a = f.service.createChallenge(alice.address),
    b = g.service.createChallenge(alice.address);
  await assert.rejects(
    g.service.authorize(b.id, await alice.signMessage(a.message), claims(b)),
    /ACCOUNT_CONTROL_FAILED/,
  );
});
test("successful retry returns same grant, and returned data cannot mutate cached state", async () => {
  const f = setup(),
    c = f.service.createChallenge(alice.address),
    sig = await alice.signMessage(c.message);
  const a = await f.service.authorize(c.id, sig, claims(c));
  const original = a.signature;
  a.signature = "0x";
  a.authorization.account = bob.address;
  const b = await f.service.authorize(c.id, sig, {});
  assert.equal(b.signature, original);
  assert.equal(b.authorization.account, alice.address);
  assert.equal(f.calls().signCalls, 1);
});
test("expiry during proof verification prevents signing", async () => {
  let f;
  f = setup({
    verifySelf: async (p) => {
      f.setNow(1300);
      return p;
    },
  });
  await assert.rejects(authorize(f), /CHALLENGE_EXPIRED/);
  assert.equal(f.calls().signCalls, 0);
});
test("concurrent issuance is locked; failed lookup releases lock for retry", async () => {
  let unblock;
  let first = true;
  const f = setup({
    verifySelf: async (p) => {
      if (first) {
        first = false;
        await new Promise((r) => (unblock = r));
        throw Error("RPC");
      }
      return p;
    },
  });
  const c = f.service.createChallenge(alice.address),
    sig = await alice.signMessage(c.message);
  const pending = f.service.authorize(c.id, sig, claims(c));
  while (!unblock) await new Promise((r) => setTimeout(r, 0));
  await assert.rejects(f.service.authorize(c.id, sig, claims(c)), /CHALLENGE_BUSY/);
  unblock();
  await assert.rejects(pending, /RPC/);
  assert.ok((await f.service.authorize(c.id, sig, claims(c))).signature);
});
test("wrong provider chain fails closed even with valid EOA signature", async () => {
  const verify = accountControlVerifier({ ...provider, getNetwork: async () => ({ chainId: 1n }) }, 11155111n);
  await assert.rejects(verify(alice.address, "x", await alice.signMessage("x")), /WRONG_CHAIN/);
});
test("deployed ERC-1271 accepted; invalid/counterfactual signatures rejected", async () => {
  const p = { ...provider, getCode: async () => "0x6000", call: async () => "0x1626ba7e" + "00".repeat(28) };
  assert.equal(await accountControlVerifier(p, 11155111n)(alice.address, "message", "0xab"), true);
  assert.equal(
    await accountControlVerifier({ ...p, call: async () => "0xffffffff" + "00".repeat(28) }, 11155111n)(
      alice.address,
      "message",
      "0xab",
    ),
    false,
  );
  assert.equal(await accountControlVerifier(provider, 11155111n)(alice.address, "message", "0xab"), false);
});
test("zero account and missing tag secret reject configuration", () => {
  assert.throws(() => setup({}, { ...config, policyAddress: ZeroAddress }));
  assert.throws(() => setup({ identityTagSecret: new Uint8Array(0) }));
});
