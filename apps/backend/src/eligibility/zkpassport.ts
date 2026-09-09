import {
  EligibilityService,
  type Challenge,
  type Dependencies,
  type EligibilityConfig,
  type VerifiedSelfClaims,
} from "./authorization";

/**
 * ZKPassport eligibility adapter — mirrors EnterpriseEligibility but consumes a
 * client-submitted ZKPassport proof bundle instead of a vendor webhook.
 *
 * Both providers share the SAME candidate issuer-backed authorization boundary:
 * EligibilityService.createChallenge / authorize, the identity-tag HMAC, the
 * EIP-712 Authorization shape and SelfEligibilityPolicy enforcement. Only the
 * "trusted verifier adapter" (verifySelf) differs — Enterprise via a signed
 * webhook, ZKPassport via the real SDK's server-side verify() over the offline-
 * rebuilt canonical query.
 *
 * Flow (does NOT open a websocket bridge server-side):
 *   1. createChallenge(account)                       — same signed-message challenge
 *   2. begin(id, signature)                           — account control first, pins canonical query
 *   3. client builds its own QR via @zkpassport/sdk (browser) with the SAME
 *      domain, scope, validity, devMode and query returned by begin()
 *   4. receiveProof(id, signature, {proofs, originalQuery, queryResult})
 *        — real SDK verify(); canonical query match; attribute checks; minimised claims
 *   5. authorize(id, signature)                       — repeat wallet control; EIP-712 grant
 *
 * This candidate is not wired into app.ts. Run it via the trial server
 * (src/trialServer.ts) with an operator-approved config; do not treat a passing
 * synthetic test as a completed voting journey (see docs/build.md provider-trial).
 */

export interface ZkPassportQueryConfig {
  /** Passport nationality allowlist — the citizenship proxy. Empty => nationality NOT required.
   *  Values MUST be full country names as the SDK expects (e.g. "Venezuela", "Australia"),
   *  matching the exported country constants; ISO codes would build an unsatisfiable query. */
  nationalityIn?: string[];
  /** Inclusive age floor, e.g. 18. */
  minimumAge?: number;
  /** Inclusive age band, e.g. {min:18, max:35}; maps to the SDK range() gate. */
  ageBand?: { min: number; max: number };
  /** Require official document gender disclosure; no self-reported replacement. */
  discloseGender?: boolean;
  /** Strict facematch against the issuing-state chip photo. REQUIRED when
   *  uniqueIdentifierType is "salted" (D17); the canonical query must contain
   *  it or the client query can never match and the SDK rejects salted proofs
   *  produced without strict facematch. */
  facematch?: "strict";
}

export interface ZkPassportConfig extends EligibilityConfig {
  /** Service domain used when building the request; must match the client-side SDK. */
  zkDomain: string;
  /** Scope pinned at request time; drives the unique identifier (nullifier). Frozen in the eligibility manifest. */
  zkScope: string;
  /** Uniqueness mode (D17). "salted" is the Stage-1 lock (NullifierType.SALTED +
   *  facematch strict); "scoped" is the documented fallback that may only be
   *  adopted on a PM decision + new decision record, never a silent mid-poll
   *  flip. Mixed types are rejected at verify. */
  uniqueIdentifierType?: "salted" | "scoped";
  /** Salted-only: OPRF key id forwarded to the SDK (oprfKeyId) for salted
   *  identifiers. Optional; the SDK has a default key. */
  oprfKeyId?: string;
  /** The query the trial pins. The server rebuilds it offline and requires the
   *  client-submitted originalQuery to match exactly. */
  query: ZkPassportQueryConfig;
  /** Proof validity window in seconds (SDK default 604800 = 7 days). */
  validity: number;
  /** Dev mode accepts ZKR mock passports. NOTE: all mock proofs share
   *  uniqueIdentifier "1" (and *_MOCK types), so dev-mode cannot demonstrate
   *  uniqueness/duplicates. */
  devMode: boolean;
  /** Directory for verify() temporary artifacts on restricted-write servers (optional). */
  writingDirectory?: string;
}

export type ZkPassportUniqueIdType = "SALTED" | "NON_SALTED" | "SALTED_MOCK" | "NON_SALTED_MOCK";

export interface ZkPassportVerifyResult {
  uniqueIdentifier?: string;
  /** SDK enum (NON_SALTED | SALTED | *_MOCK); opaque value checked against the
   *  config-pinned uniqueIdentifierType so salted/scoped mixes fail closed. */
  uniqueIdentifierType?: ZkPassportUniqueIdType;
  verified: boolean;
  queryResultErrors?: unknown;
}

export interface ZkPassportVerifyInput {
  proofs: unknown[];
  /** Original query returned by the client's done(). Must equal the canonical rebuilt query. */
  originalQuery: unknown;
  /** Query result arrived with the proofs. */
  queryResult: unknown;
}

