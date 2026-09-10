import { createHmac, randomBytes } from "node:crypto";
import { AbiCoder, getAddress, ZeroAddress } from "ethers";

export const AUTHORIZATION_TYPES = {
  Authorization: [
    { name: "account", type: "address" },
    { name: "target", type: "address" },
    { name: "identityTag", type: "bytes32" },
    { name: "configId", type: "bytes32" },
    { name: "action", type: "bytes32" },
    { name: "nonce", type: "bytes32" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
  ],
};
export interface EligibilityConfig {
  chainId: bigint;
  policyAddress: string;
  target: string;
  configId: string;
  action: string;
  /** Stable operator namespace for this Self organization; never a session or wallet ID. */
  identityNamespace: string;
  environment: "test" | "live";
}
export interface Authorization {
  account: string;
  target: string;
  identityTag: string;
  configId: string;
  action: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}
export interface Challenge {
  id: string;
  account: string;
  message: string;
  userDefinedData: string;
  expiresAt: number;
}
/** Output of a trusted verifier adapter, never a request-body type. */
export interface VerifiedSelfClaims {
  account: string;
  userDefinedData: string;
  nullifier: string;
}
export interface SignedAuthorization {
  authorization: Authorization;
  signature: string;
  evidence: string;
}
export interface Dependencies<Proof> {
  verifyAccountControl(account: string, message: string, signature: string): Promise<boolean>;
  verifySelf(proof: Proof): Promise<VerifiedSelfClaims>;
  sign(
    domain: ReturnType<typeof authorizationDomain>,
    types: typeof AUTHORIZATION_TYPES,
    value: Authorization,
  ): Promise<string>;
  /** Dedicated stable server secret, NOT a wallet private key; injected by operator. */
  identityTagSecret: Uint8Array;
  now?: () => number;
}
const HASH = /^0x[\da-f]{64}$/i;

/**
 * Must stay ≤ SelfEligibilityPolicy.MAX_LIFETIME (15 minutes / 900s).
 * A longer grant reverts InvalidLifetime at enforce(), independent of RPC health.
 */
export const MAX_GRANT_LIFETIME_SECONDS = 900;
/** Default grant window: policy max. Issued at authorize(), consumed at join. */
export const DEFAULT_GRANT_LIFETIME_SECONDS = MAX_GRANT_LIFETIME_SECONDS;

/** Resolve and validate grant lifetime. Env override must be a positive integer ≤ policy cap. */
export function resolveGrantLifetimeSeconds(
  raw: string | undefined = process.env.ELIGIBILITY_GRANT_VALIDITY_SECONDS,
): number {
  if (raw === undefined || raw === "") return DEFAULT_GRANT_LIFETIME_SECONDS;
  // Reject scientific notation / floats: only plain decimal integers.
  if (!/^\d+$/.test(raw)) throw new Error("INVALID_GRANT_LIFETIME");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_GRANT_LIFETIME_SECONDS) {
    throw new Error("INVALID_GRANT_LIFETIME");
  }
  return value;
}

export function authorizationDomain(c: EligibilityConfig) {
  return { name: "VenekoVox Self Eligibility", version: "1", chainId: c.chainId, verifyingContract: c.policyAddress };
}
export function encodeAuthorization(a: Authorization, signature: string): string {
  return AbiCoder.defaultAbiCoder().encode(
    [
      "tuple(address account,address target,bytes32 identityTag,bytes32 configId,bytes32 action,bytes32 nonce,uint64 issuedAt,uint64 expiresAt)",
      "bytes",
    ],
    [a, signature],
  );
}
function accountAddress(value: string): string {
  const address = getAddress(value);
  if (address === ZeroAddress) throw new Error("INVALID_ACCOUNT");
  return address;
}

/** Candidate service. Not mounted in app.ts. Single-process bounded challenge store only.
 * Production mounting requires durable/idempotent sessions, transport auth/rate limits,
 * live Self/W1 tests and operator approval of the issuer trust model.
 */
export class EligibilityService<Proof> {
  private readonly sessions = new Map<string, { challenge: Challenge; busy: boolean; issued?: SignedAuthorization }>();
  private readonly config: EligibilityConfig;
  private readonly now: () => number;
  private readonly tagSecret: Buffer;
  /** Seconds from issuedAt → expiresAt. Capped at policy MAX_LIFETIME. */
  private readonly grantLifetimeSeconds: number;

