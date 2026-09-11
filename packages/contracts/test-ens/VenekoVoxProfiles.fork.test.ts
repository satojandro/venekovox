import { expect } from "chai";
import {
  AbiCoder,
  type ContractTransactionResponse,
  dnsEncode,
  id,
  Interface,
  keccak256,
  namehash,
  type Provider,
  type Signer,
  type TransactionReceipt,
} from "ethers";
import { ethers, network } from "hardhat";

import { readFileSync } from "fs";
import path from "path";

const pin = JSON.parse(readFileSync(path.join(__dirname, "../ens/sepolia-ensv2.json"), "utf8")) as {
  sepolia: Record<string, string>;
};

const ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111n;
const ROLE_REGISTRAR = 1n;
const ROLE_SET_TEXT = 16n;
const THEME_KEY = "xyz.venekovox.profile-theme";
const PARENT = "s11-profiles.eth";

const factoryAbi = [
  "function deployProxy(address implementation,uint256 salt,bytes data) returns(address proxy)",
  "function verifyContract(address proxy) view returns(address implementation)",
  "function proxyLogic() view returns(address)",
  "event ProxyDeployed(address indexed sender,address indexed proxyAddress,uint256 salt,address implementation)",
];

const registryAbi = [
  "function initialize(address rootAccount,uint256 roleBitmap)",
  "function grantRootRoles(uint256 roleBitmap,address account) returns(bool)",
  "function getResolver(string label) view returns(address)",
  "function getState(uint256 anyId) view returns(uint8 status,uint64 expiry,address latestOwner,uint256 tokenId,uint256 resource)",
];

const resolverAbi = [
  "function initialize(address admin,uint256 roleBitmap,bytes[] setters)",
  "function setAddr(bytes32 node,address addr)",
  "function setText(bytes32 node,string key,string value)",
  "function addr(bytes32 node) view returns(address)",
  "function text(bytes32 node,string key) view returns(string)",
  "function authorizeTextRoles(bytes toName,string key,address account,bool grant) returns(bool)",
  "function authorizeNameRoles(bytes toName,uint256 roleBitmap,address account,bool grant) returns(bool)",
];

interface ProxyFactory {
  proxyLogic(): Promise<string>;
  verifyContract(proxy: string): Promise<string>;
  deployProxy(implementation: string, salt: bigint, data: string): Promise<ContractTransactionResponse>;
  connect(signer: Signer): ProxyFactory;
  readonly interface: Interface;
}

interface UserRegistry {
  grantRootRoles(roleBitmap: bigint, account: string): Promise<ContractTransactionResponse>;
  getResolver(label: string): Promise<string>;
}

interface PermissionedResolver {
  setAddr(node: string, addr: string): Promise<ContractTransactionResponse>;
  setText(node: string, key: string, value: string): Promise<ContractTransactionResponse>;
  addr(node: string): Promise<string>;
  text(node: string, key: string): Promise<string>;
  authorizeTextRoles(
    toName: string,
    key: string,
    account: string,
    grant: boolean,
  ): Promise<ContractTransactionResponse>;
  authorizeNameRoles(
    toName: string,
    roleBitmap: bigint,
    account: string,
    grant: boolean,
  ): Promise<ContractTransactionResponse>;
  connect(signer: Signer): PermissionedResolver;
}

interface Profiles {
  getAddress(): Promise<string>;
  waitForDeployment(): Promise<unknown>;
  profileName(account: string): Promise<string>;
  claimProfile(label: string, resolver: string): Promise<ContractTransactionResponse>;
  connect(signer: Signer): Profiles;
}

function ownedResolverSalt(owner: string): bigint {
  return BigInt(
    keccak256(AbiCoder.defaultAbiCoder().encode(["bytes32", "address", "uint256"], [id("OwnedResolver"), owner, 0n])),
  );
}

function registrySalt(node: string): bigint {
  return BigInt(
    keccak256(AbiCoder.defaultAbiCoder().encode(["bytes32", "bytes32", "uint256"], [id("UserRegistry"), node, 0n])),
  );
}

