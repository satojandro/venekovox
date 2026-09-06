import {
  EligibilityService,
  type Challenge,
  type Dependencies,
  type EligibilityConfig,
  type VerifiedSelfClaims,
} from "./authorization";

export interface EnterpriseConfig extends EligibilityConfig {
  flowId: string;
  flowVersionId: string;
  /** Candidate policy: age floor, no OFAC, no additional disclosures. Not a global product decision. */
  minimumAge: number;
}
export interface EnterpriseSession {
  id: string;
  externalUuid: string;
  flowVersionId: string;
  verificationUrl: string;
  expiresAt: string;
}
export interface EnterpriseTransport {
  createSession(input: { flowId: string; externalUuid: string; expiresInSeconds: number }): Promise<EnterpriseSession>;
  /** Must use SelfWebhooks.verify on raw bytes. Never JSON.parse or a client claims object. */
  verifyWebhook(raw: string | Buffer, headers: Record<string, string>): unknown;
}
type Entry = { challenge: Challenge; busy: boolean; session?: EnterpriseSession; claims?: VerifiedSelfClaims };
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("ENTERPRISE_INVALID_EVENT");
  return v as Record<string, unknown>;
};

/** Unmounted single-process candidate. A durable transactional session/inbox store is a release gate. */
export class EnterpriseEligibility {
  private readonly entries = new Map<string, Entry>();
  private readonly service: EligibilityService<string>;
  private readonly now: () => number;
  private readonly config: EnterpriseConfig;
  constructor(
    config: EnterpriseConfig,
    private readonly deps: Omit<Dependencies<string>, "verifySelf">,
    private readonly transport: EnterpriseTransport,
  ) {
    this.config = { ...config };
    if (
      !config.flowId ||
      !config.flowVersionId ||
      !Number.isInteger(config.minimumAge) ||
      config.minimumAge < 13 ||
      config.minimumAge > 110
    )
      throw new Error("INVALID_ENTERPRISE_CONFIG");
    this.now = deps.now ?? (() => Math.floor(Date.now() / 1000));
    this.service = new EligibilityService(config, {
      ...deps,
      verifySelf: async (id) => {
        const entry = this.entry(id);
        if (!entry.claims) throw new Error("ENTERPRISE_NOT_VERIFIED");
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
    this.entries.set(challenge.id, { challenge: { ...challenge }, busy: false });
    return challenge;
  }
  async begin(id: string, signature: string): Promise<{ verificationUrl: string; expiresAt: number }> {
    const entry = this.entry(id);
    if (entry.busy) throw new Error("CHALLENGE_BUSY");
    entry.busy = true;
    try {
      if (!(await this.deps.verifyAccountControl(entry.challenge.account, entry.challenge.message, signature)))
        throw new Error("ACCOUNT_CONTROL_FAILED");
      this.entry(id);
      if (!entry.session) {
        const remaining = entry.challenge.expiresAt - this.now();
        if (remaining < 60) throw new Error("RESTART_CHALLENGE");
        // Opaque random challenge ID: do not send wallet, signing message or identity context to Self.
        const session = await this.transport.createSession({
          flowId: this.config.flowId,
          externalUuid: id,
          expiresInSeconds: remaining,
        });
        this.entry(id);
        if (
          session.externalUuid !== id ||
          session.flowVersionId !== this.config.flowVersionId ||
          !session.id ||
          !Number.isFinite(Date.parse(session.expiresAt)) ||
          Date.parse(session.expiresAt) <= this.now() * 1000 ||
          new URL(session.verificationUrl).protocol !== "https:"
        )
          throw new Error("ENTERPRISE_SESSION_MISMATCH");
        entry.session = { ...session };
      }
      return {
        verificationUrl: entry.session.verificationUrl,
        expiresAt: Math.min(entry.challenge.expiresAt, Date.parse(entry.session.expiresAt) / 1000),
      };
    } finally {
      entry.busy = false;
    }
  }
  receiveWebhook(raw: string | Buffer, headers: Record<string, string>): "accepted" | "duplicate" | "ignored" {
    const event = object(this.transport.verifyWebhook(raw, headers));
    if (event.type !== "verification.completed") return "ignored";
    // Strictly match a server-created session and its immutable flow snapshot.
    const entry = this.entry(String(event.external_uuid));
    const session = entry.session;
    if (
      !session ||
      event.verification_id !== session.id ||
      event.flow_id !== this.config.flowId ||
      event.flow_version_id !== this.config.flowVersionId ||
      event.environment !== this.config.environment ||
      (event.verification_mode !== undefined && event.verification_mode !== "backend")
    )
      throw new Error("ENTERPRISE_CONTEXT_MISMATCH");
    if (event.status !== "valid") throw new Error("ENTERPRISE_NOT_ELIGIBLE");
    const attributes = object(event.proof_attributes);
    if (
      event.product !== "age_verification" ||
      attributes.minimumAge !== this.config.minimumAge ||
      (attributes.ofac !== undefined && attributes.ofac !== false) ||
      Object.keys(attributes).some((k) => k !== "minimumAge" && k !== "ofac")
    )
      throw new Error("ENTERPRISE_POLICY_MISMATCH");
    const verifiedAt = typeof event.verified_at === "string" ? Date.parse(event.verified_at) / 1000 : NaN;
    if (
      !Number.isFinite(verifiedAt) ||
      verifiedAt > this.now() + 30 ||
      verifiedAt < entry.challenge.expiresAt - 300 ||
      verifiedAt >= Math.min(entry.challenge.expiresAt, Date.parse(session.expiresAt) / 1000)
    )
      throw new Error("ENTERPRISE_TIME_MISMATCH");
    // Pinned SDK types this as a string; accept canonical integer encodings only, fail closed on a changed format.
    if (typeof event.nullifier !== "string" || !/^(?:0x[0-9a-fA-F]{1,64}|[0-9]{1,78})$/.test(event.nullifier))
      throw new Error("INVALID_NULLIFIER");
    const value = BigInt(event.nullifier);
    if (value <= 0n || value >= 1n << 256n) throw new Error("INVALID_NULLIFIER");
    const nullifier = value.toString();
    if (entry.claims) {
      if (entry.claims.nullifier !== nullifier) throw new Error("ENTERPRISE_CONFLICTING_RESULT");
      return "duplicate";
    }
    // Discard raw proof, attributes, delivery headers and vendor payload; never return/log them.
    entry.claims = { account: entry.challenge.account, userDefinedData: entry.challenge.userDefinedData, nullifier };
    return "accepted";
  }
  authorize(id: string, signature: string) {
    // Ownership is checked again; a webhook or redirect alone never grants a credential.
    return this.service.authorize(id, signature, id);
  }
}
