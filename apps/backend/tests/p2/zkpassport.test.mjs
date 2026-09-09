import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { load } from "./load.mjs";
const require = createRequire(process.env.P2_TOOLCHAIN_PACKAGE_JSON || import.meta.url);
const { Wallet, keccak256, toUtf8Bytes, verifyMessage } = require("ethers");
const { ZKPassport, NullifierType } = require("@zkpassport/sdk");
const { ZkPassportEligibility } = await load("../../src/eligibility/zkpassport.ts");
const { zkpassportTransport, tagNullifierType } = await load("../../src/eligibility/zkpassportSdk.mts");

const wallet = Wallet.createRandom(),
  issuer = Wallet.createRandom();
const domain = "venekovox.trial";
// D17 Stage-1 lock: salted uniqueness mode, scope frozen, strict facematch required.
const config = {
  chainId: 11155111n,
  policyAddress: Wallet.createRandom().address,
  target: Wallet.createRandom().address,
  // configId ENCODES the uniqueness mode: a salted↔scoped switch is a new config.
  configId: keccak256(toUtf8Bytes("zkpassport-stage1-salted-v1")),
  action: keccak256(toUtf8Bytes("signup")),
  identityNamespace: "zkpassport:fixture-org",
  environment: "test",
  zkDomain: domain,
  zkScope: "venekovox-stage1",
  uniqueIdentifierType: "salted",
  oprfKeyId: undefined,
  query: {
    nationalityIn: ["Venezuela", "United States", "Australia"],
    minimumAge: 18,
    discloseGender: true,
    facematch: "strict",
  },
  validity: 604800,
  devMode: true,
};
// Scoped fallback config (documented D17 fallback, PM decision required in prod).
const scopedConfig = {
  ...config,
  configId: keccak256(toUtf8Bytes("zkpassport-stage1-scoped-v1")),
  uniqueIdentifierType: "scoped",
  query: { nationalityIn: ["Venezuela", "United States", "Australia"], minimumAge: 18, discloseGender: true },
};

/** Returns the REAL-SDK canonical query for the configured requirements. */
function canonicalQuery() {
  const zk = new ZKPassport(domain, { disableProofStorage: true });
  const qb = zk.createQuery();
  qb.gte("age", 18);
  qb.in("nationality", ["Venezuela", "United States", "Australia"]);
  qb.disclose("gender");
  qb.facematch("strict");
  return qb.done().query;
}
function validQueryResult() {
  return {
    age: { gte: { result: true, expected: 18 } },
    nationality: { in: { result: true, expected: ["Venezuela", "United States", "Australia"] } },
    gender: { disclose: { result: "M" } },
  };
}
function setup(extra = {}) {
  let now = Math.floor(Date.now() / 1000);
  const transport = {
    buildQuery: zkpassportTransport(domain).buildQuery, // REAL SDK, offline
    verify: async () => ({ verified: true, uniqueIdentifier: "0x" + "ab".repeat(32), uniqueIdentifierType: "SALTED" }),
    ...extra,
  };
  const service = new ZkPassportEligibility(
    config,
    {
      now: () => now,
      identityTagSecret: new Uint8Array(32).fill(4),
      verifyAccountControl: async (account, message, signature) => verifyMessage(message, signature) === account,
      sign: (...args) => issuer.signTypedData(...args),
    },
    transport,
  );
  return {
    service,
    transport,
    now: () => now,
    advance: (n) => {
      now += n;
    },
  };
}
async function begin(f) {
  const c = f.service.createChallenge(wallet.address),
    signature = await wallet.signMessage(c.message);
  await f.service.begin(c.id, signature);
  return { c, signature };
}
function payload(patch = {}) {
  return {
    proofs: [{ name: "outer", version: "1", vkeyHash: "0x" + "cd".repeat(32), proof: "0xsynthetic" }],
    originalQuery: canonicalQuery(),
    queryResult: validQueryResult(),
    ...patch,
  };
}
async function check(final) {
  const f = setup(final),
    { c, signature } = await begin(f);
  return { f, c, signature };
}
async function accepted(patch, final) {
  const { f, c, signature } = await check(final);
  const outcome = await f.service.receiveProof(c.id, signature, payload(patch));
  assert.equal(outcome, "accepted");
  return { f, c, signature };
}

