import { Interface, ZeroAddress, dnsEncode, ensNormalize, getAddress, namehash } from "ethers";
import type { Provider } from "ethers";
import { ENS_CHAIN_ID, UNIVERSAL_RESOLVER, universalAbi, normalizePollName, resolvePollName } from "./pollName";

export const namesAbi = new Interface([
  "function profileParent() view returns(string)",
  "function pollParent() view returns(string)",
  "function profileParentNode() view returns(bytes32)",
  "function pollParentNode() view returns(bytes32)",
  "function profileRegistry() view returns(address)",
  "function pollRegistry() view returns(address)",
  "function operator() view returns(address)",
  "function maci() view returns(address)",
  "function registrationExpiry() view returns(uint64)",
  "function available(string label,bool isPoll) view returns(bool)",
  "function profileName(address account) view returns(string)",
  "function claimProfile(string label) returns(bytes32)",
  "function namePoll(string label,uint256 pollId) returns(bytes32)",
  "event ProfileClaimed(address indexed account,bytes32 indexed node,string label)",
  "event PollNamed(uint256 indexed pollId,bytes32 indexed node,string label,address poll)",
]);
export const addressAbi = new Interface(["function addr(bytes32 node) view returns(address)"]);
const registryAbi = new Interface(["function getSubregistry(string label) view returns(address)"]);
// ENS official Sepolia Beta deployment table, checked 2026-09-07. Recheck before deployment.
export const ENS_ROOT_REGISTRY = "0x8115186e8f2e0b0281e86ab91f0f48ba90364354";
export type NamingProvider = Pick<Provider, "getNetwork" | "getBlock" | "getCode" | "call" | "waitForTransaction">;
export interface NamingContext {
  account: string;
  chainId: bigint;
}
export interface NamingWallet {
  peek(): Promise<{ kind: string; account?: string; chainId?: bigint }>;
  /** Must execute as context.account. Return the mined-chain transaction hash, never a user-op hash.
   * W1 sponsored implementations must resolve SponsoredHandle using their vendor confirmation path.
   * No automatic user-funded fallback is permitted. */
  send(call: { to: string; data: string; value: bigint }, context: NamingContext): Promise<string>;
  subscribe(listener: () => void): () => void;
}
export interface NamingConfig {
  registrar: string;
  profileParent: string;
  pollParent: string;
  operator: string;
  maci: string;
  expiry: bigint;
}
export class NamingError extends Error {
  constructor(
    public readonly code: string,
    public readonly transactionHash?: string,
  ) {
    super(code);
  }
}
export function normalizeLabel(input: string) {
  const label = input.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(label)) throw new NamingError("INVALID_LABEL");
  try {
    if (ensNormalize(label) !== label) throw new Error();
  } catch {
    throw new NamingError("INVALID_LABEL");
  }
  return label;
}
function nonzero(input: string) {
  const address = getAddress(input);
  if (address === ZeroAddress) throw new NamingError("NOT_CONFIGURED");
  return address;
}
async function read(
  provider: NamingProvider,
  registrar: string,
  method: string,
  args: unknown[] = [],
  blockTag?: number,
) {
  const result = await provider.call({ to: registrar, data: namesAbi.encodeFunctionData(method, args), blockTag });
  return namesAbi.decodeFunctionResult(method, result)[0];
}

/** Reads configuration AND checks that the actual ENS hierarchy reaches these registries. */
export async function readNamingConfig(
  provider: NamingProvider,
  address: string,
  allowedMaci: string,
): Promise<NamingConfig> {
  const registrar = nonzero(address),
    maci = nonzero(allowedMaci);
  if ((await provider.getNetwork()).chainId !== ENS_CHAIN_ID) throw new NamingError("WRONG_CHAIN");
  const block = await provider.getBlock("latest");
  if (!block?.hash || (await provider.getCode(registrar, block.number)) === "0x")
    throw new NamingError("NOT_CONFIGURED");
  const keys = [
    "profileParent",
    "pollParent",
    "profileParentNode",
    "pollParentNode",
    "profileRegistry",
    "pollRegistry",
    "operator",
    "maci",
    "registrationExpiry",
  ];
  const [profileParent, pollParent, profileHash, pollHash, profiles, polls, operator, actualMaci, expiry] =
    await Promise.all(keys.map((key) => read(provider, registrar, key, [], block.number)));
  if (
    normalizePollName(profileParent) !== profileParent ||
    normalizePollName(pollParent) !== pollParent ||
    profileParent === pollParent ||
    profileParent.length > 222 ||
    pollParent.length > 222 ||
    profiles === polls ||
    namehash(profileParent) !== profileHash ||
    namehash(pollParent) !== pollHash ||
    nonzero(actualMaci) !== maci
  )
    throw new NamingError("CONFIG_MISMATCH");
  for (const [parent, expected] of [
    [profileParent, profiles],
    [pollParent, polls],
  ]) {
    let registry = ENS_ROOT_REGISTRY;
    for (const label of (parent as string).split(".").reverse()) {
      const raw = await provider.call({
        to: registry,
        data: registryAbi.encodeFunctionData("getSubregistry", [label]),
        blockTag: block.number,
      });
      registry = nonzero(registryAbi.decodeFunctionResult("getSubregistry", raw)[0]);
    }
    if (registry !== nonzero(expected)) throw new NamingError("PARENT_NOT_LINKED");
  }
  if (expiry <= BigInt(block.timestamp)) throw new NamingError("EXPIRED");
  if ((await provider.getBlock(block.number))?.hash !== block.hash) throw new NamingError("CHAIN_CHANGED");
  return { registrar, profileParent, pollParent, operator: nonzero(operator), maci, expiry };
}

