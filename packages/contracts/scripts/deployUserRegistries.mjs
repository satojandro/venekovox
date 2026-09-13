/**
 * Deploy two UserRegistry proxies for VenekoVox ENSv2 subnames.
 *
 * Run from packages/contracts:
 *   node scripts/deployUserRegistries.mjs
 *
 * Requires: PRIVATE_KEY and SEPOLIA_RPC_URL in .env
 * Deploys from the venekovox.eth owner account.
 */
import "dotenv/config";
import {
  JsonRpcProvider,
  Wallet,
  Interface,
  FetchRequest,
  parseAbi,
  keccak256,
  toUtf8Bytes,
  namehash,
  AbiCoder,
  encodeBytes32String,
} from "ethers";

// ENSv2 Sepolia deployment addresses (from docs.ens.domains/learn/deployments)
const VERIFIABLE_FACTORY = "0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef";
const USER_REGISTRY_IMPL = "0x624a25d67b59d587752ebec8dded8827dae52050";
const ETH_REGISTRY = "0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2";

// Grant all roles and their admin counterparts
const ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111n;

const factoryAbi = new Interface([
  "function deployProxy(address implementation, uint256 salt, bytes data) returns (address)",
  "event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)",
]);

const registryInitAbi = new Interface(["function initialize(address rootAccount, uint256 roleBitmap)"]);

const permissionedRegistryAbi = new Interface(["function setSubregistry(uint256 anyId, address subregistry)"]);

async function deployUserRegistry(wallet, provider, namehash_hex, label) {
  const coder = AbiCoder.defaultAbiCoder();
  // Salt scheme: keccak256("UserRegistry", namehash, version)
  const version = 0n;
  const salt = BigInt(
    keccak256(
      coder.encode(["bytes32", "bytes32", "uint256"], [keccak256(toUtf8Bytes("UserRegistry")), namehash_hex, version]),
    ),
  );

  const initData = registryInitAbi.encodeFunctionData("initialize", [await wallet.getAddress(), ALL_ROLES]);

  console.log(`Deploying UserRegistry for ${label}...`);
  console.log(`  salt: ${salt.toString(16).slice(0, 16)}...`);

  const tx = await wallet.sendTransaction({
    to: VERIFIABLE_FACTORY,
    data: factoryAbi.encodeFunctionData("deployProxy", [USER_REGISTRY_IMPL, salt, initData]),
  });
  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait();

  // Parse ProxyDeployed event
  for (const log of receipt.logs) {
    try {
      const parsed = factoryAbi.parseLog(log);
      if (parsed?.name === "ProxyDeployed") {
        const proxyAddr = parsed.args.proxyAddress;
        console.log(`  ✅ ${label} UserRegistry deployed at: ${proxyAddr}`);
        return proxyAddr;
      }
    } catch {}
  }
  throw new Error("ProxyDeployed event not found in receipt");
}

