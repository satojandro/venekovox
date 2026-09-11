import express, { type Request, type Response } from "express";
import { appendFileSync } from "node:fs";

/**
 * Debug intake for client-side errors.
 *
 * WHY THIS EXISTS
 * The live-test failure surfaces as a raw ethers error in a browser console that
 * is impractical to reach on the test machine (its F12 key is bound to volume).
 * Routing the message + step + stack to the backend makes the failure readable
 * from the server log instead of the devtools.
 *
 * SAFETY
 * The client reporter sends ONLY message/code/stack/step/url/ua — never proofs,
 * signatures, private keys or query results. Everything is scrubbed again and
 * truncated here so a future caller cannot accidentally persist a secret:
 *   - long 0x blobs (>= 200 hex chars) are proof-sized -> masked
 *   - bare 64-char hex tokens (private keys / digests) -> masked
 * Short calldata (selector + one word, e.g. getPoll(1)) is deliberately KEPT:
 * it is the single most useful diagnostic here.
 */

const LOG_PATH = "/tmp/venekovox-client-errors.log";
const MAX_FIELD = 1200;

function scrub(value: unknown): string {
  return String(value ?? "")
    .replace(/0x[0-9a-fA-F]{200,}/g, (m) => `<redacted-0x-blob:${m.length}>`)
    .replace(/(?<!0x)\b[0-9a-fA-F]{64}\b/g, "<redacted-64hex>")
    .slice(0, MAX_FIELD);
}

export function createDebugRouter(mode: "test" | "live"): express.Router {
  const router: express.Router = express.Router();

  router.post("/client-error", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const entry = {
      at: new Date().toISOString(),
      mode,
      step: scrub(body.step),
      code: scrub(body.code),
      message: scrub(body.message),
      transaction: scrub(body.transaction),
      info: scrub(body.info),
      url: scrub(body.url),
      stack: scrub(body.stack),
    };
    const line = `${JSON.stringify(entry)}\n`;
    // Server log first: it is the channel that is actually being watched.
    console.log(`[client-error] ${line.trim()}`);
    try {
      appendFileSync(LOG_PATH, line, "utf8");
    } catch {
      /* logging must never fail the request */
    }
    res.status(204).end();
  });

  return router;
}

export const CLIENT_ERROR_LOG_PATH = LOG_PATH;
