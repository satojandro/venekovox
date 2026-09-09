import express, { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import type { ZkPassportEligibility } from "../eligibility/zkpassport";
import type { SessionStore } from "../eligibility/sessionStore";

/**
 * Product eligibility HTTP surface. Mounted at /eligibility from app.ts.
 *
 * The adapter (ZkPassportEligibility) is the source of truth for challenges,
 * busy locks and claims. This router only translates HTTP ⇄ that API.
 * Never log proofs, query results or uniqueIdentifier values — status codes only.
 */

export interface EligibilityRouterOptions {
  service: ZkPassportEligibility;
  sessions: SessionStore;
  mode: "test" | "live";
  /** Tests set this false so they can drive negatives without 429s. */
  rateLimit?: boolean;
}

function clientError(res: Response, error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : "ELIGIBILITY_ERROR";
  return res.status(status).json({ error: message });
}

function busyOrCapacity(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message === "CHALLENGE_CAPACITY") return 429;
  if (message === "CHALLENGE_BUSY") return 409;
  return 400;
}

export function createEligibilityRouter(options: EligibilityRouterOptions): express.Router {
  const { service, sessions, mode } = options;
  const limiter =
    options.rateLimit === false
      ? (_req: Request, _res: Response, next: NextFunction) => next()
      : rateLimit({
          windowMs: 60_000,
          limit: 20,
          standardHeaders: true,
          legacyHeaders: false,
          message: { error: "RATE_LIMITED" },
        });

  const router: express.Router = express.Router();

  router.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true, mode, provider: "zkpassport" });
  });

  router.post("/challenge", limiter, (req: Request, res: Response) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      sessions.prune(now);
      const challenge = service.createChallenge(String(req.body?.account));
      sessions.set({ challengeId: challenge.id, account: challenge.account, expiresAt: challenge.expiresAt });
      res.json({ challengeId: challenge.id, message: challenge.message, expiresAt: challenge.expiresAt });
    } catch (error) {
      clientError(res, error, busyOrCapacity(error));
    }
  });

  router.post("/begin", limiter, async (req: Request, res: Response) => {
    try {
      const params = await service.begin(String(req.body?.challengeId), String(req.body?.signature));
      res.json(params);
    } catch (error) {
      clientError(res, error, busyOrCapacity(error));
    }
  });

  router.post("/receive", async (req: Request, res: Response) => {
    try {
      const outcome = await service.receiveProof(
        String(req.body?.challengeId),
        String(req.body?.signature),
        req.body?.payload ?? {},
      );
      res.json({ outcome });
    } catch (error) {
      clientError(res, error, busyOrCapacity(error));
    }
  });

  router.post("/authorize", async (req: Request, res: Response) => {
    try {
      const grant = await service.authorize(String(req.body?.challengeId), String(req.body?.signature));
      res.json({
        authorization: grant.authorization,
        signature: grant.signature,
        evidence: grant.evidence,
      });
    } catch (error) {
      clientError(res, error, busyOrCapacity(error));
    }
  });

  return router;
}
