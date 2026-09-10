import { ZKPassport, NullifierType } from "@zkpassport/sdk";
import type { BeginParams } from "./api";

/**
 * Build the ZKPassport deep-link using ONLY server-pinned params.
 *
 * D10 proved three non-negotiable rules:
 * 1. await request() — it is async (opens the WebSocket bridge first).
 * 2. uniqueIdentifierType must be the numeric enum (SALTED=1), not the string "SALTED".
 * 3. Override handleResult and skip browser verify()/onResult — bb.js Worker cannot load.
 */

export interface RelayPayload {
  proofs: unknown[];
  originalQuery: unknown;
  queryResult: unknown;
}

type RelaySdk = {
  handleResult: (topic: string) => Promise<void>;
  topicToProofs?: Record<string, unknown[]>;
  topicToResults?: Record<string, unknown>;
  request: (input: Record<string, unknown>) => Promise<{
    disclose: (field: string) => void;
    gte: (field: string, value: number) => void;
    range: (field: string, min: number, max: number) => void;
    in: (field: string, values: string[]) => void;
    facematch: (mode: string) => void;
    done: () => {
      url: string;
      query: unknown;
      onError?: (cb: (error: { message?: string } | string) => void) => void;
      onReject?: (cb: () => void) => void;
    };
  }>;
};

export async function startZkPassportRequest(
  params: BeginParams,
  onRelayed: (payload: RelayPayload) => void,
  onSdkError: (message: string) => void,
): Promise<{ url: string; query: unknown }> {
  const zk = new ZKPassport(params.domain) as unknown as RelaySdk;
  let originalQuery: unknown;
  zk.handleResult = async (topic: string) => {
    const proofs = zk.topicToProofs?.[topic] || [];
    const result = zk.topicToResults?.[topic];
    if (!proofs.length || !result) {
      onSdkError("Proof payload incomplete (no proofs/result on the SDK instance).");
      return;
    }
    onRelayed({ proofs, originalQuery, queryResult: result });
  };

  const qb = await zk.request({
    name: "VenekoVox Stage 1",
    purpose: "One-person-one-choice eligibility verification",
    scope: params.scope,
    validity: params.validity,
    devMode: params.devMode,
    uniqueIdentifierType: params.uniqueIdentifierType === "SALTED" ? NullifierType.SALTED : NullifierType.NON_SALTED,
    ...(params.oprfKeyId ? { oprfKeyId: params.oprfKeyId } : {}),
  });

  const b = params.queryBuild || {};
  // CHECK primitives
  if (b.minimumAge != null) qb.gte("age", b.minimumAge);
  if (b.nationalityIn?.length) qb.in("nationality", b.nationalityIn);
  // REVEAL opt-ins — one disclosure circuit each on-device. The default Stage-1
  // query carries none of these; ZKP_DISCLOSE_GENDER=on etc. add them.
  if (b.discloseGender) qb.disclose("gender");
  if (b.discloseBirthdate) qb.disclose("birthdate");
  if (b.discloseNationality) qb.disclose("nationality");
  if (b.facematch === "strict") qb.facematch("strict");

  const done = qb.done();
  originalQuery = done.query;
  done.onError?.((error: { message?: string } | string) => {
    const message = typeof error === "string" ? error : error?.message || String(error);
    onSdkError(message);
  });
  done.onReject?.(() => onSdkError("Phone rejected the request."));

  return { url: done.url, query: done.query };
}