async function main() {
  const rpc = process.env.SEPOLIA_RPC_URL;
  const pk = process.env.PRIVATE_KEY;
  if (!rpc || !pk) {
    console.error("Set SEPOLIA_RPC_URL and PRIVATE_KEY in packages/contracts/.env");
    process.exit(1);
  }

  const request = new FetchRequest(rpc);
  request.timeout = 15000;
  const provider = new JsonRpcProvider(request);
  const wallet = new Wallet(pk, provider);
  const addr = await wallet.getAddress();
  console.log(`Deploying from: ${addr}`);

  // Verify chain
  const net = await provider.getNetwork();
  if (net.chainId !== 11155111n) {
    console.error(`Wrong chain: ${net.chainId} (expected 11155111 / Sepolia)`);
    process.exit(1);
  }

  // Compute namehashes
  const profileParent = "people.venekovox.eth";
  const pollParent = "polls.venekovox.eth";
  const profileHash = namehash(profileParent);
  const pollHash = namehash(pollParent);
  console.log(`\nProfile parent: ${profileParent} → ${profileHash}`);
  console.log(`Poll parent:    ${pollParent} → ${pollHash}`);

  // Deploy two UserRegistry proxies
  const profilesRegistry = await deployUserRegistry(wallet, provider, profileHash, profileParent);
  const pollsRegistry = await deployUserRegistry(wallet, provider, pollHash, pollParent);

  // Link them as subregistries under venekovox.eth
  // The parent registry for venekovox.eth is the eth registry (0xBDC8...)
  console.log(`\nLinking subregistries on the eth registry...`);

  // setSubregistry(labelhash("venekovox"), profilesRegistry) - NO, this sets subregistry ON venekovox's entry
  // We need: on the venekovox.eth registry, set subregistry for "people" and "polls"
  // But venekovox.eth doesn't have its own registry yet - it uses the eth registry

  // Actually, the way ENSv2 works:
  // The eth registry owns venekovox. We need to set subregistries ON the eth registry
  // for the "people" and "polls" labels under venekovox.
  // But that's not how it works - subregistries are per-name, not per-label.

  // Wait - let me re-read the docs. setSubregistry(anyId, subregistry) sets the
  // subregistry for a name. So we call it on the eth registry with the labelhash
  // of "people" under "venekovox.eth" - NO, that's wrong too.

  // The hierarchy is: eth registry -> venekovox -> people/polls
  // The eth registry has a subregistry pointer for "venekovox" which would be
  // the venekovox.eth registry. But currently it's zero.

  // Actually, I think we need to:
  // 1. Create a registry for venekovox.eth itself (or use the existing one)
  // 2. Then on that registry, set subregistries for "people" and "polls"

  // Let me check: the eth registry has venekovox registered but no subregistry set.
  // We need to call setSubregistry on the eth registry for the "venekovox" label,
  // pointing to a new UserRegistry. Then on that new registry, we set subregistries
  // for "people" and "polls".

  // Actually wait - looking at the contract developer guide more carefully:
  // "Point the parent name at the UserRegistry" = call setSubregistry on the PARENT
  // registry, using the labelhash of the name, pointing to the UserRegistry.

  // So for people.venekovox.eth:
  // - The parent of "people" is "venekovox.eth"
  // - But venekovox.eth doesn't have its own registry yet
  // - We need to first create a registry for venekovox.eth

  // Let me also deploy a registry for venekovox.eth itself
  console.log(`\nAlso need a registry for venekovox.eth itself...`);
  const venekovoxHash = namehash("venekovox.eth");
  const venekovoxRegistry = await deployUserRegistry(wallet, provider, venekovoxHash, "venekovox.eth");

  // Link venekovox.eth -> its registry on the eth registry
  console.log(`\nLinking venekovox.eth -> its registry on the eth registry...`);
  const labelhash_venekovox = BigInt(keccak256(toUtf8Bytes("venekovox")));
  const setSub1 = await wallet.sendTransaction({
    to: ETH_REGISTRY,
    data: permissionedRegistryAbi.encodeFunctionData("setSubregistry", [labelhash_venekovox, venekovoxRegistry]),
  });
  await setSub1.wait();
  console.log(`  ✅ eth registry: venekovox -> ${venekovoxRegistry}`);

  // Now link people and polls on the venekovox registry
  console.log(`\nLinking people/polls subregistries on venekovox registry...`);

  const labelhash_people = BigInt(keccak256(toUtf8Bytes("people")));
  const setSub2 = await wallet.sendTransaction({
    to: venekovoxRegistry,
    data: permissionedRegistryAbi.encodeFunctionData("setSubregistry", [labelhash_people, profilesRegistry]),
  });
  await setSub2.wait();
  console.log(`  ✅ venekovox registry: people -> ${profilesRegistry}`);

  const labelhash_polls = BigInt(keccak256(toUtf8Bytes("polls")));
  const setSub3 = await wallet.sendTransaction({
    to: venekovoxRegistry,
    data: permissionedRegistryAbi.encodeFunctionData("setSubregistry", [labelhash_polls, pollsRegistry]),
  });
  await setSub3.wait();
  console.log(`  ✅ venekovox registry: polls -> ${pollsRegistry}`);

  console.log(`\n========================================`);
  console.log(`DONE. Config for prepareEnsRegistration:`);
  console.log(
    JSON.stringify(
      {
        profileRegistry: profilesRegistry,
        pollRegistry: pollsRegistry,
        profileParent: profileParent,
        pollParent: pollParent,
        operator: addr,
        maci: "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a",
        registrationExpiry: "1883503500",
      },
      null,
      2,
    ),
  );
  console.log(`========================================`);

  provider.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
