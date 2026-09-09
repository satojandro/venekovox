/** Browser client for the product /eligibility routes. Status codes only — no proofs in logs. */

export function backendUrl(): string {
  return String(import.meta.env.VITE_BACKEND_URL || "http://localhost:3100").replace(/\/$/, "");
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${backendUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
  return json as T;
}

export interface ChallengeResponse {
  challengeId: string;
  message: string;
  expiresAt: number;
}

export interface BeginParams {
  domain: string;
  scope: string;
  validity: number;
  devMode: boolean;
  uniqueIdentifierType: "SALTED" | "NON_SALTED";
  oprfKeyId?: string;
  query: unknown;
  queryBuild: {
    discloseGender?: boolean;
    minimumAge?: number;
    ageBand?: { min: number; max: number };
    nationalityIn?: string[];
    facematch?: "strict";
  };
}

export interface AuthorizeResponse {
  authorization: {
    account: string;
    issuedAt: number;
    expiresAt: number;
  };
  signature: string;
  evidence: string;
}

export const eligibilityApi = {
  challenge: (account: string) => post<ChallengeResponse>("/eligibility/challenge", { account }),
  begin: (challengeId: string, signature: string) =>
    post<BeginParams>("/eligibility/begin", { challengeId, signature }),
  receive: (
    challengeId: string,
    signature: string,
    payload: { proofs: unknown; originalQuery: unknown; queryResult: unknown },
  ) => post<{ outcome: string }>("/eligibility/receive", { challengeId, signature, payload }),
  authorize: (challengeId: string, signature: string) =>
    post<AuthorizeResponse>("/eligibility/authorize", { challengeId, signature }),
};
