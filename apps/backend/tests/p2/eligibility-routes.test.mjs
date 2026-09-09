import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import { load } from "./load.mjs";

const require = createRequire(process.env.P2_TOOLCHAIN_PACKAGE_JSON || import.meta.url);
const express = require("express");
const { Wallet, keccak256, toUtf8Bytes, verifyMessage } = require("ethers");
const { ZKPassport } = require("@zkpassport/sdk");
const { ZkPassportEligibility } = await load("../../src/eligibility/zkpassport.ts");
const { zkpassportTransport } = await load("../../src/eligibility/zkpassportSdk.mts");
const { MemorySessionStore } = await load("../../src/eligibility/sessionStore.ts");
const { createEligibilityRouter } = await load("../../src/routes/eligibility.ts");
const { readFileSync } = await import("node:fs");

const wallet = Wallet.createRandom();
const issuer = Wallet.createRandom();
const domain = "uxisnear.com";
const config = {
  chainId: 11155111n,
  policyAddress: Wallet.createRandom().address,
  target: Wallet.createRandom().address,
  configId: keccak256(toUtf8Bytes("venekovox-stage1-salted-v1")),
  action: keccak256(toUtf8Bytes("signup")),
  identityNamespace: "venekovox:stage1:test",
  environment: "test",
  zkDomain: domain,
  zkScope: "venekovox-stage1",
  uniqueIdentifierType: "salted",
  query: {
    nationalityIn: ["Venezuela", "United States", "Australia"],
    minimumAge: 18,
    discloseGender: true,
    facematch: "strict",
  },
  validity: 604800,
  devMode: true,
};

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
function payload(patch = {}) {
  return {
    proofs: [{ name: "outer", version: "1", vkeyHash: "0x" + "cd".repeat(32), proof: "0xsynthetic" }],
    originalQuery: canonicalQuery(),
    queryResult: validQueryResult(),
    ...patch,
  };
}

