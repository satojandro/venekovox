import { BrowserProvider, getAddress } from "ethers";
import type { Eip1193Provider } from "ethers";
import { ENS_CHAIN_ID } from "./pollName";
import { NamingError, type NamingWallet } from "./registration";

type Injected = Eip1193Provider & {
  on?(event: string, listener: () => void): void;
  removeListener?(event: string, listener: () => void): void;
};

/** Explicit user-funded fallback until W1's ENS sponsorship integration is approved. */
export function injectedNamingWallet(ethereum: Injected): NamingWallet & { connect(): Promise<void> } {
  return {
    async connect() {
      if (BigInt(await ethereum.request({ method: "eth_chainId" })) !== ENS_CHAIN_ID)
        throw new NamingError("CONNECT_SEPOLIA");
      await ethereum.request({ method: "eth_requestAccounts" });
    },
    async peek() {
      const [accounts, chain] = await Promise.all([
        ethereum.request({ method: "eth_accounts" }),
        ethereum.request({ method: "eth_chainId" }),
      ]);
      return accounts.length
        ? { kind: "found", account: getAddress(accounts[0]), chainId: BigInt(chain) }
        : { kind: "not-connected" };
    },
    subscribe(listener) {
      for (const event of ["accountsChanged", "chainChanged", "disconnect"]) ethereum.on?.(event, listener);
      return () => {
        for (const event of ["accountsChanged", "chainChanged", "disconnect"])
          ethereum.removeListener?.(event, listener);
      };
    },
    async send(call, context) {
      const provider = new BrowserProvider(ethereum);
      try {
        const [accounts, chain] = await Promise.all([
          ethereum.request({ method: "eth_accounts" }),
          ethereum.request({ method: "eth_chainId" }),
        ]);
        if (!accounts[0] || getAddress(accounts[0]) !== context.account || BigInt(chain) !== context.chainId)
          throw new NamingError("CONTEXT_CHANGED");
        const signer = await provider.getSigner(context.account);
        return (await signer.sendTransaction({ ...call, chainId: context.chainId })).hash;
      } finally {
        provider.destroy();
      }
    },
  };
}
