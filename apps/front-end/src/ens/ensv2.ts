import { Interface, concat, getAddress, getCreate2Address, keccak256, AbiCoder, ZeroAddress } from "ethers";

export const ENS_CHAIN_ID = 11155111n;
export const PROFILE_THEME_KEY = "xyz.venekovox.profile-theme";
export const PROFILE_THEMES = ["lime", "slate", "rose"] as const;
export type ProfileTheme = (typeof PROFILE_THEMES)[number];

export const ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111n;
export const ROLE_SET_TEXT = 1n << 4n;
export const ROLE_SET_RESOLVER = 1n << 24n;
export const ROLE_REGISTRAR = 1n << 0n;
export const OWNED_RESOLVER_VERSION = 0n;

/** Official Sepolia ENSv2 Beta table, re-checked 2026-09-11. Lowercase so ethers can checksum. */
export const SEPOLIA_ENSV2 = {
  VerifiableFactory: "0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef",
  VerifiableFactoryProxyLogic: "0xa136bee4e37b44586242e516a39893efd54315e9",
  PermissionedResolverImpl: "0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e",
  UserRegistryImpl: "0x624a25d67b59d587752ebec8dded8827dae52050",
  ETHRegistry: "0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2",
  RootRegistry: "0x8115186e8f2e0b0281e86ab91f0f48ba90364354",
  UniversalResolver: "0xeeeeeeee14d718c2b47d9923deab1335e144eeee",
} as const;

export const factoryAbi = new Interface([
  "function deployProxy(address implementation,uint256 salt,bytes data) returns(address proxy)",
  "function verifyContract(address proxy) view returns(address implementation)",
  "function proxyLogic() view returns(address)",
  "event ProxyDeployed(address indexed sender,address indexed proxyAddress,uint256 salt,address implementation)",
]);

export const resolverInitAbi = new Interface(["function initialize(address admin,uint256 roleBitmap,bytes[] setters)"]);

export const resolverWriteAbi = new Interface([
  "function setAddr(bytes32 node,address addr)",
  "function setText(bytes32 node,string key,string value)",
  "function multicall(bytes[] data) returns(bytes[])",
  "function authorizeTextRoles(bytes toName,string key,address account,bool grant) returns(bool)",
  "function authorizeNameRoles(bytes toName,uint256 roleBitmap,address account,bool grant) returns(bool)",
  "function addr(bytes32 node) view returns(address)",
  "function text(bytes32 node,string key) view returns(string)",
]);

export const profilesAbi = new Interface([
  "function profileParent() view returns(string)",
  "function profileParentNode() view returns(bytes32)",
  "function profileRegistry() view returns(address)",
  "function operator() view returns(address)",
  "function registrationExpiry() view returns(uint64)",
  "function factory() view returns(address)",
  "function resolverImpl() view returns(address)",
  "function available(string label) view returns(bool)",
  "function profileName(address account) view returns(string)",
  "function claimProfile(string label,address resolver) returns(bytes32)",
  "event ProfileClaimed(address indexed account,bytes32 indexed node,string label,address resolver)",
]);

export const registryAbi = new Interface([
  "function getSubregistry(string label) view returns(address)",
  "function getResolver(string calldata label) view returns(address)",
  "function getState(uint256 anyId) view returns(uint8 status,uint64 expiry,address latestOwner,uint256 tokenId,uint256 resource)",
  "function setResolver(uint256 anyId,address resolver)",
  "function grantRootRoles(uint256 roleBitmap,address account) returns(bool)",
]);

export const addressAbi = new Interface(["function addr(bytes32 node) view returns(address)"]);
export const textAbi = new Interface(["function text(bytes32 node,string key) view returns(string)"]);

export function isProfileTheme(value: string): value is ProfileTheme {
  return (PROFILE_THEMES as readonly string[]).includes(value);
}

export function ownedResolverSalt(owner: string, version = OWNED_RESOLVER_VERSION): bigint {
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "address", "uint256"],
    [keccak256(new TextEncoder().encode("OwnedResolver")), getAddress(owner), version],
  );
  return BigInt(keccak256(encoded));
}

export function outerCreate2Salt(deployer: string, salt: bigint): string {
  return keccak256(AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [getAddress(deployer), salt]));
}

/** EIP-1167 clone creation code used by the pinned VerifiableFactory (CloneProxyBytecode). */
export function cloneProxyCreationCode(proxyLogic: string, outerSalt: string): string {
  const logic = getAddress(proxyLogic).slice(2).toLowerCase();
  const salt = outerSalt.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  return concat([
    "0x3d604d80600a3d3981f3363d3d373d3d3d363d73",
    "0x" + logic,
    "0x5af43d82803e903d91602b57fd5bf3",
    "0x" + salt,
  ]);
}

export function predictOwnedResolver(params: {
  factory: string;
  proxyLogic: string;
  owner: string;
  version?: bigint;
}): string {
  const salt = ownedResolverSalt(params.owner, params.version);
  const outer = outerCreate2Salt(params.owner, salt);
  const initCodeHash = keccak256(cloneProxyCreationCode(params.proxyLogic, outer));
  return getCreate2Address(getAddress(params.factory), outer, initCodeHash);
}

export function resolverInitializeData(owner: string): string {
  return resolverInitAbi.encodeFunctionData("initialize", [getAddress(owner), ALL_ROLES, []]);
}

export function labelId(label: string): bigint {
  return BigInt(keccak256(new TextEncoder().encode(label)));
}

export function nonzero(input: string, code = "NOT_CONFIGURED"): string {
  const address = getAddress(input);
  if (address === ZeroAddress) {
    const error = new Error(code);
    error.name = code;
    throw error;
  }
  return address;
}
