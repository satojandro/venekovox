// WalletAdapter is the W1 seam. Today only the injected (user-funded) path is
// proven. A sponsored adapter may be sketched, but must not be wired into voting
// until E1–E6 in docs/w1-experiment.md pass with evidence.
//
// Important vocabulary:
// - Participating account = the address MACI/policy contracts will see as msg.sender.
// - Outer transaction = the bundled/relayed tx on chain (from/to may be a bundler
//   and an EntryPoint, not the participant and not the Poll).
// - User operation = the inner call the user actually intended.
//
// EIP-7702 (assigning code to an existing EOA) and ERC-4337 (bundled execution)
// are not mutually exclusive. Delegation persists until changed or cleared.

import type { JsonRpcSigner } from "ethers";

export type WalletKind = "injected" | "embedded";

export type WalletPeek =
  | { kind: "no-provider" }
  | { kind: "not-connected" }
  | { kind: "error" }
  | { kind: "found"; account: string; chainId: bigint };

export interface SponsoredCall {
  to: string;
  data: string;
  value?: bigint;
}

/**
 * Durable identifiers for a sponsored submission. Persist these immediately
 * after broadcast. A transaction hash may arrive later (or never, if the
 * user-op reverts inside a successful bundle).
 */
export interface SponsoredHandle {
  transactionId: string;
  userOperationHash?: string;
  /** Outer bundle hash. Empty until the vendor reports on-chain inclusion. */
  transactionHash?: string;
}

export interface WalletAdapter {
  readonly kind: WalletKind;
  peek(): Promise<WalletPeek>;
  connect(expectedChainId: bigint): Promise<{ account: string; chainId: bigint; signer: JsonRpcSigner }>;
  subscribe(listener: () => void): () => void;
  /**
   * User-funded ethers signer. This is the proven P1 path for injected wallets.
   * It is NOT proof that sponsorship works through the same object.
   */
  getUserFundedSigner(expectedChainId: bigint): Promise<JsonRpcSigner>;
  /**
   * Explicit sponsored send. Adapters that cannot sponsor MUST throw rather than
   * silently spending the user's ETH. A working user-funded signer does not
   * implement this by wrapping eth_sendTransaction.
   */
  sendSponsored?(call: SponsoredCall): Promise<SponsoredHandle>;
}

export class SponsorshipUnavailableError extends Error {
  readonly code = "sponsorship-unavailable";
  constructor(message: string) {
    super(message);
    this.name = "SponsorshipUnavailableError";
  }
}

export class WalletAdapterNotApprovedError extends Error {
  readonly code = "wallet-adapter-not-approved";
  constructor(message: string) {
    super(message);
    this.name = "WalletAdapterNotApprovedError";
  }
}

/**
 * Gate the wallet source. Privy is the first experiment (D06 provisional), not
 * an approved execution stack. The injected path is the one-line fallback.
 */
export function selectWalletKind(source: string | undefined): "injected" {
  const normalized = (source ?? "injected").trim().toLowerCase();
  if (normalized === "injected" || normalized === "") return "injected";
  throw new WalletAdapterNotApprovedError(
    "Privy sponsored execution is not approved. Run the W1 experiment in docs/w1-experiment.md (E1–E6) before wiring an adapter. D06 stays provisional. Keep the injected wallet fallback.",
  );
}