function asFactory(address: string, runner: Signer | Provider): ProxyFactory {
  return new ethers.Contract(address, factoryAbi, runner) as unknown as ProxyFactory;
}

function asRegistry(address: string, runner: Signer | Provider): UserRegistry {
  return new ethers.Contract(address, registryAbi, runner) as unknown as UserRegistry;
}

function asResolver(address: string, runner: Signer | Provider): PermissionedResolver {
  return new ethers.Contract(address, resolverAbi, runner) as unknown as PermissionedResolver;
}

function proxyAddressFromReceipt(factory: ProxyFactory, receipt: TransactionReceipt | null): string {
  expect(receipt).to.not.equal(null);
  const deployed = receipt!.logs
    .map((log) => {
      try {
        return factory.interface.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === "ProxyDeployed");
  const proxy = deployed?.args.proxyAddress as unknown;
  expect(typeof proxy).to.equal("string");
  return ethers.getAddress(proxy as string);
}

describe("VenekoVoxProfiles on pinned Sepolia ENSv2 contracts", () => {
  async function etchPinnedBytecode(): Promise<void> {
    const remote = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
    const seen = new Set<string>();
    const etch = async (addr: string): Promise<void> => {
      const checksum = ethers.getAddress(addr);
      if (seen.has(checksum.toLowerCase())) {
        return;
      }
      seen.add(checksum.toLowerCase());
      const code = await remote.getCode(checksum);
      expect(code, `bytecode ${checksum}`).to.not.equal("0x");
      await network.provider.send("hardhat_setCode", [checksum, code]);
    };
    await etch(pin.sepolia.VerifiableFactory);
    await etch(pin.sepolia.VerifiableFactoryProxyLogic);
    await etch(pin.sepolia.PermissionedResolverImpl);
    await etch(pin.sepolia.UserRegistryImpl);
    await etch(pin.sepolia.UpgradableUniversalResolverProxy);
    const registryView = new ethers.Contract(
      pin.sepolia.UserRegistryImpl,
      ["function LABEL_STORE() view returns(address)"],
      ethers.provider,
    ) as unknown as { LABEL_STORE: () => Promise<string> };
    await etch(await registryView.LABEL_STORE());
  }

  it("probes factory/impl bytecode then exercises owner writes and EAC", async function probesOwnerWritesAndEac() {
    this.timeout(180_000);
    if (process.env.ENS_FORK !== "1") {
      await etchPinnedBytecode();
    }
    const factory = asFactory(pin.sepolia.VerifiableFactory, ethers.provider);
    expect(await ethers.provider.getCode(pin.sepolia.VerifiableFactory)).to.not.equal("0x");
    expect(await ethers.provider.getCode(pin.sepolia.PermissionedResolverImpl)).to.not.equal("0x");
    expect(await ethers.provider.getCode(pin.sepolia.UserRegistryImpl)).to.not.equal("0x");
    expect(await ethers.provider.getCode(pin.sepolia.UpgradableUniversalResolverProxy)).to.not.equal("0x");
    expect((await factory.proxyLogic()).toLowerCase()).to.equal(pin.sepolia.VerifiableFactoryProxyLogic.toLowerCase());

    const [deployer, owner, app, stranger] = await ethers.getSigners();
    await Promise.all(
      [deployer, owner, app, stranger].map((signer) =>
        ethers.provider.send("hardhat_setBalance", [signer.address, "0x56BC75E2D63100000"]),
      ),
    );

    const registryInit = new Interface(registryAbi).encodeFunctionData("initialize", [deployer.address, ALL_ROLES]);
    const registryTx = await factory
      .connect(deployer)
      .deployProxy(pin.sepolia.UserRegistryImpl, registrySalt(namehash(PARENT)), registryInit);
    const registryAddress = proxyAddressFromReceipt(factory, await registryTx.wait());
    const registry = asRegistry(registryAddress, deployer);
    expect(await factory.verifyContract(registryAddress)).to.equal(ethers.getAddress(pin.sepolia.UserRegistryImpl));

    const expiry = BigInt((await ethers.provider.getBlock("latest")).timestamp) + 365n * 24n * 60n * 60n;
    const profiles = (await (
      await ethers.getContractFactory("VenekoVoxProfiles")
    ).deploy(
      registryAddress,
      PARENT,
      namehash(PARENT),
      deployer.address,
      expiry,
      pin.sepolia.VerifiableFactory,
      pin.sepolia.PermissionedResolverImpl,
    )) as unknown as Profiles;
    await profiles.waitForDeployment();
    await (await registry.grantRootRoles(ROLE_REGISTRAR, await profiles.getAddress())).wait();

    const resolverInit = new Interface(resolverAbi).encodeFunctionData("initialize", [owner.address, ALL_ROLES, []]);
    const resolverTx = await factory
      .connect(owner)
      .deployProxy(pin.sepolia.PermissionedResolverImpl, ownedResolverSalt(owner.address), resolverInit);
    const resolverAddress = proxyAddressFromReceipt(factory, await resolverTx.wait());
    expect(await factory.verifyContract(resolverAddress)).to.equal(
      ethers.getAddress(pin.sepolia.PermissionedResolverImpl),
    );
    const resolver = asResolver(resolverAddress, owner);
    const node = namehash(`ada.${PARENT}`);
    const dnsName = dnsEncode(`ada.${PARENT}`);

    await expect(profiles.connect(owner).claimProfile("ada", owner.address)).to.be.reverted;
    await (await profiles.connect(owner).claimProfile("ada", resolverAddress)).wait();
    expect(await profiles.profileName(owner.address)).to.equal(`ada.${PARENT}`);
    await expect(profiles.connect(owner).claimProfile("ada", resolverAddress)).to.be.reverted;
    expect(await registry.getResolver("ada")).to.equal(resolverAddress);

    const profilesAddress = await profiles.getAddress();
    await network.provider.request({ method: "hardhat_impersonateAccount", params: [profilesAddress] });
    await ethers.provider.send("hardhat_setBalance", [profilesAddress, "0x56BC75E2D63100000"]);
    const registrarSigner = await ethers.getSigner(profilesAddress);
    await expect(resolver.connect(registrarSigner).setAddr(node, owner.address)).to.be.reverted;
    await expect(resolver.connect(deployer).setAddr(node, owner.address)).to.be.reverted;

    expect(await resolver.addr(node)).to.equal(ethers.ZeroAddress);
    expect(await profiles.profileName(owner.address)).to.equal(`ada.${PARENT}`);
    await (await resolver.connect(owner).setAddr(node, owner.address)).wait();
    expect(await resolver.addr(node)).to.equal(owner.address);

    await (await resolver.connect(owner).setText(node, THEME_KEY, "lime")).wait();
    await (await resolver.connect(owner).authorizeTextRoles(dnsName, THEME_KEY, app.address, true)).wait();
    await (await resolver.connect(app).setText(node, THEME_KEY, "rose")).wait();
    await expect(resolver.connect(app).setText(node, "url", "https://example.invalid")).to.be.reverted;
    await expect(resolver.connect(app).setText(node, "xyz.venekovox.status", "eligible")).to.be.reverted;

    await (await resolver.connect(owner).authorizeNameRoles(dnsName, ROLE_SET_TEXT, app.address, true)).wait();
    await (await resolver.connect(owner).authorizeTextRoles(dnsName, THEME_KEY, app.address, false)).wait();
    await (await resolver.connect(app).setText(node, THEME_KEY, "slate")).wait();
    await (await resolver.connect(owner).authorizeNameRoles(dnsName, ROLE_SET_TEXT, app.address, false)).wait();
    await expect(resolver.connect(app).setText(node, THEME_KEY, "lime")).to.be.reverted;
    await expect(resolver.connect(app).authorizeTextRoles(dnsName, THEME_KEY, app.address, true)).to.be.reverted;
    await expect(resolver.connect(stranger).setAddr(node, stranger.address)).to.be.reverted;
  });
});
