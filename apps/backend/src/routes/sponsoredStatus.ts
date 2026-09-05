import { Router, type Request, type Response } from "express";
import { mapPrivyTransaction, mapPrivyWebhook, isSponsorshipDeniedSendStatus } from "./privyMap";
import { labSendEnvFromProcess, validateLabSponsoredSend } from "./labSendPolicy";

const router: import("express").Router = Router();

type StoredView = NonNullable<ReturnType<typeof mapPrivyTransaction>>;
const cache = new Map<string, StoredView>();

function privyCredentials(): { appId: string; appSecret: string } | null {
  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

function basicAuth(appId: string, appSecret: string): string {
  return Buffer.from(`${appId}:${appSecret}`).toString("base64");
}

function caip2ForChain(chainId: bigint | number | string): string {
  return `eip155:${chainId.toString()}`;
}

/**
 * GET /w1/transactions/:transactionId
 *
 * Server-side Privy status lookup. The App Secret never enters the Vite bundle.
 * A missing credential is a blocked experiment (E1), not a client-side retry loop.
 * HTTP 400/402/403 on *status lookup* are unavailable — they do not prove sponsorship
 * was denied for a send that already returned a transaction_id.
 */
router.get("/transactions/:transactionId", async (req: Request, res: Response) => {
  const transactionId = req.params.transactionId;
  if (!transactionId || transactionId.length > 128) {
    return res.status(400).json({ status: "error", error_code: "INVALID_TRANSACTION_ID" });
  }

  const creds = privyCredentials();
  if (!creds) {
    return res.status(503).json({
      status: "blocked",
      error_code: "PRIVY_NOT_CONFIGURED",
      message: "E1 is not done: PRIVY_APP_ID / PRIVY_APP_SECRET are unset. Do not put them in VITE_ env vars.",
    });
  }

  const cached = cache.get(transactionId);
  try {
    const response = await fetch(`https://api.privy.io/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: {
        Authorization: `Basic ${basicAuth(creds.appId, creds.appSecret)}`,
        "privy-app-id": creds.appId,
      },
    });
    if (response.status === 404) {
      return res.json({
        status: "ok",
        vendorLookup: "missing",
        vendor: cached ?? null,
      });
    }
    if (!response.ok) {
      return res.status(502).json({
        status: "error",
        vendorLookup: "error",
        error_code: "PRIVY_STATUS_UNAVAILABLE",
        httpStatus: response.status,
        vendor: cached ?? null,
      });
    }
    const body = (await response.json()) as Record<string, unknown>;
    const vendor = mapPrivyTransaction({
      id: typeof body.id === "string" ? body.id : undefined,
      transaction_id: transactionId,
      status: typeof body.status === "string" ? body.status : undefined,
      transaction_hash: typeof body.transaction_hash === "string" ? body.transaction_hash : null,
      user_operation_hash: typeof body.user_operation_hash === "string" ? body.user_operation_hash : null,
    });
    if (vendor) cache.set(transactionId, vendor);
    return res.json({ status: "ok", vendorLookup: "ok", vendor });
  } catch {
    return res.status(502).json({
      status: "error",
      vendorLookup: "error",
      error_code: "PRIVY_STATUS_UNAVAILABLE",
      vendor: cached ?? null,
    });
  }
});

/**
 * POST /w1/lab/sponsored-send
 *
 * Lab-only Privy sponsored eth_sendTransaction. Production voting must not use this.
 * Requires operator token + allowlisted probe/chain/selectors/zero value. The env
 * toggle alone is not authorization.
 */
router.post("/lab/sponsored-send", async (req: Request, res: Response) => {
  try {
    const validated = validateLabSponsoredSend(
      labSendEnvFromProcess(),
      { operatorTokenHeader: req.get("x-w1-lab-operator-token") },
      req.body ?? {},
    );
    if (!validated.ok) {
      return res.status(validated.httpStatus).json({
        status: validated.httpStatus >= 500 ? "blocked" : "error",
        error_code: validated.error_code,
        message: validated.message,
      });
    }

    const response = await fetch(`https://api.privy.io/v1/wallets/${encodeURIComponent(validated.walletId)}/rpc`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth(validated.appId, validated.appSecret)}`,
        "privy-app-id": validated.appId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "eth_sendTransaction",
        caip2: caip2ForChain(validated.chainId),
        sponsor: true,
        params: {
          transaction: { to: validated.to, data: validated.data, value: validated.value },
        },
      }),
    });

    if (isSponsorshipDeniedSendStatus(response.status)) {
      return res.status(200).json({
        status: "ok",
        vendorLookup: "ok",
        vendor: {
          transactionId: `denied-${Date.now()}`,
          phase: "denied",
          userOperationHash: null,
          transactionHash: null,
        },
        httpStatus: response.status,
      });
    }

    if (!response.ok) {
      let detail: unknown = null;
      try {
        detail = await response.json();
      } catch {
        detail = null;
      }
      return res.status(502).json({
        status: "error",
        vendorLookup: "error",
        error_code: "PRIVY_SEND_FAILED",
        httpStatus: response.status,
        detail,
      });
    }

    const rpcBody = (await response.json()) as Record<string, unknown>;
    const dataObj = (typeof rpcBody.data === "object" && rpcBody.data !== null ? rpcBody.data : rpcBody) as Record<
      string,
      unknown
    >;
    const transactionId =
      (typeof dataObj.transaction_id === "string" && dataObj.transaction_id) ||
      (typeof rpcBody.transaction_id === "string" && rpcBody.transaction_id) ||
      null;
    const userOperationHash =
      (typeof dataObj.user_operation_hash === "string" && dataObj.user_operation_hash) ||
      (typeof rpcBody.user_operation_hash === "string" && rpcBody.user_operation_hash) ||
      null;
    const transactionHash =
      (typeof dataObj.transaction_hash === "string" && dataObj.transaction_hash) ||
      (typeof dataObj.hash === "string" && dataObj.hash) ||
      (typeof rpcBody.hash === "string" && rpcBody.hash) ||
      null;

    if (!transactionId) {
      return res.status(502).json({
        status: "error",
        vendorLookup: "error",
        error_code: "PRIVY_SEND_MISSING_IDS",
        raw: rpcBody,
      });
    }

    const vendor = {
      transactionId,
      phase: "pending" as const,
      userOperationHash,
      transactionHash: transactionHash && transactionHash.length > 2 ? transactionHash : null,
    };
    cache.set(transactionId, vendor);
    return res.json({ status: "ok", vendorLookup: "ok", vendor });
  } catch {
    return res.status(502).json({
      status: "error",
      vendorLookup: "error",
      error_code: "PRIVY_SEND_UNAVAILABLE",
    });
  }
});

/**
 * POST /w1/webhooks/privy
 *
 * Optional webhook receiver for E3/E4. Stores only ids + status, never secrets.
 */
router.post("/webhooks/privy", (req: Request, res: Response) => {
  const expected = process.env.W1_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return res.status(503).json({
      status: "blocked",
      error_code: "WEBHOOK_NOT_CONFIGURED",
      message: "Set W1_WEBHOOK_SECRET on the server before accepting vendor webhooks.",
    });
  }
  const got = req.get("x-w1-webhook-secret") || "";
  if (got !== expected) {
    return res.status(401).json({ status: "error", error_code: "WEBHOOK_UNAUTHORIZED" });
  }
  const vendor = mapPrivyWebhook(req.body);
  if (!vendor) {
    return res.status(400).json({ status: "error", error_code: "INVALID_WEBHOOK" });
  }
  cache.set(vendor.transactionId, vendor);
  return res.json({ status: "ok", vendor });
});

export default router;