export interface ZkPassportTransport {
  /** Offline query reconstruction — never connects to the ZKPassport bridge. */
  buildQuery(cfg: ZkPassportQueryConfig): unknown;
  /** Real SDK proof verification. */
  verify(input: {
    proofs: unknown[];
    originalQuery: unknown;
    queryResult: unknown;
    validity: number;
    scope: string;
    devMode: boolean;
    writingDirectory?: string;
    oprfKeyId?: string;
  }): Promise<ZkPassportVerifyResult>;
}

type Entry = { challenge: Challenge; busy: boolean; begun: boolean; claims?: VerifiedSelfClaims };

const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("ZKPASSPORT_INVALID_PAYLOAD");
  return v as Record<string, unknown>;
};

const HEX_OR_DECIMAL = /^(?:0x[0-9a-fA-F]{1,64}|[0-9]{1,78})$/;

function canonicalNullifier(value: string): string {
  if (typeof value !== "string" || !HEX_OR_DECIMAL.test(value)) throw new Error("INVALID_NULLIFIER");
  const big = BigInt(value.startsWith("0x") ? value : value);
  if (big <= 0n || big >= 1n << 256n) throw new Error("INVALID_NULLIFIER");
  return big.toString();
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a as Record<string, unknown>).sort(),
    kb = Object.keys(b as Record<string, unknown>).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Unmounted single-process candidate. Durable transactional storage is a release gate. */
