import { Router, Request, Response } from "express";
import { mapPrivyTransaction, mapPrivyWebhook, isSponsorshipDeniedStatus } from "./privyMap";

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

/**
 * GET /w1/transactions/:transactionId
 *
 * Server-side Privy status lookup. The App Secret never enters the Vite bundle.
 * A missing credential is a blocked experiment (E1), not a client-side retry loop.
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
    if (isSponsorshipDeniedStatus(response.status)) {
      return res.status(200).json({
        status: "ok",
        vendorLookup: "ok",
        vendor: { transactionId, phase: "denied", userOperationHash: null, transactionHash: null },
      });
    }
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
