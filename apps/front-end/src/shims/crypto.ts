/**
 * Browser shim for Node's `crypto` builtin — only what the MACI packages use
 * at key-generation time: `randomBytes(n).toString("hex")` (packages/crypto
 * keys.ts / babyjub.ts). Everything routes through window.crypto.getRandomValues.
 */

class RandomBytes extends Uint8Array {
  toString(encoding?: string): string {
    if (encoding === "hex" || encoding === undefined) {
      return Array.from(this, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    throw new Error(`crypto shim: unsupported encoding "${encoding}"`);
  }
}

export function randomBytes(size: number): RandomBytes {
  const bytes = new RandomBytes(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export default { randomBytes };
