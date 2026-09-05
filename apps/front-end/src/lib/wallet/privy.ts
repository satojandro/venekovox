// Privy is D06's first experiment, not a shipped adapter.
// The sketches in the vendor report (EIP-1193 → transport.request) are untested
// and must not be copied into production. A user-funded ethers signer does not
// prove that `sponsor: true` / user-op logic runs through the same object.

import { WalletAdapterNotApprovedError, type WalletAdapter } from "./adapter";

export function createPrivyAdapter(): WalletAdapter {
  throw new WalletAdapterNotApprovedError(
    "Privy adapter is gated on W1 E1–E6 evidence. Do not wrap eth_sendTransaction and call it sponsorship.",
  );
}
