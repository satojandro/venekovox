import { BrowserProvider, type Eip1193Provider, type JsonRpcSigner } from "ethers";
import { SponsorshipUnavailableError, type SponsoredCall, type WalletAdapter, type WalletPeek } from "./adapter";

type WalletProvider = Eip1193Provider & {
  on?: (event: string, listener: () => void) => void;
  removeListener?: (event: string, listener: () => void) => void;
};

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

function injectedProvider(): WalletProvider | undefined {
  return typeof window === "undefined" ? undefined : window.ethereum;
}

async function assertChain(wallet: WalletProvider, expectedChainId: bigint): Promise<void> {
  const currentChain = await wallet.request({ method: "eth_chainId" });
  if (BigInt(currentChain) !== expectedChainId) {
    throw new Error(`Switch your wallet to the poll's network (chain ${expectedChainId}) and try again.`);
  }
}

/**
 * Read-only wallet probe: inspects an ALREADY-connected wallet without prompting
 * (eth_accounts never pops a modal). Distinguishes no wallet, nothing connected,
 * a probe error, or a usable account — same contract as P1 hydration (G03).
 */
export async function peekWallet(): Promise<WalletPeek> {
  const wallet = injectedProvider();
  if (!wallet) return { kind: "no-provider" };
  try {
    const accounts: string[] = await wallet.request({ method: "eth_accounts" });
    if (!accounts || accounts.length === 0) return { kind: "not-connected" };
    const chainId = BigInt(await wallet.request({ method: "eth_chainId" }));
    return { kind: "found", account: accounts[0], chainId };
  } catch {
    return { kind: "error" };
  }
}

export async function getInjectedWallet(expectedChainId: bigint): Promise<{
  wallet: WalletProvider;
  signer: JsonRpcSigner;
  account: string;
  assertChain: () => Promise<void>;
}> {
  const wallet = injectedProvider();
  if (!wallet) throw new Error("No wallet found. Please install MetaMask or Rainbow.");
  const checkChain = async () => assertChain(wallet, expectedChainId);
  await checkChain();
  const provider = new BrowserProvider(wallet);
  await provider.send("eth_requestAccounts", []);
  await checkChain();
  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  return { wallet, signer, account, assertChain: checkChain };
}

export function createInjectedAdapter(): WalletAdapter {
  return {
    kind: "injected",
    peek: peekWallet,
    async connect(expectedChainId) {
      const { signer, account } = await getInjectedWallet(expectedChainId);
      return { account, chainId: expectedChainId, signer };
    },
    subscribe(listener) {
      const wallet = injectedProvider();
      wallet?.on?.("accountsChanged", listener);
      wallet?.on?.("chainChanged", listener);
      return () => {
        wallet?.removeListener?.("accountsChanged", listener);
        wallet?.removeListener?.("chainChanged", listener);
      };
    },
    async getUserFundedSigner(expectedChainId) {
      const { signer } = await getInjectedWallet(expectedChainId);
      return signer;
    },
    async sendSponsored(_call: SponsoredCall) {
      throw new SponsorshipUnavailableError(
        "Injected wallets are user-funded. Sponsoring this call would require a tested vendor adapter, not a silent ETH payment.",
      );
    },
  };
}
