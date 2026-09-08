import { FetchRequest, JsonRpcProvider } from "ethers";

export function readPublicRpcUrl(env: Record<string, string | undefined>): string | null {
  const url = (env.VITE_PUBLIC_RPC_URL || env.VITE_ENS_RPC_URL || "").trim();
  if (!url) return null;
  try {
    if (!["http:", "https:"].includes(new URL(url).protocol)) return null;
  } catch {
    return null;
  }
  return url;
}

export function createReadProvider(rpcUrl: string): JsonRpcProvider {
  const request = new FetchRequest(rpcUrl);
  request.timeout = 15000;
  return new JsonRpcProvider(request);
}
