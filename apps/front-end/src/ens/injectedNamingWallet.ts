import { getAddress } from "ethers";
import type { NamingContext, NamingWallet } from "./registration";
import { NamingError } from "./labels";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

function injected(): EthereumProvider | undefined {
  const ethereum = (globalThis as { ethereum?: EthereumProvider }).ethereum;
  return ethereum;
}

export function createInjectedNamingWallet(): NamingWallet {
  return {
    async peek() {
      const ethereum = injected();
      if (!ethereum) return { kind: "missing" };
      try {
        const [chainHex, accounts] = await Promise.all([
          ethereum.request({ method: "eth_chainId" }),
          ethereum.request({ method: "eth_accounts" }),
        ]);
        const chainId = BigInt(String(chainHex));
        const account = Array.isArray(accounts) && accounts[0] ? getAddress(String(accounts[0])) : undefined;
        return { kind: "injected", account, chainId };
      } catch {
        return { kind: "injected" };
      }
    },
    async send(call, context: NamingContext) {
      const ethereum = injected();
      if (!ethereum) throw new NamingError("WALLET_MISSING");
      const [chainHex, accounts] = await Promise.all([
        ethereum.request({ method: "eth_chainId" }),
        ethereum.request({ method: "eth_accounts" }),
      ]);
      const chainId = BigInt(String(chainHex));
      const account = Array.isArray(accounts) && accounts[0] ? getAddress(String(accounts[0])) : undefined;
      if (!account || account !== getAddress(context.account) || chainId !== context.chainId) {
        throw new NamingError("CONTEXT_CHANGED");
      }
      const hash = await ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: account,
            to: call.to,
            data: call.data,
            value: "0x" + call.value.toString(16),
          },
        ],
      });
      return String(hash);
    },
    subscribe(listener) {
      const ethereum = injected();
      if (!ethereum?.on) return () => undefined;
      const wrapped = () => listener();
      ethereum.on("accountsChanged", wrapped);
      ethereum.on("chainChanged", wrapped);
      return () => {
        ethereum.removeListener?.("accountsChanged", wrapped);
        ethereum.removeListener?.("chainChanged", wrapped);
      };
    },
  };
}

export async function requestInjectedAccount(): Promise<string> {
  const ethereum = injected();
  if (!ethereum) throw new NamingError("WALLET_MISSING");
  const accounts = await ethereum.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || !accounts[0]) throw new NamingError("WALLET_MISSING");
  return getAddress(String(accounts[0]));
}
