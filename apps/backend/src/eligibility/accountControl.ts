import { hashMessage, Interface, verifyMessage } from "ethers";
import type { Provider } from "ethers";

const erc1271 = new Interface(["function isValidSignature(bytes32 hash, bytes signature) view returns (bytes4)"]);
/** Fail-closed ownership adapter: EOA/7702 ECDSA or deployed ERC-1271 account.
 * Counterfactual/6492 signatures are deliberately unsupported in this slice.
 * Provider must be configured by the server for the authorization chain.
 */
export function accountControlVerifier(provider: Pick<Provider, "getNetwork" | "getCode" | "call">, chainId: bigint) {
  return async (account: string, message: string, signature: string): Promise<boolean> => {
    if ((await provider.getNetwork()).chainId !== chainId) throw new Error("ACCOUNT_PROVIDER_WRONG_CHAIN");
    try {
      if (verifyMessage(message, signature).toLowerCase() === account.toLowerCase()) return true;
    } catch {
      /* May be an ERC-1271 signature rather than ECDSA. */
    }
    if ((await provider.getCode(account)) === "0x") return false;
    try {
      const result = await provider.call({
        to: account,
        data: erc1271.encodeFunctionData("isValidSignature", [hashMessage(message), signature]),
      });
      return erc1271.decodeFunctionResult("isValidSignature", result)[0] === "0x1626ba7e";
    } catch {
      return false;
    }
  };
}