export async function recoverProfile(
  provider: NamingProvider,
  config: NamingConfig,
  account: string,
): Promise<string | null> {
  if ((await provider.getNetwork()).chainId !== ENS_CHAIN_ID) throw new NamingError("WRONG_CHAIN");
  const owner = nonzero(account),
    block = await provider.getBlock("latest");
  if (!block?.hash) throw new NamingError("LOOKUP_FAILED");
  const name = (await read(provider, config.registrar, "profileName", [owner], block.number)) as string;
  if (!name) return null;
  const suffix = "." + config.profileParent;
  if (!name.endsWith(suffix) || normalizeLabel(name.slice(0, -suffix.length)) + suffix !== name)
    throw new NamingError("PROFILE_MISMATCH");
  const result = await provider.call({
    to: UNIVERSAL_RESOLVER,
    blockTag: block.number,
    enableCcipRead: true,
    data: universalAbi.encodeFunctionData("resolve", [
      dnsEncode(name),
      addressAbi.encodeFunctionData("addr", [namehash(name)]),
    ]),
  });
  const [data, resolver] = universalAbi.decodeFunctionResult("resolve", result);
  if (
    getAddress(resolver) !== config.registrar ||
    getAddress(addressAbi.decodeFunctionResult("addr", data)[0]) !== owner
  )
    throw new NamingError("PROFILE_MISMATCH");
  if ((await provider.getBlock(block.number))?.hash !== block.hash) throw new NamingError("CHAIN_CHANGED");
  return name;
}

/** One operation, guarded against account/chain changes, including switch-away-and-back. */
export async function registerName(args: {
  provider: NamingProvider;
  wallet: NamingWallet;
  registrar: string;
  allowedMaci: string;
  label: string;
  pollId?: string;
  onBroadcast?: (hash: string) => void;
  signal?: AbortSignal;
}) {
  const { provider, wallet } = args;
  const label = normalizeLabel(args.label),
    isPoll = args.pollId !== undefined;
  if (isPoll && (!/^(0|[1-9][0-9]{0,77})$/.test(args.pollId!) || BigInt(args.pollId!) >= 1n << 256n))
    throw new NamingError("INVALID_POLL_ID");
  let changed = false,
    hash: string | undefined;
  const unsubscribe = wallet.subscribe(() => {
    changed = true;
  });
  try {
    const session = await wallet.peek();
    if (session.kind !== "found" || !session.account || session.chainId !== ENS_CHAIN_ID)
      throw new NamingError("CONNECT_SEPOLIA");
    const context = { account: nonzero(session.account), chainId: ENS_CHAIN_ID };
    const assertCurrent = async () => {
      const current = await wallet.peek();
      if (
        args.signal?.aborted ||
        changed ||
        current.kind !== "found" ||
        current.chainId !== context.chainId ||
        !current.account ||
        getAddress(current.account) !== context.account
      )
        throw new NamingError("CONTEXT_CHANGED", hash);
    };
    const config = await readNamingConfig(provider, args.registrar, args.allowedMaci);
    if (isPoll && context.account !== config.operator) throw new NamingError("OPERATOR_ONLY");
    const name = label + "." + (isPoll ? config.pollParent : config.profileParent);
    if (!(await read(provider, config.registrar, "available", [label, isPoll])))
      throw new NamingError("NAME_UNAVAILABLE");
    const method = isPoll ? "namePoll" : "claimProfile";
    const call = {
      to: config.registrar,
      value: 0n,
      data: namesAbi.encodeFunctionData(method, isPoll ? [label, args.pollId] : [label]),
    };
    // Rehearse against latest chain state, from the actual participating account.
    await provider.call({ ...call, from: context.account });
    await assertCurrent();
    hash = await wallet.send(call, context);
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new NamingError("INVALID_TRANSACTION_HANDLE");
    args.onBroadcast?.(hash);
    const receipt = await provider.waitForTransaction(hash, 1, 120000);
    if (!receipt || receipt.status !== 1)
      throw new NamingError(receipt ? "TRANSACTION_REVERTED" : "CONFIRMATION_PENDING", hash);
    const emitted = receipt.logs.some((log) => {
      if (getAddress(log.address) !== config.registrar) return false;
      try {
        const event = namesAbi.parseLog(log);
        return (
          event?.name === (isPoll ? "PollNamed" : "ProfileClaimed") &&
          event.args.node === namehash(name) &&
          event.args.label === label &&
          (isPoll ? event.args.pollId === BigInt(args.pollId!) : getAddress(event.args.account) === context.account)
        );
      } catch {
        return false;
      }
    });
    if (!emitted) throw new NamingError("REGISTRATION_NOT_CONFIRMED", hash);
    await assertCurrent();
    if (isPoll) {
      const resolved = await resolvePollName(name, provider, [config.maci]);
      if (resolved.reference.pollId !== args.pollId || resolved.resolver !== config.registrar)
        throw new NamingError("POLL_MISMATCH", hash);
    } else if ((await recoverProfile(provider, config, context.account)) !== name)
      throw new NamingError("PROFILE_MISMATCH", hash);
    await assertCurrent();
    return { name, transactionHash: hash, account: context.account };
  } catch (error) {
    if (error instanceof NamingError) throw error;
    throw new NamingError(hash ? "RECHECK_TRANSACTION" : "REGISTRATION_FAILED", hash);
  } finally {
    unsubscribe();
  }
}
