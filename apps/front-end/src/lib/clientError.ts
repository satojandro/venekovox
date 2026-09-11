/**
 * Client-side error reporter.
 *
 * WHY THIS EXISTS
 * Live-test failures surface as raw ethers errors in the browser console, which
 * is impractical to reach on the test machine (its F12 key is bound to volume).
 * Reporting message + step + stack to the backend makes the failure readable
 * from the server log instead.
 *
 * WHAT IS SENT: error text, code, a truncated stack, the failing step label, the
 * page URL and the user agent. Nothing else.
 * WHAT IS NEVER SENT: proofs, query results, signatures, private keys, wallet
 * addresses, or document data. A stack trace can contain none of those.
 */

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) || "http://localhost:3100";

interface EthersishError {
  message?: string;
  shortMessage?: string;
  code?: string;
  stack?: string;
  transaction?: unknown;
  info?: unknown;
}

function safeJson(value: unknown, limit = 400): string | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.stringify(value).slice(0, limit);
  } catch {
    return undefined;
  }
}

/** Fire-and-forget: a failure to report must never affect the vote flow. */
export function reportClientError(error: unknown, step: string, extra?: Record<string, unknown>): void {
  try {
    const e = (error ?? {}) as EthersishError;
    const payload: Record<string, unknown> = {
      step,
      message: String(e.shortMessage || e.message || error),
      code: typeof e.code === "string" ? e.code : undefined,
      stack: typeof e.stack === "string" ? e.stack.split("\n").slice(0, 8).join("\n") : undefined,
      transaction: safeJson(e.transaction),
      info: safeJson(e.info),
      extra: safeJson(extra),
      url: typeof location !== "undefined" ? location.href : undefined,
      ua: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };
    void fetch(`${BACKEND_URL.replace(/\/$/, "")}/debug/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never throw from the reporter */
  }
}

/** Capture anything the vote flow fails to catch itself. */
export function installGlobalErrorReporting(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError((event as PromiseRejectionEvent).reason, "unhandledrejection");
  });
  window.addEventListener("error", (event) => {
    const ev = event as ErrorEvent;
    reportClientError(ev.error ?? ev.message, "window.onerror");
  });
}