async function mounted(extra = {}, cfg = config) {
  let now = Math.floor(Date.now() / 1000);
  let verifyCalls = 0;
  const transport = {
    buildQuery: zkpassportTransport(domain).buildQuery,
    verify: async (input) => {
      verifyCalls++;
      if (!input.proofs) throw new Error("transport must receive proofs");
      return { verified: true, uniqueIdentifier: "0x" + "ab".repeat(32), uniqueIdentifierType: "SALTED" };
    },
    ...extra,
  };
  const service = new ZkPassportEligibility(
    cfg,
    {
      now: () => now,
      identityTagSecret: new Uint8Array(32).fill(4),
      verifyAccountControl: async (account, message, signature) => verifyMessage(message, signature) === account,
      sign: (...args) => issuer.signTypedData(...args),
    },
    transport,
  );
  const app = express();
  app.use(express.json());
  app.use(
    "/eligibility",
    createEligibilityRouter({
      service,
      sessions: new MemorySessionStore(),
      mode: "test",
      rateLimit: extra.rateLimit === true,
    }),
  );
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    server,
    service,
    transport,
    verifyCalls: () => verifyCalls,
    advance: (n) => {
      now += n;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function json(url, path, body, extra = {}) {
  const response = await fetch(url + path, {
    method: extra.method || "POST",
    headers: { "Content-Type": "application/json", ...(extra.headers || {}) },
    body: extra.method === "GET" ? undefined : JSON.stringify(body || {}),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function started(harness) {
  const challenge = await json(harness.url, "/eligibility/challenge", { account: wallet.address });
  const signature = await wallet.signMessage(challenge.body.message);
  const begin = await json(harness.url, "/eligibility/begin", {
    challengeId: challenge.body.challengeId,
    signature,
  });
  return { challenge: challenge.body, signature, begin };
}

test("GET /eligibility/health reports zkpassport without claiming durability", async () => {
  const h = await mounted();
  const r = await json(h.url, "/eligibility/health", null, { method: "GET" });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.provider, "zkpassport");
  assert.equal(r.body.mode, "test");
  assert.equal(r.body.durable, undefined);
  await h.close();
});

test("mounted happy path: challenge → begin → receive → authorize evidence", async () => {
  const h = await mounted();
  const { challenge, signature } = await started(h);
  const received = await json(h.url, "/eligibility/receive", {
    challengeId: challenge.challengeId,
    signature,
    payload: payload(),
  });
  assert.equal(received.body.outcome, "accepted");
  assert.ok(!JSON.stringify(received.body).includes("proofs"));
  const grant = await json(h.url, "/eligibility/authorize", {
    challengeId: challenge.challengeId,
    signature,
  });
  assert.equal(grant.status, 200);
  assert.equal(grant.body.authorization.account, wallet.address);
  assert.match(grant.body.evidence, /^0x/);
  assert.ok(grant.body.signature);
  assert.ok(!JSON.stringify(grant.body).includes("queryResult"));
  assert.equal(h.verifyCalls(), 1);
  await h.close();
});

test("wrong account is rejected on the mounted router", async () => {
  const h = await mounted();
  const challenge = await json(h.url, "/eligibility/challenge", { account: wallet.address });
  const other = await Wallet.createRandom().signMessage(challenge.body.message);
  const begin = await json(h.url, "/eligibility/begin", {
    challengeId: challenge.body.challengeId,
    signature: other,
  });
  assert.equal(begin.status, 400);
  assert.match(begin.body.error, /ACCOUNT_CONTROL_FAILED/);
  await h.close();
});

test("receive without begin is not trusted", async () => {
  const h = await mounted();
  const challenge = await json(h.url, "/eligibility/challenge", { account: wallet.address });
  const signature = await wallet.signMessage(challenge.body.message);
  const received = await json(h.url, "/eligibility/receive", {
    challengeId: challenge.body.challengeId,
    signature,
    payload: payload(),
  });
  assert.equal(received.status, 400);
  assert.match(received.body.error, /SESSION_NOT_STARTED/);
  await h.close();
});

test("query mismatch is rejected on the mounted router", async () => {
  const h = await mounted();
  const { challenge, signature } = await started(h);
  const received = await json(h.url, "/eligibility/receive", {
    challengeId: challenge.challengeId,
    signature,
    payload: payload({ originalQuery: { age: { gte: 18 } } }),
  });
  assert.equal(received.status, 400);
  assert.match(received.body.error, /QUERY_MISMATCH/);
  await h.close();
});

test("salted mounted path rejects NON_SALTED proofs", async () => {
  const h = await mounted({
    verify: async () => ({
      verified: true,
      uniqueIdentifier: "0x" + "cd".repeat(32),
      uniqueIdentifierType: "NON_SALTED",
    }),
  });
  const { challenge, signature } = await started(h);
  const received = await json(h.url, "/eligibility/receive", {
    challengeId: challenge.challengeId,
    signature,
    payload: payload(),
  });
  assert.match(received.body.error, /UNIQUENESS_TYPE_MISMATCH/);
  await h.close();
});

test("SALTED_MOCK is rejected when live/devMode is false", async () => {
  const h = await mounted(
    {
      verify: async () => ({
        verified: true,
        uniqueIdentifier: "1",
        uniqueIdentifierType: "SALTED_MOCK",
      }),
    },
    { ...config, devMode: false },
  );
  const { challenge, signature } = await started(h);
  const received = await json(h.url, "/eligibility/receive", {
    challengeId: challenge.challengeId,
    signature,
    payload: payload(),
  });
  assert.match(received.body.error, /UNIQUENESS_TYPE_MISMATCH/);
  await h.close();
});

test("empty/non-canonical identifier is rejected", async () => {
  const h = await mounted({
    verify: async () => ({ verified: true, uniqueIdentifier: "0", uniqueIdentifierType: "SALTED" }),
  });
  const { challenge, signature } = await started(h);
  const received = await json(h.url, "/eligibility/receive", {
    challengeId: challenge.challengeId,
    signature,
    payload: payload(),
  });
  assert.match(received.body.error, /INVALID_NULLIFIER|FAILED/);
  await h.close();
});

test("client-trusted verified flag is ignored; transport is always called", async () => {
  const h = await mounted();
  const { challenge, signature } = await started(h);
  await json(h.url, "/eligibility/receive", {
    challengeId: challenge.challengeId,
    signature,
    payload: { ...payload(), verified: true, uniqueIdentifier: "client-says-so" },
  });
  assert.equal(h.verifyCalls(), 1);
  await h.close();
});

test("expiry during verify cannot issue a grant", async () => {
  let release;
  const h = await mounted({
    verify: () =>
      new Promise((resolve) => {
        release = () =>
          resolve({ verified: true, uniqueIdentifier: "0x" + "ab".repeat(32), uniqueIdentifierType: "SALTED" });
      }),
  });
  try {
    const { challenge, signature } = await started(h);
    const pending = json(h.url, "/eligibility/receive", {
      challengeId: challenge.challengeId,
      signature,
      payload: payload(),
    });
    while (!release) await new Promise((resolve) => setImmediate(resolve));
    h.advance(301);
    release();
    const received = await pending;
    assert.equal(received.status, 400);
    assert.match(received.body.error, /EXPIRED/);
  } finally {
    await h.close();
  }
});

test("rate-limit fires on challenge", async () => {
  const h = await mounted({ rateLimit: true });
  let last;
  for (let i = 0; i < 21; i++) {
    last = await json(h.url, "/eligibility/challenge", { account: Wallet.createRandom().address });
  }
  assert.equal(last.status, 429);
  await h.close();
});

test("CORS allowlist in app.ts includes the frontend origins", () => {
  const source = readFileSync(new URL("../../src/app.ts", import.meta.url), "utf8");
  assert.match(source, /http:\/\/localhost:3000/);
  assert.match(source, /http:\/\/localhost:5173/);
  assert.match(source, /https:\/\/app\.uxisnear\.com/);
  assert.match(source, /https:\/\/venekovox\.com/);
});

test("live mode fails fast without issuer/tag secrets", () => {
  const source = readFileSync(new URL("../../src/eligibility/product.ts", import.meta.url), "utf8");
  assert.match(source, /LIVE_MODE_REQUIRES_ISSUER_PRIVATE_KEY_AND_TAG_SECRET/);
  assert.match(source, /POLICY_AND_TARGET_MUST_NOT_BE_ZERO_ADDRESS/);
});

test("MemorySessionStore prunes expired rows and enforces capacity", () => {
  const store = new MemorySessionStore(2);
  store.set({ challengeId: "a", account: wallet.address, expiresAt: 10 });
  store.set({ challengeId: "b", account: wallet.address, expiresAt: 20 });
  assert.throws(() => store.set({ challengeId: "c", account: wallet.address, expiresAt: 30 }), /CHALLENGE_CAPACITY/);
  store.prune(11);
  assert.equal(store.size(), 1);
  store.set({ challengeId: "c", account: wallet.address, expiresAt: 30 });
  assert.equal(store.size(), 2);
});