  constructor(
    config: EligibilityConfig,
    private readonly deps: Dependencies<Proof>,
  ) {
    this.config = {
      ...config,
      policyAddress: accountAddress(config.policyAddress),
      target: accountAddress(config.target),
    };
    if (
      config.chainId <= 0n ||
      !HASH.test(config.configId) ||
      !HASH.test(config.action) ||
      BigInt(config.configId) === 0n ||
      BigInt(config.action) === 0n ||
      !config.identityNamespace ||
      !["test", "live"].includes(config.environment) ||
      deps.identityTagSecret.byteLength < 32
    )
      throw new Error("INVALID_CONFIG");
    this.now = deps.now ?? (() => Math.floor(Date.now() / 1000));
    this.tagSecret = Buffer.from(deps.identityTagSecret);
    // Challenge (300s) gates the passport scan. The GRANT is issued after that
    // scan succeeds and must fit SelfEligibilityPolicy.MAX_LIFETIME (900s).
    // Do not inherit the challenge clock, and never exceed the on-chain cap.
    this.grantLifetimeSeconds = resolveGrantLifetimeSeconds();
  }
  createChallenge(account: string): Challenge {
    const normalized = accountAddress(account);
    const now = this.now();
    for (const [id, s] of this.sessions) if (s.challenge.expiresAt <= now) this.sessions.delete(id);
    if (this.sessions.size >= 500) throw new Error("CHALLENGE_CAPACITY");
    const id = "0x" + randomBytes(32).toString("hex");
    const context = JSON.stringify({
      version: 1,
      purpose: "venekovox-eligibility",
      chainId: this.config.chainId.toString(),
      policy: this.config.policyAddress,
      target: this.config.target,
      configId: this.config.configId,
      action: this.config.action,
      account: normalized,
      nonce: id,
      expiresAt: now + 300,
      identityNamespace: this.config.identityNamespace,
      environment: this.config.environment,
    });
    const challenge = {
      id,
      account: normalized,
      expiresAt: now + 300,
      message: "Authorize VenekoVox eligibility verification (not a vote):\n" + context,
      // Internal context comparison, not a Self Pass QR field.
      userDefinedData: Buffer.from(context, "utf8").toString("hex"),
    };
    this.sessions.set(id, { challenge, busy: false });
    return { ...challenge };
  }
  async authorize(id: string, accountSignature: string, proof: Proof): Promise<SignedAuthorization> {
    const session = this.sessions.get(id);
    if (!session || session.challenge.expiresAt <= this.now()) throw new Error("CHALLENGE_EXPIRED_OR_MISSING");
    if (session.busy) throw new Error("CHALLENGE_BUSY");
    session.busy = true;
    const fresh = () => {
      if (session.challenge.expiresAt <= this.now()) throw new Error("CHALLENGE_EXPIRED");
    };
    try {
      const c = session.challenge;
      if (!(await this.deps.verifyAccountControl(c.account, c.message, accountSignature)))
        throw new Error("ACCOUNT_CONTROL_FAILED");
      fresh();
      if (session.issued) return structuredClone(session.issued);
      const verified = await this.deps.verifySelf(proof);
      fresh();
      if (accountAddress(verified.account) !== c.account || verified.userDefinedData !== c.userDefinedData)
        throw new Error("SELF_CONTEXT_MISMATCH");
      // Canonical decimal identity signal; equivalent encodings must not create new tags.
      if (
        !/^\d+$/.test(verified.nullifier) ||
        BigInt(verified.nullifier) <= 0n ||
        BigInt(verified.nullifier) >= 1n << 256n
      )
        throw new Error("INVALID_NULLIFIER");
      const domain = authorizationDomain(this.config);
      const tagInput = JSON.stringify([
        "venekovox-self-tag-v1",
        this.config.identityNamespace,
        this.config.environment,
        this.config.chainId.toString(),
        this.config.policyAddress.toLowerCase(),
        this.config.target.toLowerCase(),
        this.config.configId.toLowerCase(),
        this.config.action.toLowerCase(),
        BigInt(verified.nullifier).toString(),
      ]);
      const identityTag = "0x" + createHmac("sha256", this.tagSecret).update(tagInput).digest("hex");
      const issuedAt = this.now();
      const authorization = {
        account: c.account,
        target: this.config.target,
        identityTag,
        configId: this.config.configId,
        action: this.config.action,
        nonce: c.id,
        issuedAt,
        // Independent of the 300s challenge window; ≤ policy MAX_LIFETIME.
        expiresAt: issuedAt + this.grantLifetimeSeconds,
      };
      const signature = await this.deps.sign(domain, AUTHORIZATION_TYPES, authorization);
      fresh();
      const result = { authorization, signature, evidence: encodeAuthorization(authorization, signature) };
      session.issued = structuredClone(result);
      return result;
    } finally {
      session.busy = false;
    }
  }
}