test("real SDK rebuilds the canonical offline query; transport double verifies a synthetic bundle", async () => {
  const { f, c, signature } = await accepted({});
  const grant = await f.service.authorize(c.id, signature);
  assert.equal(grant.authorization.account, wallet.address);
  assert.ok(!JSON.stringify(grant).includes("proofs"));
  assert.ok(!JSON.stringify(grant).includes("queryResult"));
  assert.ok(!JSON.stringify(grant).includes("abab")); // nullifier never leaves as raw identity
});
test("client original query must equal the server-rebuilt canonical query", async () => {
  // Tampered query: same requirements but gender removed / age lowered / facematch missing.
  for (const originalQuery of [
    { age: { gte: 18 }, nationality: { in: ["VEN", "USA", "AUS"] } }, // dropped gender
    { age: { gte: 17 }, nationality: { in: ["VEN", "USA", "AUS"] }, gender: { disclose: true } },
    { gender: { disclose: true } }, // dropped nationality+age
    { age: { gte: 18 }, nationality: { in: ["PRK"] }, gender: { disclose: true } },
    { age: { gte: 18 }, nationality: { in: ["Venezuela", "United States", "Australia"] }, gender: { disclose: true } }, // dropped facematch (D17 salted)
  ]) {
    const { f, c, signature } = await check({});
    await assert.rejects(f.service.receiveProof(c.id, signature, payload({ originalQuery })), /QUERY_MISMATCH/);
    await assert.rejects(f.service.authorize(c.id, signature), /NOT_VERIFIED/);
  }
});
test("unsupported or missing proofs reject before verification", async () => {
  for (const proofs of [undefined, [], "not-an-array"]) {
    const { f, c, signature } = await check({});
    await assert.rejects(
      f.service.receiveProof(c.id, signature, payload(proofs === undefined ? { proofs: [] } : { proofs })),
    );
  }
});
test("failed cryptographic verification rejects; interrupted session grants nothing", async () => {
  const f = setup({ verify: async () => ({ verified: false, queryResultErrors: { outer: {} } }) });
  const { c, signature } = await begin(f);
  await assert.rejects(f.service.receiveProof(c.id, signature, payload()), /VERIFICATION_FAILED/);
  await assert.rejects(f.service.authorize(c.id, signature), /NOT_VERIFIED/);
});
test("missing unique identifier rejects; canonical nullifier formats enforce 1..2^256-1", async () => {
  await assert.rejects(
    receiveWithVerify({ uniqueIdentifier: undefined, verified: true, uniqueIdentifierType: "SALTED" }),
    /FAILED|INVALID/,
  );
  for (const uniqueIdentifier of ["0", "0x0", "opaque", "0x" + "f".repeat(65), (1n << 256n).toString()]) {
    await assert.rejects(
      () => receiveWithVerify({ uniqueIdentifier, verified: true, uniqueIdentifierType: "SALTED" }),
      /INVALID_NULLIFIER/,
      `nullifier ${uniqueIdentifier} must fail`,
    );
  }
  async function receiveWithVerify(verifyResult) {
    const f = setup({ verify: async () => verifyResult });
    const { c, signature } = await begin(f);
    await f.service.receiveProof(c.id, signature, payload());
  }
  // dev-mode mocks share uniqueIdentifier "1" — still a legal nullifier, documented limitation
  const f = setup({
    verify: async () => ({ verified: true, uniqueIdentifier: "1", uniqueIdentifierType: "SALTED_MOCK" }),
  });
  const { c, signature } = await begin(f);
  assert.equal(await f.service.receiveProof(c.id, signature, payload()), "accepted");
});
test("attribute gates fail closed — no silent fallback for age, band, nationality or gender", async () => {
  const cases = [
    { queryResult: { ...validQueryResult(), age: { gte: { result: false } } } },
    { queryResult: { ...validQueryResult(), nationality: { in: { result: false } } } },
    { queryResult: { ...validQueryResult(), gender: {} } },
    { queryResult: { ...validQueryResult(), gender: { disclose: { result: "" } } } },
  ];
  for (const patch of cases) {
    const { f, c, signature } = await check({});
    await assert.rejects(f.service.receiveProof(c.id, signature, payload(patch)), /UNMET/);
  }
});
test("age band capability is pinned when configured and enforced", async () => {
  const bandConfig = { ...config, query: { ...config.query, ageBand: { min: 18, max: 99 } } };
  let now = Math.floor(Date.now() / 1000);
  const service = new ZkPassportEligibility(
    bandConfig,
    {
      now: () => now,
      identityTagSecret: new Uint8Array(32).fill(4),
      verifyAccountControl: async (account, message, signature) => verifyMessage(message, signature) === account,
      sign: (...args) => issuer.signTypedData(...args),
    },
    {
      buildQuery: zkpassportTransport(domain).buildQuery, // real SDK
      verify: async () => ({
        verified: true,
        uniqueIdentifier: "0x" + "ef".repeat(32),
        uniqueIdentifierType: "SALTED",
      }),
    },
  );
  const c = service.createChallenge(wallet.address),
    signature = await wallet.signMessage(c.message);
  await service.begin(c.id, signature);
  const bandQuery = { ...payload().originalQuery, age: { gte: 18, range: [18, 99] } };
  const qrBandFalse = { ...validQueryResult(), age: { gte: { result: true }, range: { result: false } } };
  await assert.rejects(
    service.receiveProof(c.id, signature, payload({ originalQuery: bandQuery, queryResult: qrBandFalse })),
    /BAND_UNMET/,
  );
  const qrBandTrue = { ...validQueryResult(), age: { gte: { result: true }, range: { result: true } } };
  await assert.equal(
    await service.receiveProof(c.id, signature, payload({ originalQuery: bandQuery, queryResult: qrBandTrue })),
    "accepted",
  );
});
test("wrong account cannot begin, receive or authorize", async () => {
  const f = setup(),
    c = f.service.createChallenge(wallet.address),
    otherSignature = await Wallet.createRandom().signMessage(c.message);
  // begin is the first account-control gate: wrong owner rejected there
  await assert.rejects(f.service.begin(c.id, otherSignature), /ACCOUNT_CONTROL_FAILED/);
  // start the session with the real owner, then a wrong owner cannot receive/authorize
  const realSignature = await wallet.signMessage(c.message);
  await f.service.begin(c.id, realSignature);
  await assert.rejects(f.service.receiveProof(c.id, otherSignature, payload()), /ACCOUNT_CONTROL_FAILED/);
  await assert.rejects(f.service.authorize(c.id, otherSignature), /ACCOUNT_CONTROL_FAILED/);
  await assert.rejects(f.service.authorize(c.id, realSignature), /NOT_VERIFIED/);
});
test("wrong scope/domain context cannot be injected by the client", async () => {
  const f = setup(),
    { c, signature } = await begin(f);
  const parameters = await f.service.begin(c.id, signature);
  assert.equal(parameters.scope, config.zkScope);
  assert.equal(parameters.domain, config.zkDomain);
  assert.deepEqual(parameters.query, canonicalQuery());
});
test("duplicate completion is idempotent; conflicting identity cannot replace accepted result", async () => {
  const f = setup({
    verify: async () => ({ verified: true, uniqueIdentifier: "1234", uniqueIdentifierType: "SALTED" }),
  });
  const { c, signature } = await begin(f);
  assert.equal(await f.service.receiveProof(c.id, signature, payload()), "accepted");
  assert.equal(await f.service.receiveProof(c.id, signature, payload()), "duplicate");
  // conflicting identity path: same session, different canonical nullifier
  f.transport.verify = async () => ({ verified: true, uniqueIdentifier: "9999", uniqueIdentifierType: "SALTED" });
  await assert.rejects(f.service.receiveProof(c.id, signature, payload()), /CONFLICTING/);
  assert.deepEqual(await f.service.authorize(c.id, signature), await f.service.authorize(c.id, signature));
});
test("expired challenge cannot consume late proof or issue authorization", async () => {
  const f = setup(),
    { c, signature } = await begin(f);
  f.advance(301);
  await assert.rejects(f.service.receiveProof(c.id, signature, payload()), /EXPIRED/);
  await assert.rejects(f.service.authorize(c.id, signature), /EXPIRED/);
});
test("receive after expiry during verification cannot publish a grant", async () => {
  let release;
  const f = setup({
    verify: () =>
      new Promise((resolve) => {
        release = () =>
          resolve({ verified: true, uniqueIdentifier: "0x" + "ab".repeat(32), uniqueIdentifierType: "SALTED" });
      }),
  });
  const c = f.service.createChallenge(wallet.address),
    signature = await wallet.signMessage(c.message);
  await f.service.begin(c.id, signature);
  const pending = f.service.receiveProof(c.id, signature, payload());
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(f.service.receiveProof(c.id, signature, payload()), /CHALLENGE_BUSY/);
  f.advance(301);
  release();
  await assert.rejects(pending, /EXPIRED/);
});
test("proof arriving without begin is not trusted", async () => {
  const f = setup(),
    c = f.service.createChallenge(wallet.address),
    signature = await wallet.signMessage(c.message);
  await assert.rejects(f.service.receiveProof(c.id, signature, payload()), /SESSION_NOT_STARTED/);
  await assert.rejects(f.service.authorize(c.id, signature), /SESSION_NOT_STARTED|NOT_VERIFIED/);
});
test("transport refuses invalid domain at construction", () => {
  assert.throws(() => zkpassportTransport("https://evil.example"), /ZKPASSPORT_INVALID_DOMAIN/);
  assert.throws(() => zkpassportTransport(""), /ZKPASSPORT_INVALID_DOMAIN/);
});
test("numerical SDK NullifierType enum normalizes to string tags (salted proof must not fail)", () => {
  // SDK returns NUMBERS (NON_SALTED=0, SALTED=1, NON_SALTED_MOCK=2, SALTED_MOCK=3);
  // the adapter compares strings. A legitimate salted proof (1) must become "SALTED".
  assert.equal(tagNullifierType(NullifierType.NON_SALTED), "NON_SALTED");
  assert.equal(tagNullifierType(NullifierType.SALTED), "SALTED");
  assert.equal(tagNullifierType(NullifierType.NON_SALTED_MOCK), "NON_SALTED_MOCK");
  assert.equal(tagNullifierType(NullifierType.SALTED_MOCK), "SALTED_MOCK");
  assert.equal(tagNullifierType(undefined), undefined);
});
// --- D17 salted/scoped uniqueness enforcement (addendum 2026-09-08) ---
test("D17: salted config rejects a scoped (NON_SALTED) proof result", async () => {
  const { f, c, signature } = await check({
    verify: async () => ({
      verified: true,
      uniqueIdentifier: "0x" + "cd".repeat(32),
      uniqueIdentifierType: "NON_SALTED",
    }),
  });
  await assert.rejects(f.service.receiveProof(c.id, signature, payload()), /UNIQUENESS_TYPE_MISMATCH/);
  await assert.rejects(f.service.authorize(c.id, signature), /NOT_VERIFIED/);
});
test("D17: scoped config rejects a salted (SALTED) proof result; scoped tolerates NON_SALTED", async () => {
  let now = Math.floor(Date.now() / 1000);
  const service = new ZkPassportEligibility(
    scopedConfig,
    {
      now: () => now,
      identityTagSecret: new Uint8Array(32).fill(4),
      verifyAccountControl: async (account, message, signature) => verifyMessage(message, signature) === account,
      sign: (...args) => issuer.signTypedData(...args),
    },
    {
      buildQuery: zkpassportTransport(domain).buildQuery,
      verify: async () => ({
        verified: true,
        uniqueIdentifier: "0x" + "12".repeat(32),
        uniqueIdentifierType: "SALTED",
      }),
    },
  );
  const c = service.createChallenge(wallet.address),
    signature = await wallet.signMessage(c.message);
  await service.begin(c.id, signature);
  await assert.rejects(
    service.receiveProof(c.id, signature, payload(patchQueryResultFor(scopedConfig))),
    /UNIQUENESS_TYPE_MISMATCH/,
  );
  // same config, correct NON_SALTED result -> accepted
  const okNow = Math.floor(Date.now() / 1000);
  const okService = new ZkPassportEligibility(
    scopedConfig,
    {
      now: () => okNow,
      identityTagSecret: new Uint8Array(32).fill(4),
      verifyAccountControl: async (account, message, signature) => verifyMessage(message, signature) === account,
      sign: (...args) => issuer.signTypedData(...args),
    },
    {
      buildQuery: zkpassportTransport(domain).buildQuery,
      verify: async () => ({
        verified: true,
        uniqueIdentifier: "0x" + "12".repeat(32),
        uniqueIdentifierType: "NON_SALTED",
      }),
    },
  );
  const c2 = okService.createChallenge(wallet.address),
    sig2 = await wallet.signMessage(c2.message);
  await okService.begin(c2.id, sig2);
  assert.equal(await okService.receiveProof(c2.id, sig2, payload(patchQueryResultFor(scopedConfig))), "accepted");
  function patchQueryResultFor(cfg) {
    // scoped canonical query has no facematch; reuse the salted query minus it.
    return { originalQuery: oqWithoutFacematch(), queryResult: validQueryResult() };
    function oqWithoutFacematch() {
      const zk = new ZKPassport(domain, { disableProofStorage: true });
      const qb = zk.createQuery();
      qb.gte("age", 18);
      qb.in("nationality", ["Venezuela", "United States", "Australia"]);
      qb.disclose("gender");
      return qb.done().query;
    }
  }
});
test("D17: SALTED_MOCK accepted only in devMode; rejected outside dev (SDK + adapter fail closed)", async () => {
  // devMode true: mock variant of the SALTED type is accepted
  const { f, c, signature } = await check({
    verify: async () => ({
      verified: true,
      uniqueIdentifier: "0x" + "ef".repeat(32),
      uniqueIdentifierType: "SALTED_MOCK",
    }),
  });
  assert.equal(await f.service.receiveProof(c.id, signature, payload()), "accepted");
  // devMode false: the same mock result must be rejected
  const liveConfig = { ...config, devMode: false };
  let now = Math.floor(Date.now() / 1000);
  const live = new ZkPassportEligibility(
    liveConfig,
    {
      now: () => now,
      identityTagSecret: new Uint8Array(32).fill(4),
      verifyAccountControl: async (account, message, signature) => verifyMessage(message, signature) === account,
      sign: (...args) => issuer.signTypedData(...args),
    },
    {
      buildQuery: zkpassportTransport(domain).buildQuery,
      verify: async () => ({
        verified: true,
        uniqueIdentifier: "0x" + "ef".repeat(32),
        uniqueIdentifierType: "SALTED_MOCK",
      }),
    },
  );
  const c2 = live.createChallenge(wallet.address),
    sig2 = await wallet.signMessage(c2.message);
  await live.begin(c2.id, sig2);
  await assert.rejects(live.receiveProof(c2.id, sig2, payload()), /UNIQUENESS_TYPE_MISMATCH/);
});
test("D17: salted config without strict facematch fails closed at construction", () => {
  const bad = { ...config, query: { ...config.query, facematch: undefined } };
  assert.throws(
    () =>
      new ZkPassportEligibility(
        bad,
        {
          now: () => Math.floor(Date.now() / 1000),
          identityTagSecret: new Uint8Array(32).fill(4),
          verifyAccountControl: async () => false,
          sign: async () => "0x",
        },
        { buildQuery: zkpassportTransport(domain).buildQuery, verify: async () => ({ verified: false }) },
      ),
    /INVALID_ZKPASSPORT_QUERY/,
  );
});
test("D17: begin pins the uniqueness type and forwards oprfKeyId to transport verify", async () => {
  const seen = [];
  const cfg = { ...config, oprfKeyId: "oprf-stage1-fixture" };
  let now = Math.floor(Date.now() / 1000);
  const service = new ZkPassportEligibility(
    cfg,
    {
      now: () => now,
      identityTagSecret: new Uint8Array(32).fill(4),
      verifyAccountControl: async (account, message, signature) => verifyMessage(message, signature) === account,
      sign: (...args) => issuer.signTypedData(...args),
    },
    {
      buildQuery: zkpassportTransport(domain).buildQuery,
      verify: async (input) => {
        seen.push(input.oprfKeyId);
        return { verified: true, uniqueIdentifier: "0x" + "cd".repeat(32), uniqueIdentifierType: "SALTED" };
      },
    },
  );
  const c = service.createChallenge(wallet.address),
    signature = await wallet.signMessage(c.message);
  const params = await service.begin(c.id, signature);
  assert.equal(params.uniqueIdentifierType, "SALTED");
  assert.equal(params.oprfKeyId, "oprf-stage1-fixture");
  assert.deepEqual(params.query, canonicalQuery());
  await service.receiveProof(c.id, signature, payload());
  assert.deepEqual(seen, ["oprf-stage1-fixture"]); // adapter forwarded the pinned key
});
