// Read-only constructor/calldata preparation. Never loads a signer or a private key.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  Interface,
  JsonRpcProvider,
  FetchRequest,
  ZeroAddress,
  ensNormalize,
  dnsEncode,
  getAddress,
  namehash,
} from "ethers";

export function prepareNamingPlan(input) {
  const address = (value) => {
    const result = getAddress(value);
    if (result === ZeroAddress) throw Error("Zero address");
    return result;
  };
  const parent = (value) => {
    const normalized = ensNormalize(value);
    if (normalized !== value || !value.endsWith(".eth") || value.length > 222)
      throw Error("Use a normalized .eth parent of at most 222 characters");
    dnsEncode(value);
    return value;
  };
  const profileParent = parent(input.profileParent),
    pollParent = parent(input.pollParent);
  const profiles = address(input.profileRegistry),
    polls = address(input.pollRegistry);
  if (profileParent === pollParent || profiles === polls) throw Error("Use separate profile and poll namespaces");
  if (typeof input.registrationExpiry !== "string" || !/^[1-9][0-9]*$/.test(input.registrationExpiry))
    throw Error("Expiry must be an absolute Unix timestamp string");
  const expiry = BigInt(input.registrationExpiry);
  if (expiry >= 1n << 64n) throw Error("Expiry overflows uint64");
  const args = [
    profiles,
    polls,
    profileParent,
    pollParent,
    namehash(profileParent),
    namehash(pollParent),
    address(input.operator),
    address(input.maci),
    expiry.toString(),
  ];
  const plan = { chainId: "11155111", contract: "VenekoVoxNames", constructorArguments: args, authorizations: [] };
  if (input.registrar) {
    const registrar = address(input.registrar);
    const abi = new Interface(["function grantRootRoles(uint256 roleBitmap,address account) returns(bool)"]);
    // Registrar + renew permit available labels, including previously expired registry entries.
    plan.authorizations = [profiles, polls].map((to) => ({
      to,
      value: "0",
      data: abi.encodeFunctionData("grantRootRoles", [65537n, registrar]),
    }));
  }
  return plan;
}

async function main() {
  if (process.argv[2] === "--help" || !process.argv[2]) {
    console.log(
      "ENS_RPC_URL=<Sepolia endpoint> node scripts/prepareEnsRegistration.mjs <public-config.json>\nReads chain configuration and prints constructor arguments. Optional registrar adds unsigned role-grant calldata. No transactions are sent.",
    );
    return;
  }
  const input = JSON.parse(readFileSync(process.argv[2], "utf8")),
    plan = prepareNamingPlan(input);
  const rpc = process.env.ENS_RPC_URL;
  if (!rpc || !["http:", "https:"].includes(new URL(rpc).protocol)) throw Error("ENS_RPC_URL required");
  const request = new FetchRequest(rpc);
  request.timeout = 15000;
  const provider = new JsonRpcProvider(request);
  try {
    if ((await provider.getNetwork()).chainId !== 11155111n) throw Error("Wrong RPC chain");
    const block = await provider.getBlock("latest");
    if (!block?.hash || BigInt(input.registrationExpiry) <= BigInt(block.timestamp))
      throw Error("Expiry must be in the future");
    for (const value of [
      input.profileRegistry,
      input.pollRegistry,
      input.maci,
      ...(input.registrar ? [input.registrar] : []),
    ]) {
      if ((await provider.getCode(value, block.number)) === "0x") throw Error("Missing deployed contract");
    }
    const abi = new Interface(["function getSubregistry(string label) view returns(address)"]);
    for (const [name, expected] of [
      [input.profileParent, input.profileRegistry],
      [input.pollParent, input.pollRegistry],
    ]) {
      let registry = "0x8115186e8f2e0b0281e86ab91f0f48ba90364354";
      for (const label of name.split(".").reverse()) {
        const raw = await provider.call({
          to: registry,
          blockTag: block.number,
          data: abi.encodeFunctionData("getSubregistry", [label]),
        });
        registry = getAddress(abi.decodeFunctionResult("getSubregistry", raw)[0]);
        if (registry === ZeroAddress) throw Error("Parent hierarchy is not linked");
      }
      if (registry !== getAddress(expected)) throw Error("Parent registry mismatch");
    }
    if ((await provider.getBlock(block.number))?.hash !== block.hash) throw Error("Chain snapshot changed");
    console.log(JSON.stringify({ ...plan, checkedBlock: block.number, checkedBlockHash: block.hash }, null, 2));
  } finally {
    provider.destroy();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // RPC errors can include credential-bearing URLs; don't echo the provider error.
    console.error(
      "Preparation failed. Check public config, Sepolia RPC, deployed code, future expiry and ENS parent links. No transaction was sent.",
    );
    process.exitCode = 1;
  });
}