export class ZkPassportEligibility {
  /** D17 Stage-1 lock; "scoped" is the documented fallback, never the default. */
  private readonly type: "salted" | "scoped";
  private readonly entries = new Map<string, Entry>();
  private readonly service: EligibilityService<string>;
  private readonly now: () => number;
  private readonly canonicalQuery: unknown;
  constructor(
    private readonly config: ZkPassportConfig,
    private readonly deps: Omit<Dependencies<string>, "verifySelf">,
    private readonly transport: ZkPassportTransport,
  ) {
    this.now = deps.now ?? (() => Math.floor(Date.now() / 1000));
    this.type = config.uniqueIdentifierType ?? "salted";
    if (
      !config.zkDomain ||
      !config.zkScope ||
      !Number.isFinite(config.validity) ||
      config.validity <= 0 ||
      typeof config.devMode !== "boolean" ||
      !["salted", "scoped"].includes(this.type)
    )
      throw new Error("INVALID_ZKPASSPORT_CONFIG");
    const ageOk =
      !config.query.minimumAge || (Number.isInteger(config.query.minimumAge) && config.query.minimumAge >= 0);
    const bandOk =
      !config.query.ageBand ||
      (Number.isInteger(config.query.ageBand.min) &&
        Number.isInteger(config.query.ageBand.max) &&
        config.query.ageBand.min <= config.query.ageBand.max);
    if (!ageOk || !bandOk) throw new Error("INVALID_ZKPASSPORT_QUERY");
    // D17: salted uniqueness REQUIRES strict facematch — fail closed at config
    // time rather than discovering it mid-verification.
    if (this.type === "salted" && config.query.facematch !== "strict") throw new Error("INVALID_ZKPASSPORT_QUERY");
    // Salted-only OPRF key must be hex-ish and non-empty when provided.
    if (config.oprfKeyId !== undefined && (typeof config.oprfKeyId !== "string" || config.oprfKeyId.length === 0))
      throw new Error("INVALID_ZKPASSPORT_OPRF_KEY");
    this.canonicalQuery = transport.buildQuery(config.query);
    this.service = new EligibilityService(config, {
      ...deps,
      verifySelf: async (id) => {
        const entry = this.entry(id);
        if (!entry.claims) throw new Error("ZKPASSPORT_NOT_VERIFIED");
        return { ...entry.claims };
      },
    });
  }
  private entry(id: string): Entry {
    const entry = this.entries.get(id);
    if (!entry || entry.challenge.expiresAt <= this.now()) throw new Error("CHALLENGE_EXPIRED_OR_MISSING");
    return entry;
  }
  createChallenge(account: string): Challenge {
    for (const [id, e] of this.entries) if (e.challenge.expiresAt <= this.now()) this.entries.delete(id);
    const challenge = this.service.createChallenge(account);
    this.entries.set(challenge.id, { challenge: { ...challenge }, busy: false, begun: false });
    return challenge;
  }
  /** Account control first. Returns the pinned request parameters the client
   *  must use to build its own QR with the browser SDK. */
  async begin(id: string, signature: string) {
    const entry = this.entry(id);
    if (entry.busy) throw new Error("CHALLENGE_BUSY");
    entry.busy = true;
    try {
      const c = entry.challenge;
      if (!(await this.deps.verifyAccountControl(c.account, c.message, signature)))
        throw new Error("ACCOUNT_CONTROL_FAILED");
      this.entry(id);
      entry.begun = true;
      return {
        domain: this.config.zkDomain,
        scope: this.config.zkScope,
        validity: this.config.validity,
        devMode: this.config.devMode,
        // D17: the client must build its QR with the SAME uniqueness mode the
        // server pins — salted (lock) or scoped (documented fallback). The SDK
        // request() takes uniqueIdentifierType + oprfKeyId from these values.
        uniqueIdentifierType: this.type === "salted" ? "SALTED" : "NON_SALTED",
        ...(this.config.oprfKeyId ? { oprfKeyId: this.config.oprfKeyId } : {}),
        query: this.canonicalQuery,
      };
    } finally {
      entry.busy = false;
    }
  }
  /** Accepts and verifies a client-returned proof bundle. Mirrors the Enterprise
   *  webhook receive: strict context checks, minimal claims, idempotent result. */
  async receiveProof(
    id: string,
    signature: string,
    payload: ZkPassportVerifyInput,
  ): Promise<"accepted" | "duplicate" | "ignored"> {
    const entry = this.entry(id);
    if (entry.busy) throw new Error("CHALLENGE_BUSY");
    entry.busy = true;
    try {
      const c = entry.challenge;
      if (!entry.begun) throw new Error("ZKPASSPORT_SESSION_NOT_STARTED");
      if (!(await this.deps.verifyAccountControl(c.account, c.message, signature)))
        throw new Error("ACCOUNT_CONTROL_FAILED");
      this.entry(id);
      const body = object(payload);
      if (!Array.isArray(body.proofs) || body.proofs.length === 0) throw new Error("ZKPASSPORT_INVALID_PROOFS");
      if (body.originalQuery === undefined || body.queryResult === undefined)
        throw new Error("ZKPASSPORT_INVALID_PAYLOAD");
      // The client may send back the query it built; it MUST equal the canonical
      // server-rebuilt query or verification is meaningless.
      if (!deepEqual(body.originalQuery, this.canonicalQuery)) throw new Error("ZKPASSPORT_QUERY_MISMATCH");
      const result = await this.transport.verify({
        proofs: body.proofs as unknown[],
        originalQuery: this.canonicalQuery,
        queryResult: body.queryResult,
        validity: this.config.validity,
        scope: this.config.zkScope,
        devMode: this.config.devMode,
        ...(this.config.writingDirectory ? { writingDirectory: this.config.writingDirectory } : {}),
        ...(this.config.oprfKeyId ? { oprfKeyId: this.config.oprfKeyId } : {}),
      });
      if (!result.verified || result.uniqueIdentifier === undefined) throw new Error("ZKPASSPORT_VERIFICATION_FAILED");
      // D17 "mix salted ↔ scoped → Reject": the proof's SDK uniqueness type must
      // equal the config-pinned type. Salted config must never consume a scoped
      // proof (or vice versa). *_MOCK types are dev-mode mocks: allowed only
      // when devMode is true, and even then only for the matching type.
      const expectedType: ZkPassportUniqueIdType = this.type === "salted" ? "SALTED" : "NON_SALTED";
      const actualType = result.uniqueIdentifierType;
      const mockOk =
        this.config.devMode && actualType === (expectedType === "SALTED" ? "SALTED_MOCK" : "NON_SALTED_MOCK");
      if (actualType !== expectedType && !mockOk) throw new Error("ZKPASSPORT_UNIQUENESS_TYPE_MISMATCH");
      // Re-check the challenge window AFTER the async verify: a proof that only
      // arrives after expiry must not be consumable (mirrors Enterprise fresh()).
      this.entry(id);
      // Attribute checks on the returned query result — fail closed, no silent fallbacks.
      const queryResult = object(body.queryResult);
      const age = object(queryResult.age ?? {});
      if (this.config.query.minimumAge !== undefined) {
        const gate = object(age.gte ?? {});
        if (gate.result !== true) throw new Error("ZKPASSPORT_AGE_REQUIREMENT_UNMET");
      }
      if (this.config.query.ageBand) {
        const band = object(age.range ?? {});
        if (band.result !== true) throw new Error("ZKPASSPORT_AGE_BAND_UNMET");
      }
      if (this.config.query.nationalityIn?.length) {
        const nat = object(queryResult.nationality ?? {});
        const gate = object(nat.in ?? {});
        if (gate.result !== true) throw new Error("ZKPASSPORT_NATIONALITY_REQUIREMENT_UNMET");
      }
      if (this.config.query.discloseGender) {
        const g = object(queryResult.gender ?? {});
        const gate = object(g.disclose ?? {});
        if (typeof gate.result !== "string" || gate.result === "")
          throw new Error("ZKPASSPORT_GENDER_REQUIREMENT_UNMET");
      }
      const nullifier = canonicalNullifier(result.uniqueIdentifier);
      if (entry.claims) {
        if (entry.claims.nullifier !== nullifier) throw new Error("ZKPASSPORT_CONFLICTING_RESULT");
        return "duplicate";
      }
      // Discard proofs, query result and disclosure payloads; never return/log them.
      entry.claims = { account: c.account, userDefinedData: c.userDefinedData, nullifier };
      return "accepted";
    } finally {
      entry.busy = false;
    }
  }
  authorize(id: string, signature: string) {
    // Ownership is checked again inside EligibilityService.authorize.
    return this.service.authorize(id, signature, id);
  }
}
