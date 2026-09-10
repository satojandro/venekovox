import { FallbackProvider, JsonRpcProvider } from "ethers";

/**
 * Read-optimized multi-provider for lookups and event scans. Free public RPCs
 * individually flake (rate limits, stripped revert data, transient reverts);
 * FallbackProvider with quorum:1 races/bypasses them — one dead endpoint never
 * fails a call while another answers. Wallet stays for signing only.
 */
export function makeReadProvider(chainId: bigint): FallbackProvider {
  const urls = (import.meta.env.VITE_READ_RPC_URLS as string | undefined)
    ?.split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  const candidates = urls?.length ? urls : [import.meta.env.VITE_PUBLIC_RPC_URL as string].filter(Boolean);
  if (candidates.length === 0) throw new Error("No read RPC configured (VITE_READ_RPC_URLS).");

  return new FallbackProvider(
    candidates.map((url) => ({
      provider: new JsonRpcProvider(url, chainId, { staticNetwork: true }),
      priority: 1,
      stallTimeout: 1500,
      chainId: Number(chainId),
    })),
    chainId,
    { quorum: 1 },
  );
}
