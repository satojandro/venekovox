import { dnsEncode, getAddress, namehash, ZeroAddress } from "ethers";
import type { Provider } from "ethers";
import {
  ENS_CHAIN_ID,
  PROFILE_THEME_KEY,
  SEPOLIA_ENSV2,
  addressAbi,
  factoryAbi,
  isProfileTheme,
  ownedResolverSalt,
  predictOwnedResolver,
  profilesAbi,
  registryAbi,
  resolverInitializeData,
  resolverWriteAbi,
  textAbi,
  type ProfileTheme,
} from "./ensv2";
import { NamingError, assertSafeTextKey, normalizeLabel } from "./labels";
import { classifyProfileSetup, type ProfileSetup, type SetupOp } from "./profile";
import { UNIVERSAL_RESOLVER, universalAbi } from "./pollName";

export type NamingProvider = Pick<Provider, "getNetwork" | "getBlock" | "getCode" | "call" | "waitForTransaction">;

export interface NamingContext {
  account: string;
  chainId: bigint;
}

export interface NamingWallet {
  peek(): Promise<{ kind: string; account?: string; chainId?: bigint }>;
  send(call: { to: string; data: string; value: bigint }, context: NamingContext): Promise<string>;
  subscribe(listener: () => void): () => void;
}

export interface NamingConfig {
  registrar: string;
  profileParent: string;
  profileRegistry: string;
  operator: string;
  expiry: bigint;
  factory: string;
  resolverImpl: string;
  proxyLogic: string;
}

const inflight = new Set<string>();

export function inflightKey(account: string, op: SetupOp): string {
  return `${getAddress(account)}:${op}`;
}

export function isInFlight(account: string, op: SetupOp): boolean {
  return inflight.has(inflightKey(account, op));
}

export function resetInFlightForTests(): void {
  inflight.clear();
}

async function read(
  provider: NamingProvider,
  to: string,
  abi: typeof profilesAbi,
  method: string,
  args: unknown[] = [],
  blockTag?: number,
) {
  const result = await provider.call({ to, data: abi.encodeFunctionData(method, args), blockTag });
  return abi.decodeFunctionResult(method, result)[0];
}

function requireSepolia(chainId: bigint): void {
  if (chainId !== ENS_CHAIN_ID) throw new NamingError("WRONG_CHAIN");
}

export async function readNamingConfig(provider: NamingProvider, registrarAddress: string): Promise<NamingConfig> {
  const registrar = getAddress(registrarAddress);
  if (registrar === ZeroAddress) throw new NamingError("NOT_CONFIGURED");
  requireSepolia((await provider.getNetwork()).chainId);
  const block = await provider.getBlock("latest");
  if (!block?.hash || (await provider.getCode(registrar, block.number)) === "0x")
    throw new NamingError("NOT_CONFIGURED");
  const [profileParent, profileHash, profileRegistry, operator, expiry, factory, resolverImpl] = await Promise.all([
    read(provider, registrar, profilesAbi, "profileParent", [], block.number),
    read(provider, registrar, profilesAbi, "profileParentNode", [], block.number),
    read(provider, registrar, profilesAbi, "profileRegistry", [], block.number),
    read(provider, registrar, profilesAbi, "operator", [], block.number),
    read(provider, registrar, profilesAbi, "registrationExpiry", [], block.number),
    read(provider, registrar, profilesAbi, "factory", [], block.number),
    read(provider, registrar, profilesAbi, "resolverImpl", [], block.number),
  ]);
  if (namehash(profileParent) !== profileHash) throw new NamingError("CONFIG_MISMATCH");
  if (getAddress(factory) !== getAddress(SEPOLIA_ENSV2.VerifiableFactory)) throw new NamingError("CONFIG_MISMATCH");
  if (getAddress(resolverImpl) !== getAddress(SEPOLIA_ENSV2.PermissionedResolverImpl))
    throw new NamingError("CONFIG_MISMATCH");
  await assertParentWalk(provider, profileParent, getAddress(profileRegistry), block.number);
  const proxyLogic = getAddress(await read(provider, factory, factoryAbi, "proxyLogic", [], block.number));
  return {
    registrar,
    profileParent,
    profileRegistry: getAddress(profileRegistry),
    operator: getAddress(operator),
    expiry: BigInt(expiry),
    factory: getAddress(factory),
    resolverImpl: getAddress(resolverImpl),
    proxyLogic,
  };
}

