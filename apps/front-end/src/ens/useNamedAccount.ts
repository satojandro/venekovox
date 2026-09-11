import { useEffect, useState } from "react";
import { JsonRpcProvider } from "ethers";
import { readNamingConfig, readProfileSetup, type NamingConfig } from "./registration";
import type { ProfileSetup } from "./profile";

export function namingEnv(): { registrar: string; rpc: string } {
  const env = import.meta.env as Record<string, string | undefined>;
  return {
    registrar: env.VITE_ENS_REGISTRAR || "",
    rpc: env.VITE_ENS_RPC_URL || env.VITE_PUBLIC_RPC_URL || "",
  };
}

export function namingProvider(): JsonRpcProvider | null {
  const { rpc } = namingEnv();
  if (!rpc) return null;
  return new JsonRpcProvider(rpc, Number(11155111), { staticNetwork: true });
}

export function useNamedAccount(account?: string): {
  configured: boolean;
  loading: boolean;
  error: string;
  config: NamingConfig | null;
  setup: ProfileSetup | null;
  reload: () => void;
} {
  const { registrar } = namingEnv();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<NamingConfig | null>(null);
  const [setup, setSetup] = useState<ProfileSetup | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!registrar || !account) {
      setConfig(null);
      setSetup(null);
      setError("");
      setLoading(false);
      return;
    }
    const provider = namingProvider();
    if (!provider) {
      setError("LOOKUP_FAILED");
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const nextConfig = await readNamingConfig(provider, registrar);
        const nextSetup = await readProfileSetup(provider, nextConfig, account);
        if (!cancelled) {
          setConfig(nextConfig);
          setSetup(nextSetup);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setSetup(null);
          setError(err instanceof Error ? err.message : "LOOKUP_FAILED");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [registrar, account, nonce]);

  return {
    configured: Boolean(registrar),
    loading,
    error,
    config,
    setup,
    reload: () => setNonce((n) => n + 1),
  };
}
