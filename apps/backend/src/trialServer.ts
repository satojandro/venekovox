import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import { ethers } from "ethers";

/**
 * Provider-trial server — Self Enterprise vs ZKPassport (bounded experiment).
 *
 * SEPARATE ENTRYPOINT. It does NOT mount into the existing app.ts; run it on its
 * own port (default 3110) with `pnpm --dir apps/backend trial`. Nothing here is
 * production: single-process, in-memory challenge store, test-mode signing by
 * default. Real App Store / Google Play document verification is possible only
 * when Alejandro provisions the live-mode env secrets privately (see
 * docs/build.md provider-trial section) and points the browser client at this
 * server over HTTPS/tunnel for the query/QR build.
 *
 * SECURITY RULES (enforced by the shared boundary, not by this file):
 *  - Never log proofs, query results, disclosed attributes, webhook bodies,
 *    challenge signatures or authorization calldata. Log status codes only.
 *  - Never echo a client-provided verificationUrl/scope into a webhook match;
 *    both providers' adapters are the only verifiers.
 *  - This binds EIP-712 grants to the SAME policy target used by SelfEligibilityPolicy.
 */

import { EnterpriseEligibility, type EnterpriseConfig } from "./eligibility/enterprise";
import { enterpriseTransport } from "./eligibility/enterpriseSdk.mts";
import { ZkPassportEligibility, type ZkPassportConfig } from "./eligibility/zkpassport";
import { zkpassportTransport } from "./eligibility/zkpassportSdk.mts";

const app: import("express").Express = express();
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.TRIAL_PORT || 3110);
const testMode = process.env.TRIAL_MODE !== "live"; // default: synthetic test mode

// One policy/issuer per environment. The issuer key signs the EIP-712
// Authorization. In test mode a random in-memory key is generated per boot; in
// live mode Alejandro provisions TRIAL_ISSUER_PRIVATE_KEY privately.
if (!testMode && (!process.env.TRIAL_ISSUER_PRIVATE_KEY || !process.env.TRIAL_TAG_SECRET))
  throw new Error("LIVE_MODE_REQUIRES_TRIAL_ISSUER_PRIVATE_KEY_AND_TRIAL_TAG_SECRET");
const issuer = new ethers.Wallet(
  testMode ? ethers.Wallet.createRandom().privateKey : (process.env.TRIAL_ISSUER_PRIVATE_KEY as string),
);

const baseConfig = {
  chainId: BigInt(process.env.TRIAL_CHAIN_ID || 11155111),
  // Test mode: the policy/target are NOT deployed (nothing enforces the grant),
  // so use throwaway addresses rather than ZeroAddress, which the eligibility
  // boundary rejects (accountAddress() fails closed on the zero address).
  policyAddress:
    process.env.TRIAL_POLICY_ADDRESS || (testMode ? ethers.Wallet.createRandom().address : ethers.ZeroAddress),
  target: process.env.TRIAL_TARGET_ADDRESS || (testMode ? ethers.Wallet.createRandom().address : ethers.ZeroAddress),
  // D17: configId ENCODES the uniqueness mode so a salted↔scoped switch is a
  // new config, never a silent reuse of the same policy/action binding.
  configId: ethers.keccak256(ethers.toUtf8Bytes(process.env.TRIAL_CONFIG_ID || "venekovox-stage1-salted-v1")),
  action: ethers.keccak256(ethers.toUtf8Bytes("signup")),
  identityNamespace: "venekovox:trial:" + (testMode ? "test" : "live"),
  environment: (testMode ? "test" : "live") as "test" | "live",
};

const deps = {
  now: () => Math.floor(Date.now() / 1000),
  // Uint8Array, not a hex string: the eligibility boundary consumes
  // Buffer.from(identityTagSecret) as raw bytes (see authorization.ts).
  identityTagSecret: testMode
    ? ethers.randomBytes(32)
    : Uint8Array.from(Buffer.from(process.env.TRIAL_TAG_SECRET as string, "hex")),
  verifyAccountControl: async (account: string, message: string, signature: string) => {
    try {
      return ethers.verifyMessage(message, signature).toLowerCase() === account.toLowerCase();
    } catch {
      return false;
    }
  },
  sign: (domain: unknown, types: unknown, value: unknown) =>
    issuer.signTypedData(domain as never, types as never, value as never),
};
if (deps.identityTagSecret.length < 32) throw new Error("TRIAL_TAG_SECRET too short in live mode");