async function assertParentWalk(
  provider: NamingProvider,
  profileParent: string,
  expectedRegistry: string,
  blockTag: number,
): Promise<void> {
  const labels = profileParent.split(".");
  if (labels.length < 2 || labels.at(-1) !== "eth") throw new NamingError("CONFIG_MISMATCH");
  let registry = getAddress(SEPOLIA_ENSV2.RootRegistry);
  for (let i = labels.length - 1; i >= 0; i--) {
    const data = registryAbi.encodeFunctionData("getSubregistry", [labels[i]]);
    const raw = await provider.call({ to: registry, data, blockTag });
    const next = getAddress(registryAbi.decodeFunctionResult("getSubregistry", raw)[0]);
    if (next === ZeroAddress) throw new NamingError("PARENT_NOT_LINKED");
    registry = next;
  }
  if (registry !== expectedRegistry) throw new NamingError("PARENT_NOT_LINKED");
}

export async function lookupProfileName(
  provider: NamingProvider,
  registrar: string,
  account: string,
  blockTag?: number,
): Promise<string> {
  const name = await read(provider, registrar, profilesAbi, "profileName", [getAddress(account)], blockTag);
  return typeof name === "string" ? name : "";
}

async function resolveForward(
  provider: NamingProvider,
  name: string,
  blockTag: number,
): Promise<{ addr: string; resolver: string }> {
  const node = namehash(name);
  const data = addressAbi.encodeFunctionData("addr", [node]);
  try {
    const raw = await provider.call({
      to: UNIVERSAL_RESOLVER,
      data: universalAbi.encodeFunctionData("resolve", [dnsEncode(name), data]),
      blockTag,
      enableCcipRead: true,
    } as { to: string; data: string; blockTag: number; enableCcipRead: boolean });
    const [result, resolver] = universalAbi.decodeFunctionResult("resolve", raw);
    const addr =
      result && result !== "0x" ? getAddress(addressAbi.decodeFunctionResult("addr", result)[0]) : ZeroAddress;
    return { addr, resolver: getAddress(resolver) };
  } catch {
    return { addr: ZeroAddress, resolver: ZeroAddress };
  }
}

async function readTheme(provider: NamingProvider, name: string, resolver: string, blockTag: number): Promise<string> {
  if (!resolver || resolver === ZeroAddress) return "";
  try {
    const raw = await provider.call({
      to: resolver,
      data: textAbi.encodeFunctionData("text", [namehash(name), PROFILE_THEME_KEY]),
      blockTag,
    });
    return textAbi.decodeFunctionResult("text", raw)[0];
  } catch {
    return "";
  }
}

export async function readProfileSetup(
  provider: NamingProvider,
  config: NamingConfig,
  account: string,
): Promise<ProfileSetup> {
  requireSepolia((await provider.getNetwork()).chainId);
  const owner = getAddress(account);
  const predicted = predictOwnedResolver({
    factory: config.factory,
    proxyLogic: config.proxyLogic,
    owner,
  });
  const block = await provider.getBlock("latest");
  if (!block?.hash) throw new NamingError("LOOKUP_FAILED");
  const claimedName = await lookupProfileName(provider, config.registrar, owner, block.number);
  const resolverCode = (await provider.getCode(predicted, block.number)) !== "0x";
  let actualResolver = ZeroAddress;
  let forwardAddr = ZeroAddress;
  let theme = "";
  if (claimedName) {
    const label = claimedName.split(".")[0];
    try {
      const raw = await provider.call({
        to: config.profileRegistry,
        data: registryAbi.encodeFunctionData("getResolver", [label]),
        blockTag: block.number,
      });
      actualResolver = getAddress(registryAbi.decodeFunctionResult("getResolver", raw)[0]);
    } catch {
      actualResolver = ZeroAddress;
    }
    const resolved = await resolveForward(provider, claimedName, block.number);
    forwardAddr = resolved.addr;
    if (forwardAddr === ZeroAddress && actualResolver !== ZeroAddress) {
      try {
        const raw = await provider.call({
          to: actualResolver,
          data: addressAbi.encodeFunctionData("addr", [namehash(claimedName)]),
          blockTag: block.number,
        });
        const direct = getAddress(addressAbi.decodeFunctionResult("addr", raw)[0]);
        if (direct !== ZeroAddress) forwardAddr = direct;
      } catch {
        /* keep zero; ready still requires a successful forward read */
      }
    }
    theme = await readTheme(provider, claimedName, actualResolver, block.number);
  }
  return classifyProfileSetup({
    account: owner,
    claimedName,
    predictedResolver: predicted,
    actualResolver,
    forwardAddr,
    theme,
    resolverCode,
  });
}

async function sendOnce(
  wallet: NamingWallet,
  context: NamingContext,
  op: SetupOp,
  call: { to: string; data: string },
): Promise<string> {
  requireSepolia(context.chainId);
  const key = inflightKey(context.account, op);
  if (inflight.has(key)) throw new NamingError("IN_FLIGHT");
  inflight.add(key);
  try {
    return await wallet.send({ ...call, value: 0n }, context);
  } finally {
    inflight.delete(key);
  }
}

