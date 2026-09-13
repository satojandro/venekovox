import { useEffect, useRef, useState } from "react";
import { FetchRequest, JsonRpcProvider, isAddress } from "ethers";
import { recoverProfile, readNamingConfig } from "../ens/registration";

/**
 * Resolves the optional public ENS name for a connected account.
 * Failures and a missing name return null so voting can continue.
 */
export function useAccountName(account: string | null | undefined) {
  const [name, setName] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const revision = ++generation.current;
    setName(null);
    const registrar = import.meta.env.VITE_ENS_REGISTRAR as string | undefined;
    const maci = import.meta.env.VITE_MACI_ADDRESS as string | undefined;
    const rpc =
      (import.meta.env.VITE_ENS_RPC_URL as string | undefined) ||
      (import.meta.env.VITE_PUBLIC_RPC_URL as string | undefined);
    if (!account || !isAddress(account) || !registrar || !maci || !rpc) return;
    let protocolOk = false;
    try {
      protocolOk = ["http:", "https:"].includes(new URL(rpc).protocol);
    } catch {
      return;
    }
    if (!protocolOk) return;
    const request = new FetchRequest(rpc);
    request.timeout = 15000;
    const provider = new JsonRpcProvider(request);
    (async () => {
      try {
        const config = await readNamingConfig(provider, registrar, maci);
        const restored = await recoverProfile(provider, config, account);
        if (revision === generation.current) setName(restored);
      } catch {
        if (revision === generation.current) setName(null);
      } finally {
        provider.destroy();
      }
    })();
    return () => {
      generation.current++;
      provider.destroy();
    };
  }, [account]);

  return name;
}