// --- ZKPassport adapter (real SDK, offline query rebuild) ---
const zkConfig: ZkPassportConfig = {
  ...baseConfig,
  zkDomain: process.env.TRIAL_ZKP_DOMAIN || "venekovox.trial",
  zkScope: process.env.TRIAL_ZKP_SCOPE || "venekovox-stage1",
  // D17 Stage-1 lock: salted uniqueness + strict facematch (config fails
  // closed if facematch is omitted below).
  uniqueIdentifierType: "salted",
  oprfKeyId: process.env.TRIAL_ZKP_OPRF_KEY_ID || undefined,
  validity: Number(process.env.TRIAL_ZKP_VALIDITY || 604800),
  devMode: !process.env.TRIAL_ZKP_LIVE_REQUIRED, // mock passports accepted in test mode
  query: {
    nationalityIn: process.env.TRIAL_NATIONALITY_ALLOWLIST?.split(",").filter(Boolean) || [
      "Venezuela",
      "United States",
      "Australia",
    ],
    minimumAge: 18,
    // Age-band is NATIVE in ZKPassport: pinned here to prove the capability.
    ageBand: process.env.TRIAL_ZKP_AGE_BAND === "on" ? { min: 18, max: 99 } : undefined,
    discloseGender: true,
    facematch: "strict",
  },
};
const zk = new ZkPassportEligibility(
  zkConfig,
  deps,
  zkpassportTransport(zkConfig.zkDomain, { devMode: zkConfig.devMode }),
);

// --- Self Enterprise adapter (baseline; OPTIONAL per D17 — ZKPassport is the
// Stage-1 lock. Enterprise loads only when its env vars are present, in both
// test and live mode. Live mode no longer REQUIRES Enterprise.) ---
let enterprise: EnterpriseEligibility | null = null;
if (process.env.SELF_FLOW_ID && process.env.SELF_API_KEY && process.env.SELF_WEBHOOK_SECRET) {
  const ent: EnterpriseConfig = {
    ...baseConfig,
    flowId: process.env.SELF_FLOW_ID as string,
    flowVersionId: process.env.SELF_FLOW_VERSION_ID as string,
    minimumAge: 18,
  };
  enterprise = new EnterpriseEligibility(
    ent,
    deps,
    enterpriseTransport(process.env.SELF_API_KEY as string, process.env.SELF_WEBHOOK_SECRET as string, ent.environment),
  );
}

// --- Routes ---
// D10 client page (trial-only, not product UI). Served at "/" so the browser
// holds the ZKPassport WebSocket bridge that request() opens client-side.
app.get("/", (_req, res) => {
  // Run via `pnpm --dir apps/backend trial` (cwd = apps/backend). Under the ESM
  // loader the module URL is a data: URL, so anchor on cwd, not __dirname.
  res.type("html").send(readFileSync(join(process.cwd(), "src/trialClient.html"), "utf8"));
});
app.get("/trial/health", (_req, res) => {
  res.json({
    ok: true,
    mode: testMode ? "test" : "live",
    providers: ["zkpassport", enterprise ? "self-enterprise" : null].filter(Boolean),
  });
});

// ZKPassport
app.post("/trial/zkpassport/challenge", (req, res) => {
  try {
    const chal = zk.createChallenge(String(req.body?.account));
    res.json({ challengeId: chal.id, message: chal.message, expiresAt: chal.expiresAt });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.post("/trial/zkpassport/begin", async (req, res) => {
  try {
    const params = await zk.begin(String(req.body?.challengeId), String(req.body?.signature));
    res.json(params); // client uses domain/scope/query to build its own QR via browser SDK
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.post("/trial/zkpassport/receive", async (req, res) => {
  try {
    const outcome = await zk.receiveProof(
      String(req.body?.challengeId),
      String(req.body?.signature),
      req.body?.payload ?? {},
    );
    res.json({ outcome });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.post("/trial/zkpassport/authorize", async (req, res) => {
  try {
    const grant = await zk.authorize(String(req.body?.challengeId), String(req.body?.signature));
    res.json({ authorization: grant.authorization, evidence: grant.evidence });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// Self Enterprise (baseline)
app.post("/trial/self/challenge", (req, res) => {
  if (!enterprise) return res.status(503).json({ error: "SELF_ENTERPRISE_NOT_CONFIGURED" });
  try {
    const chal = enterprise.createChallenge(String(req.body?.account));
    res.json({ challengeId: chal.id, message: chal.message, expiresAt: chal.expiresAt });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.post("/trial/self/begin", async (req, res) => {
  if (!enterprise) return res.status(503).json({ error: "SELF_ENTERPRISE_NOT_CONFIGURED" });
  try {
    const s = await enterprise.begin(String(req.body?.challengeId), String(req.body?.signature));
    res.json(s);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.post("/trial/self/webhook", async (req, res) => {
  if (!enterprise) return res.status(503).json({ error: "SELF_ENTERPRISE_NOT_CONFIGURED" });
  try {
    const outcome = enterprise.receiveWebhook(JSON.stringify(req.body), req.headers as Record<string, string>);
    res.json({ outcome });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
app.post("/trial/self/authorize", async (req, res) => {
  if (!enterprise) return res.status(503).json({ error: "SELF_ENTERPRISE_NOT_CONFIGURED" });
  try {
    const grant = await enterprise.authorize(String(req.body?.challengeId), String(req.body?.signature));
    res.json({ authorization: grant.authorization, evidence: grant.evidence });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`VenekoVox provider-trial server on http://localhost:${PORT} (${testMode ? "TEST" : "LIVE"})`);
  console.log("Providers: zkpassport" + (enterprise ? " + self-enterprise" : " (self disabled)"));
});
