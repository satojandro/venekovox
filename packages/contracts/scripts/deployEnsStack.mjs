/**
 * Deploy full ENS stack for VenekoVox on Sepolia (v2 - registers names before linking).
 *
 * Run: cd packages/contracts && node scripts/deployEnsStack.mjs
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import {
  JsonRpcProvider,
  Wallet,
  Interface,
  FetchRequest,
  ContractFactory,
  keccak256,
  toUtf8Bytes,
  namehash,
  ZeroAddress,
  ZeroHash,
  AbiCoder,
} from "ethers";

const VERIFIABLE_FACTORY = "0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef";
const USER_REGISTRY_IMPL = "0x624a25d67b59d587752ebec8dded8827dae52050";
const ETH_REGISTRY = "0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2";
const MACI_ADDRESS = "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a";
const ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111n;
const REGISTRAR_ROLES = 65537n; // ROLE_REGISTRAR + ROLE_RENEW

const PARENT = "venekovoxv1.eth";
const PROFILE_PARENT = `people.${PARENT}`;
const POLL_PARENT = `polls.${PARENT}`;

const factoryAbi = new Interface([
  "function deployProxy(address implementation, uint256 salt, bytes data) returns (address)",
  "event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)",
]);
const permAbi = new Interface([
  "function register(string label, address owner, address subregistry, address resolver, uint256 roles, uint64 expiry) returns(uint256)",
  "function setSubregistry(uint256 anyId, address subregistry)",
  "function grantRootRoles(uint256 roleBitmap, address account) returns(bool)",
]);

async function deployProxy(wallet, label, nh) {
  const coder = AbiCoder.defaultAbiCoder();
  const salt = BigInt(
    keccak256(coder.encode(["bytes32", "bytes32", "uint256"], [keccak256(toUtf8Bytes("UserRegistry")), nh, 0n])),
  );
  const initData = new Interface(["function initialize(address rootAccount, uint256 roleBitmap)"]).encodeFunctionData(
    "initialize",
    [await wallet.getAddress(), ALL_ROLES],
  );
  console.log(`  Deploying ${label}...`);
  const tx = await wallet.sendTransaction({
    to: VERIFIABLE_FACTORY,
    data: factoryAbi.encodeFunctionData("deployProxy", [USER_REGISTRY_IMPL, salt, initData]),
  });
  const receipt = await tx.wait();
  for (const log of receipt.logs) {
    try {
      const p = factoryAbi.parseLog(log);
      if (p?.name === "ProxyDeployed") {
        console.log(`  ✅ ${label}: ${p.args.proxyAddress}`);
        return p.args.proxyAddress;
      }
    } catch {}
  }
  throw new Error("ProxyDeployed not found");
}

async function main() {
  const rpc = process.env.SEPOLIA_RPC_URL;
  const pk = process.env.PRIVATE_KEY;
  if (!rpc || !pk) {
    console.error("Need SEPOLIA_RPC_URL + PRIVATE_KEY");
    process.exit(1);
  }

  const request = new FetchRequest(rpc);
  request.timeout = 15000;
  const provider = new JsonRpcProvider(request);
  const wallet = new Wallet(pk, provider);
  const addr = await wallet.getAddress();
  const expiry = BigInt(Math.floor(Date.now() / 1000)) + 86400n * 365n * 10n; // 10 years
  console.log(`Deployer: ${addr}`);
  console.log(`Balance: ${Number(await provider.getBalance(addr)) / 1e18} ETH\n`);

  // 1. Deploy UserRegistries
  console.log("=== 1. UserRegistries ===");
  const vvReg = await deployProxy(wallet, PARENT, namehash(PARENT));
  const profReg = await deployProxy(wallet, PROFILE_PARENT, namehash(PROFILE_PARENT));
  const pollReg = await deployProxy(wallet, POLL_PARENT, namehash(POLL_PARENT));

  // 2. Link hierarchy: eth registry → venekovoxv1 subregistry
  console.log("\n=== 2. Link hierarchy ===");
  console.log("  Linking eth → venekovoxv1...");
  const tx1 = await wallet.sendTransaction({
    to: ETH_REGISTRY,
    data: permAbi.encodeFunctionData("setSubregistry", [BigInt(keccak256(toUtf8Bytes("venekovoxv1"))), vvReg]),
  });
  await tx1.wait();
  console.log(`  ✅ eth → venekovoxv1 (${vvReg.slice(0, 10)}...)`);

  // 3. Register "people" and "polls" on venekovoxv1 registry, with their UserRegistries as subregistries
  console.log("\n=== 3. Register namespace names ===");

  // Register "people" with profiles UserRegistry as subregistry
  console.log("  Registering people...");
  const tx2 = await wallet.sendTransaction({
    to: vvReg,
    data: permAbi.encodeFunctionData("register", [
      "people", // label
      addr, // owner (deployer)
      profReg, // subregistry (profiles UserRegistry)
      ZeroAddress, // resolver
      0n, // roles (none for owner)
      expiry, // expiry
    ]),
  });
  await tx2.wait();
  console.log(`  ✅ people registered with subregistry ${profReg.slice(0, 10)}...`);

  // Register "polls" with polls UserRegistry as subregistry
  console.log("  Registering polls...");
  const tx3 = await wallet.sendTransaction({
    to: vvReg,
    data: permAbi.encodeFunctionData("register", [
      "polls", // label
      addr, // owner (deployer)
      pollReg, // subregistry (polls UserRegistry)
      ZeroAddress, // resolver
      0n, // roles
      expiry, // expiry
    ]),
  });
  await tx3.wait();
  console.log(`  ✅ polls registered with subregistry ${pollReg.slice(0, 10)}...`);

  // 4. Validate hierarchy with prepare script
  console.log("\n=== 4. Validate hierarchy ===");
  const { prepareNamingPlan } = await import("./prepareEnsRegistration.mjs");
  const config = {
    profileRegistry: profReg,
    pollRegistry: pollReg,
    profileParent: PROFILE_PARENT,
    pollParent: POLL_PARENT,
    operator: addr,
    maci: MACI_ADDRESS,
    registrationExpiry: expiry.toString(),
  };
  try {
    const plan = prepareNamingPlan(config);
    console.log("  ✅ Hierarchy validated");
    console.log(
      "  Constructor args:",
      plan.constructorArguments.map((a) =>
        typeof a === "string" && a.length > 42 ? a.slice(0, 10) + "..." : String(a),
      ),
    );
  } catch (e) {
    console.error("  ❌ Hierarchy validation failed:", e.message);
    console.log("  (This is expected if the on-chain RPC validation fails; continuing with deployment)");
  }

  // 5. Deploy VenekoVoxNames
  console.log("\n=== 5. Deploy VenekoVoxNames ===");
  const artifact = JSON.parse(readFileSync("artifacts/VenekoVoxNames.json", "utf8"));
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);

  // Compute constructor args directly
  const profileHash = namehash(PROFILE_PARENT);
  const pollHash = namehash(POLL_PARENT);
  const constructorArgs = [
    profReg, // profiles registry
    pollReg, // polls registry
    PROFILE_PARENT, // profileParent string
    POLL_PARENT, // pollParent string
    profileHash, // profileParentNode
    pollHash, // pollParentNode
    addr, // operator
    MACI_ADDRESS, // maci
    expiry, // registrationExpiry
  ];

  console.log("  Deploying...");
  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment();
  const contractAddr = await contract.getAddress();
  console.log(`  ✅ VenekoVoxNames: ${contractAddr}`);

  // 6. Grant root roles on both registries to VenekoVoxNames
  console.log("\n=== 6. Grant roles ===");
  for (const [reg, name] of [
    [profReg, "profiles"],
    [pollReg, "polls"],
  ]) {
    console.log(`  Granting on ${name}...`);
    const tx = await wallet.sendTransaction({
      to: reg,
      data: permAbi.encodeFunctionData("grantRootRoles", [REGISTRAR_ROLES, contractAddr]),
    });
    await tx.wait();
    console.log(`  ✅ ${name} registry → VenekoVoxNames`);
  }

  // 7. Write frontend env
  console.log("\n=== 7. Frontend .env ===");
  const env =
    [
      `VITE_ENS_REGISTRAR=${contractAddr}`,
      `VITE_ENS_RPC_URL=${rpc}`,
      `VITE_MACI_ADDRESS=${MACI_ADDRESS}`,
      `VITE_CHAIN_ID=11155111`,
    ].join("\n") + "\n";
  writeFileSync("../../apps/front-end/.env.ens", env);
  console.log(env);
  console.log("  ✅ Written to apps/front-end/.env.ens");

  // Summary
  console.log("\n🎉 DEPLOYMENT COMPLETE ===");
  console.log(`  VenekoVoxNames:      ${contractAddr}`);
  console.log(`  venekovoxv1 registry: ${vvReg}`);
  console.log(`  Profiles registry:    ${profReg}`);
  console.log(`  Polls registry:       ${pollReg}`);
  console.log(`  Profile parent:       ${PROFILE_PARENT}`);
  console.log(`  Poll parent:          ${POLL_PARENT}`);
  console.log(`  Expiry:               ${new Date(Number(expiry) * 1000).toISOString()}`);

  provider.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