export async function deployOwnedResolver(
  wallet: NamingWallet,
  provider: NamingProvider,
  config: NamingConfig,
  context: NamingContext,
): Promise<string> {
  const predicted = predictOwnedResolver({
    factory: config.factory,
    proxyLogic: config.proxyLogic,
    owner: context.account,
  });
  if ((await provider.getCode(predicted)) !== "0x") return predicted;
  const salt = ownedResolverSalt(context.account);
  const data = factoryAbi.encodeFunctionData("deployProxy", [
    config.resolverImpl,
    salt,
    resolverInitializeData(context.account),
  ]);
  const hash = await sendOnce(wallet, context, "deployResolver", { to: config.factory, data });
  const receipt = await provider.waitForTransaction(hash);
  if (!receipt || receipt.status !== 1) throw new NamingError("TX_FAILED", hash);
  return predicted;
}

export async function claimProfile(
  wallet: NamingWallet,
  provider: NamingProvider,
  config: NamingConfig,
  context: NamingContext,
  rawLabel: string,
): Promise<string> {
  const label = normalizeLabel(rawLabel);
  const existing = await lookupProfileName(provider, config.registrar, context.account);
  if (existing) throw new NamingError("ALREADY_NAMED");
  const available = await read(provider, config.registrar, profilesAbi, "available", [label]);
  if (!available) throw new NamingError("NAME_UNAVAILABLE");
  const resolver = await deployOwnedResolver(wallet, provider, config, context);
  const data = profilesAbi.encodeFunctionData("claimProfile", [label, resolver]);
  const hash = await sendOnce(wallet, context, "claimProfile", { to: config.registrar, data });
  const receipt = await provider.waitForTransaction(hash);
  if (!receipt || receipt.status !== 1) throw new NamingError("TX_FAILED", hash);
  return hash;
}

export async function writeProfileRecords(
  wallet: NamingWallet,
  provider: NamingProvider,
  config: NamingConfig,
  context: NamingContext,
  theme: ProfileTheme,
  options: { skipAddr?: boolean } = {},
): Promise<string> {
  if (!isProfileTheme(theme)) throw new NamingError("INVALID_THEME");
  assertSafeTextKey(PROFILE_THEME_KEY);
  const setup = await readProfileSetup(provider, config, context.account);
  if (setup.phase === "none") throw new NamingError("NOT_REGISTERED");
  const resolver = setup.actualResolver !== ZeroAddress ? setup.actualResolver : setup.predictedResolver;
  if (!resolver || resolver === ZeroAddress) throw new NamingError("MISSING_RESOLVER");
  const freshCode = await provider.getCode(resolver);
  if (freshCode === "0x") throw new NamingError("MISSING_RESOLVER");
  const node = namehash(setup.name);
  const calls: string[] = [];
  if (!options.skipAddr) {
    calls.push(resolverWriteAbi.encodeFunctionData("setAddr", [node, context.account]));
  }
  calls.push(resolverWriteAbi.encodeFunctionData("setText", [node, PROFILE_THEME_KEY, theme]));
  const data = calls.length === 1 ? calls[0] : resolverWriteAbi.encodeFunctionData("multicall", [calls]);
  const hash = await sendOnce(wallet, context, "writeRecords", { to: resolver, data });
  const receipt = await provider.waitForTransaction(hash);
  if (!receipt || receipt.status !== 1) throw new NamingError("TX_FAILED", hash);
  return hash;
}

export async function authorizeProfileTheme(
  wallet: NamingWallet,
  provider: NamingProvider,
  config: NamingConfig,
  context: NamingContext,
  delegate: string,
  grant: boolean,
): Promise<string> {
  const setup = await readProfileSetup(provider, config, context.account);
  if (setup.phase === "none") throw new NamingError("NOT_REGISTERED");
  const resolver = setup.actualResolver !== ZeroAddress ? setup.actualResolver : setup.predictedResolver;
  const data = resolverWriteAbi.encodeFunctionData("authorizeTextRoles", [
    dnsEncode(setup.name),
    PROFILE_THEME_KEY,
    getAddress(delegate),
    grant,
  ]);
  const hash = await sendOnce(wallet, context, "authorizeTheme", { to: resolver, data });
  const receipt = await provider.waitForTransaction(hash);
  if (!receipt || receipt.status !== 1) throw new NamingError("TX_FAILED", hash);
  return hash;
}

export { NamingError, normalizeLabel, PROFILE_THEME_KEY };
export type { ProfileSetup, SetupOp, ProfileTheme };
