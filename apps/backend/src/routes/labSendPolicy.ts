/**
 * Server-side policy for W1 lab sponsored sends.
 * The env toggle alone is not authorization — callers must present the operator
 * token, and payloads must match the configured probe / chain / selectors / zero value.
 */

export const CALLER_PROBE_SELECTORS = {
  /** keccak256("probe()").slice(0, 4) */
  probe: "0xb74af5a9",
  /** keccak256("alwaysRevert()").slice(0, 4) */
  alwaysRevert: "0x9fb37853",
} as const;

export const ALLOWED_LAB_SELECTORS = [CALLER_PROBE_SELECTORS.probe, CALLER_PROBE_SELECTORS.alwaysRevert] as const;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_DATA_RE = /^0x[0-9a-fA-F]*$/;

export type LabSendPolicyError =
  | "LAB_SEND_DISABLED"
  | "LAB_AUTH_NOT_CONFIGURED"
  | "LAB_UNAUTHORIZED"
  | "LAB_PROBE_NOT_CONFIGURED"
  | "INVALID_TO"
  | "INVALID_DATA"
  | "INVALID_CHAIN"
  | "UNSUPPORTED_CHAIN"
  | "PROBE_MISMATCH"
  | "SELECTOR_NOT_ALLOWED"
  | "NONZERO_VALUE"
  | "PRIVY_LAB_NOT_CONFIGURED";

export interface LabSendEnv {
  allowSponsoredSend?: string | null;
  operatorToken?: string | null;
  probeAddress?: string | null;
  chainId?: string | null;
  privyAppId?: string | null;
  privyAppSecret?: string | null;
  labWalletId?: string | null;
}

export interface LabSendRequest {
  to?: unknown;
  data?: unknown;
  value?: unknown;
  chainId?: unknown;
}

export interface LabSendAuthorization {
  operatorTokenHeader?: string | null;
}

export type LabSendValidation =
  | {
      ok: true;
      to: string;
      data: string;
      value: "0x0";
      chainId: bigint;
      walletId: string;
      appId: string;
      appSecret: string;
    }
  | { ok: false; error_code: LabSendPolicyError; httpStatus: number; message: string };

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function isZeroValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string") return false;
  const hex = value.toLowerCase();
  if (!/^0x[0-9a-f]*$/.test(hex)) return false;
  if (hex === "0x" || hex === "0x0") return true;
  return /^0x0+$/.test(hex);
}

function parseChainId(value: unknown, configured: bigint): { ok: true; chainId: bigint } | { ok: false; error_code: LabSendPolicyError; message: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, chainId: configured };
  }
  let parsed: bigint;
  try {
    if (typeof value === "bigint") parsed = value;
    else if (typeof value === "number" && Number.isInteger(value) && value >= 0) parsed = BigInt(value);
    else if (typeof value === "string" && /^\d+$/.test(value.trim())) parsed = BigInt(value.trim());
    else {
      return { ok: false, error_code: "INVALID_CHAIN", message: "chainId must be a non-negative integer string." };
    }
  } catch {
    return { ok: false, error_code: "INVALID_CHAIN", message: "chainId could not be parsed." };
  }
  if (parsed !== configured) {
    return {
      ok: false,
      error_code: "UNSUPPORTED_CHAIN",
      message: `Only configured lab chain ${configured.toString()} is permitted.`,
    };
  }
  return { ok: true, chainId: parsed };
}

/**
 * Validate operator auth + allowlisted call shape before any Privy RPC.
 * Keep W1_LAB_ALLOW_SPONSORED_SEND off until this policy is satisfied in env.
 */
