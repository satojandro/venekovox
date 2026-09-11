import { ensNormalize } from "ethers";

export class NamingError extends Error {
  constructor(
    public readonly code: string,
    public readonly transactionHash?: string,
  ) {
    super(code);
    this.name = "NamingError";
  }
}

/** 3–32 ASCII labels; ENSIP-15 forbids `--` in positions 3–4 (including `xn--`). */
export function normalizeLabel(input: string): string {
  const label = input.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(label)) throw new NamingError("INVALID_LABEL");
  if (label.length >= 4 && label[2] === "-" && label[3] === "-") throw new NamingError("INVALID_LABEL");
  try {
    if (ensNormalize(label) !== label) throw new Error();
  } catch {
    throw new NamingError("INVALID_LABEL");
  }
  return label;
}

const FORBIDDEN_RECORD_KEYS = new Set([
  "xyz.venekovox.status",
  "xyz.venekovox.eligibility",
  "xyz.venekovox.nullifier",
  "xyz.venekovox.passport",
]);

export function assertSafeTextKey(key: string): void {
  if (FORBIDDEN_RECORD_KEYS.has(key) || (key.startsWith("xyz.venekovox.") && key !== "xyz.venekovox.profile-theme")) {
    throw new NamingError("FORBIDDEN_RECORD");
  }
}
