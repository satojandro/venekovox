import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { load } from "./load.mjs";
const require = createRequire(process.env.P2_TOOLCHAIN_PACKAGE_JSON || import.meta.url);
const { Wallet, keccak256, toUtf8Bytes, verifyMessage } = require("ethers");
const { Webhook } = require("svix");
const { createSessionBody } = await import(pathToFileURL(require.resolve("@selfxyz/enterprise-sdk")));
const { EnterpriseEligibility } = await load("../../src/eligibility/enterprise.ts");
const { enterpriseTransport } = await load("../../src/eligibility/enterpriseSdk.mts");
const wallet = Wallet.createRandom(),
  issuer = Wallet.createRandom();
const secret = "whsec_" + Buffer.alloc(32, 5).toString("base64"); // synthetic fixture only
const sdk = enterpriseTransport("sk_test_fixture_only", secret, "test");
const flowId = "9c0b4f1c-1d6c-4f1b-a8c4-9f0fa0a8d9e2";
const config = {
  chainId: 11155111n,
  policyAddress: Wallet.createRandom().address,
  target: Wallet.createRandom().address,
  configId: keccak256(toUtf8Bytes("enterprise-age18-v1")),
  action: keccak256(toUtf8Bytes("signup")),
  identityNamespace: "self-enterprise:fixture-org",
  environment: "test",
  flowId,
  flowVersionId: "pinned-v1",
  minimumAge: 18,
};
function setup(extra = {}) {
  let now = Math.floor(Date.now() / 1000),
    calls = 0;
  const transport = {
    verifyWebhook: sdk.verifyWebhook,
    createSession: async (input) => {
      createSessionBody.parse(input);
      calls++;
      return {
        id: "verification-1",
        externalUuid: input.externalUuid,
        flowVersionId: "pinned-v1",
        verificationUrl: "https://verify.self.xyz/s/synthetic",
        expiresAt: new Date((now + 300) * 1000).toISOString(),
      };
    },
    ...extra,
  };
  const service = new EnterpriseEligibility(
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
    calls: () => calls,
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
function event(f, c, patch = {}) {
  return {
    type: "verification.completed",
    verification_id: "verification-1",
    external_uuid: c.id,
    flow_id: flowId,
    flow_version_id: "pinned-v1",
    environment: "test",
    status: "valid",
    product: "age_verification",
    proof_attributes: { minimumAge: 18, ofac: false },
    proof: { synthetic: "discard me" },
    nullifier: "0x7b",
    verified_at: new Date(f.now() * 1000).toISOString(),
    storage_state: "pending",
    storage_uri: null,
    ...patch,
  };
}
function delivery(value, secondsAgo = 0) {
  const raw = JSON.stringify(value),
    timestamp = new Date(Date.now() - secondsAgo * 1000),
    id = "fixture-delivery";
  const signature = new Webhook(secret).sign(id, timestamp, raw);
  return [
    raw,
    { "svix-id": id, "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)), "svix-signature": signature },
  ];
}
test("real SDK verifies signed webhook; only bound wallet can recover minimized grant", async () => {
  const f = setup(),
    { c, signature } = await begin(f);
  assert.equal(f.service.receiveWebhook(...delivery(event(f, c))), "accepted");
  const grant = await f.service.authorize(c.id, signature);
  assert.equal(grant.authorization.account, wallet.address);
  assert.ok(!JSON.stringify(grant).includes("discard me"));
  assert.ok(!JSON.stringify(grant).includes("nullifier"));
  await assert.rejects(
    f.service.authorize(c.id, await Wallet.createRandom().signMessage(c.message)),
    /ACCOUNT_CONTROL_FAILED/,
  );
});
test("tampering, stale signatures and unsigned JSON fail real SDK verification", async () => {
  const f = setup(),
    { c } = await begin(f),
    [raw, headers] = delivery(event(f, c));
  assert.throws(() => f.service.receiveWebhook(raw + " ", headers));
  assert.throws(() => f.service.receiveWebhook(raw, {}));
  assert.throws(() => f.service.receiveWebhook(...delivery(event(f, c), 600)));
});
test("wrong session, reference, flow, version, environment and onchain mode fail closed", async () => {
  for (const patch of [
    { verification_id: "other" },
    { external_uuid: "other" },
    { flow_id: "other" },
    { flow_version_id: "other" },
    { environment: "live" },
    { verification_mode: "onchain" },
  ]) {
    const f = setup(),
      { c, signature } = await begin(f);
    assert.throws(() => f.service.receiveWebhook(...delivery(event(f, c, patch))));
    await assert.rejects(f.service.authorize(c.id, signature), /ENTERPRISE_NOT_VERIFIED/);
  }
});
test("failed eligibility, changed rules, reveals, missing product and bad nullifiers reject", async () => {
  for (const patch of [
    { status: "invalid" },
    { status: "error" },
    { status: "expired" },
    { proof_attributes: { minimumAge: 21 } },
    { proof_attributes: { minimumAge: 18, ofac: true } },
    { proof_attributes: { minimumAge: 18, name: "synthetic" } },
    { product: undefined },
    { nullifier: null },
    { nullifier: "0" },
    { nullifier: "opaque-unsupported" },
    { nullifier: "0x" + "f".repeat(65) },
  ]) {
    const f = setup(),
      { c } = await begin(f);
    assert.throws(() => f.service.receiveWebhook(...delivery(event(f, c, patch))));
  }
});
test("duplicate completion is idempotent; conflicting identity cannot replace accepted result", async () => {
  const f = setup(),
    { c, signature } = await begin(f);
  f.service.receiveWebhook(...delivery(event(f, c)));
  assert.equal(f.service.receiveWebhook(...delivery(event(f, c, { nullifier: "00123" }))), "duplicate");
  assert.throws(() => f.service.receiveWebhook(...delivery(event(f, c, { nullifier: "124" }))), /CONFLICTING/);
  assert.deepEqual(await f.service.authorize(c.id, signature), await f.service.authorize(c.id, signature));
});
test("redirect or pending session grants nothing; session creation checks ownership first", async () => {
  const f = setup(),
    c = f.service.createChallenge(wallet.address);
  await assert.rejects(
    f.service.begin(c.id, await Wallet.createRandom().signMessage(c.message)),
    /ACCOUNT_CONTROL_FAILED/,
  );
  assert.equal(f.calls(), 0);
  await assert.rejects(f.service.authorize(c.id, await wallet.signMessage(c.message)), /NOT_VERIFIED/);
});
test("session version mismatch rejects; repeated authorized begin reuses original session", async () => {
  const bad = setup({
    createSession: async (input) => ({ id: "x", externalUuid: input.externalUuid, flowVersionId: "new-version" }),
  });
  await assert.rejects(begin(bad), /SESSION_MISMATCH/);
  const f = setup(),
    { c, signature } = await begin(f);
  await f.service.begin(c.id, signature);
  assert.equal(f.calls(), 1);
});
test("expired challenge cannot consume late webhook or issue authorization", async () => {
  const f = setup(),
    { c, signature } = await begin(f);
  f.advance(301);
  assert.throws(() => f.service.receiveWebhook(...delivery(event(f, c))), /EXPIRED/);
  await assert.rejects(f.service.authorize(c.id, signature), /EXPIRED/);
});
test("completion timestamps outside the challenge reject", async () => {
  for (const offset of [-301, 60]) {
    const f = setup(),
      { c } = await begin(f);
    assert.throws(
      () =>
        f.service.receiveWebhook(
          ...delivery(event(f, c, { verified_at: new Date((f.now() + offset) * 1000).toISOString() })),
        ),
      /TIME_MISMATCH/,
    );
  }
});
test("SDK credential wiring refuses mixed test/live environment", () => {
  assert.throws(() => enterpriseTransport("sk_test_fixture", secret, "live"), /CREDENTIAL_ENVIRONMENT/);
});
test("overlapping begin creates one session; expiry during creation cannot publish its URL", async () => {
  let release;
  const f = setup({
    createSession: (input) =>
      new Promise((resolve) => {
        release = () =>
          resolve({
            id: "verification-1",
            externalUuid: input.externalUuid,
            flowVersionId: "pinned-v1",
            verificationUrl: "https://verify.self.xyz/s/synthetic",
            expiresAt: new Date((f.now() + 300) * 1000).toISOString(),
          });
      }),
  });
  const c = f.service.createChallenge(wallet.address),
    signature = await wallet.signMessage(c.message);
  const pending = f.service.begin(c.id, signature);
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(f.service.begin(c.id, signature), /CHALLENGE_BUSY/);
  f.advance(301);
  release();
  await assert.rejects(pending, /EXPIRED/);
});
test("webhook arriving before session creation completes is not trusted", async () => {
  const f = setup(),
    c = f.service.createChallenge(wallet.address);
  assert.throws(() => f.service.receiveWebhook(...delivery(event(f, c))), /CONTEXT_MISMATCH/);
});