export function validateLabSponsoredSend(
  env: LabSendEnv,
  auth: LabSendAuthorization,
  body: LabSendRequest,
): LabSendValidation {
  if (env.allowSponsoredSend !== "true") {
    return {
      ok: false,
      error_code: "LAB_SEND_DISABLED",
      httpStatus: 503,
      message: "Set W1_LAB_ALLOW_SPONSORED_SEND=true only after operator auth and allowlists are configured.",
    };
  }

  const operatorToken = env.operatorToken?.trim() ?? "";
  if (!operatorToken) {
    return {
      ok: false,
      error_code: "LAB_AUTH_NOT_CONFIGURED",
      httpStatus: 503,
      message: "Set W1_LAB_OPERATOR_TOKEN on the server. The allow toggle alone is not authorization.",
    };
  }
  const presented = auth.operatorTokenHeader?.trim() ?? "";
  if (!presented || presented !== operatorToken) {
    return {
      ok: false,
      error_code: "LAB_UNAUTHORIZED",
      httpStatus: 401,
      message: "Missing or invalid x-w1-lab-operator-token.",
    };
  }

  const probe = env.probeAddress?.trim() ?? "";
  if (!ADDRESS_RE.test(probe)) {
    return {
      ok: false,
      error_code: "LAB_PROBE_NOT_CONFIGURED",
      httpStatus: 503,
      message: "Set W1_LAB_PROBE_ADDRESS to the deployed CallerProbe.",
    };
  }

  const configuredChainRaw = (env.chainId ?? "11155111").trim();
  if (!/^\d+$/.test(configuredChainRaw)) {
    return {
      ok: false,
      error_code: "INVALID_CHAIN",
      httpStatus: 503,
      message: "W1_LAB_CHAIN_ID must be a decimal chain id.",
    };
  }
  const configuredChain = BigInt(configuredChainRaw);
  const chain = parseChainId(body.chainId, configuredChain);
  if (!chain.ok) {
    return { ok: false, error_code: chain.error_code, httpStatus: 400, message: chain.message };
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!ADDRESS_RE.test(to)) {
    return { ok: false, error_code: "INVALID_TO", httpStatus: 400, message: "to must be a 20-byte hex address." };
  }
  if (normalizeAddress(to) !== normalizeAddress(probe)) {
    return {
      ok: false,
      error_code: "PROBE_MISMATCH",
      httpStatus: 400,
      message: "Lab sends may only target the configured CallerProbe address.",
    };
  }

  const data = typeof body.data === "string" ? body.data.trim() : "0x";
  if (!HEX_DATA_RE.test(data)) {
    return { ok: false, error_code: "INVALID_DATA", httpStatus: 400, message: "data must be hex." };
  }
  // Exact no-arg calldata only (selector + no args).
  const selector = data.length >= 10 ? data.slice(0, 10).toLowerCase() : "";
  const allowed = ALLOWED_LAB_SELECTORS.map((s) => s.toLowerCase());
  if (data.length !== 10 || !allowed.includes(selector)) {
    return {
      ok: false,
      error_code: "SELECTOR_NOT_ALLOWED",
      httpStatus: 400,
      message: "Only CallerProbe.probe() and alwaysRevert() selectors are permitted.",
    };
  }

  if (!isZeroValue(body.value)) {
    return {
      ok: false,
      error_code: "NONZERO_VALUE",
      httpStatus: 400,
      message: "Lab sponsored sends must use value 0x0.",
    };
  }

  const appId = env.privyAppId?.trim() ?? "";
  const appSecret = env.privyAppSecret?.trim() ?? "";
  const walletId = env.labWalletId?.trim() ?? "";
  if (!appId || !appSecret || !walletId) {
    return {
      ok: false,
      error_code: "PRIVY_LAB_NOT_CONFIGURED",
      httpStatus: 503,
      message: "Need PRIVY_APP_ID, PRIVY_APP_SECRET, and W1_LAB_WALLET_ID on the server.",
    };
  }

  return {
    ok: true,
    to: normalizeAddress(to),
    data: "0x" + data.slice(2).toLowerCase(),
    value: "0x0",
    chainId: chain.chainId,
    walletId,
    appId,
    appSecret,
  };
}

export function labSendEnvFromProcess(env: NodeJS.ProcessEnv = process.env): LabSendEnv {
  return {
    allowSponsoredSend: env.W1_LAB_ALLOW_SPONSORED_SEND,
    operatorToken: env.W1_LAB_OPERATOR_TOKEN,
    probeAddress: env.W1_LAB_PROBE_ADDRESS,
    chainId: env.W1_LAB_CHAIN_ID ?? "11155111",
    privyAppId: env.PRIVY_APP_ID,
    privyAppSecret: env.PRIVY_APP_SECRET,
    labWalletId: env.W1_LAB_WALLET_ID,
  };
}
