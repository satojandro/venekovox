import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.env.ENS_TOOLCHAIN_PACKAGE_JSON || import.meta.url);
const solc = require("solc");
const ganache = require("ganache");
const { BrowserProvider, ContractFactory, namehash, id, ZeroAddress } = require("ethers");

// ABI-faithful test double, NOT the upstream ENSv2 implementation.
const fixture = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {INameRegistryV2} from "VenekoVoxNames.sol";
contract RegistryDouble is INameRegistryV2 {
 mapping(uint256 => State) private states;
 mapping(string => address) private resolvers;
 address public registrar;
 function authorize(address a) external { registrar = a; }
 function getState(uint256 key) external view returns(State memory) { return states[key]; }
 function getResolver(string calldata label) external view returns(address) { return resolvers[label]; }
 function register(string calldata label,address owner,address,address resolver,uint256 roles,uint64 expiry)
 external returns(uint256 key) {
   require(msg.sender == registrar,"ROLE_REQUIRED"); require(roles == 0,"UNEXPECTED_ROLES");
   key=uint256(keccak256(bytes(label))); require(states[key].status == 0,"COLLISION");
   states[key]=State(2,expiry,owner,key,key); resolvers[label]=resolver;
 }
 function alter(string calldata label,address owner,address resolver,uint8 status) external {
   states[uint256(keccak256(bytes(label)))].latestOwner=owner;
   states[uint256(keccak256(bytes(label)))].status=status; resolvers[label]=resolver;
 }
 function reregister(string calldata label) external { states[uint256(keccak256(bytes(label)))].resource++; }
}
contract MaciDouble {
 address public poll; constructor(address p) { poll=p; }
 function getPoll(uint256 n) external view returns(address,address,address) {
   return(n == 7 ? poll : address(0),address(0),address(0));
 }
}
contract PollDouble { function getStartAndEndDate() external pure returns(uint256,uint256) { return(1,2000000000); } }
contract AccountDouble {
 address immutable owner; constructor() { owner=msg.sender; }
 function execute(address target, bytes calldata data) external {
   require(msg.sender==owner); (bool ok,bytes memory result)=target.call(data);
   if(!ok) assembly { revert(add(result,32),mload(result)) }
 }
}`;
let rpc, provider, admin, alice, bob, artifacts;
before(async () => {
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: {
          "VenekoVoxNames.sol": {
            content: readFileSync(new URL("../contracts/ens/VenekoVoxNames.sol", import.meta.url), "utf8"),
          },
          "Fixture.sol": { content: fixture },
        },
        settings: {
          evmVersion: "shanghai",
          optimizer: { enabled: true, runs: 200 },
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      }),
    ),
  );
  assert.deepEqual(
    (output.errors ?? []).filter((e) => e.severity === "error"),
    [],
  );
  artifacts = { ...output.contracts["VenekoVoxNames.sol"], ...output.contracts["Fixture.sol"] };
  rpc = ganache.provider({
    logging: { quiet: true },
    chain: { chainId: 11155111, hardfork: "shanghai" },
    wallet: { totalAccounts: 4 },
  });
  provider = new BrowserProvider(rpc);
  provider.pollingInterval = 10;
  [admin, alice, bob] = await Promise.all([0, 1, 2].map((i) => provider.getSigner(i)));
});
after(async () => {
  provider?.destroy();
  await rpc?.disconnect();
});
async function deploy(name, args = []) {
  const a = artifacts[name];
  const c = await new ContractFactory(a.abi, a.evm.bytecode.object, admin).deploy(...args);
  await c.waitForDeployment();
  return c;
}
async function setup() {
  const profiles = await deploy("RegistryDouble"),
    polls = await deploy("RegistryDouble");
  const poll = await deploy("PollDouble"),
    maci = await deploy("MaciDouble", [await poll.getAddress()]);
  const expiry = BigInt((await provider.getBlock("latest")).timestamp) + 3600n;
  const names = await deploy("VenekoVoxNames", [
    await profiles.getAddress(),
    await polls.getAddress(),
    "people.example.eth",
    "polls.example.eth",
    namehash("people.example.eth"),
    namehash("polls.example.eth"),
    await admin.getAddress(),
    await maci.getAddress(),
    expiry,
  ]);
  for (const registry of [profiles, polls]) await (await registry.authorize(await names.getAddress())).wait();
  return { names, profiles, polls, poll, maci, expiry };
}
test("claim assigns registry ownership and forward address to the caller; reconnect uses chain state", async () => {
  const { names, profiles, expiry } = await setup();
  await (await names.connect(alice).claimProfile("alice")).wait();
  const state = await profiles.getState(id("alice"));
  assert.equal(state.latestOwner, await alice.getAddress());
  assert.equal(state.expiry, expiry);
  assert.equal(await names.addr(namehash("alice.people.example.eth")), await alice.getAddress());
  assert.equal(await names.profileName(await alice.getAddress()), "alice.people.example.eth");
  assert.equal(await names.profileName(await bob.getAddress()), "");
});
test("duplicate labels and second names revert without overwriting ownership", async () => {
  const { names } = await setup();
  await (await names.connect(alice).claimProfile("alice")).wait();
  await assert.rejects(names.connect(bob).claimProfile("alice"));
  await assert.rejects(names.connect(alice).claimProfile("second"));
  assert.equal(await names.profileNode(await bob.getAddress()), "0x" + "0".repeat(64));
});
test("smart-account execution assigns the name to the contract account, not its signing owner", async () => {
  const { names } = await setup();
  const account = await deploy("AccountDouble");
  await (
    await account.execute(
      await names.getAddress(),
      names.interface.encodeFunctionData("claimProfile", ["smart-account"]),
    )
  ).wait();
  assert.equal(await names.profileName(await account.getAddress()), "smart-account.people.example.eth");
  assert.equal(await names.profileName(await admin.getAddress()), "");
});
test("operator names a real poll atomically; profile claims cannot squat poll labels", async () => {
  const { names, poll, maci, polls } = await setup();
  await (await names.connect(alice).claimProfile("climate")).wait();
  await assert.rejects(names.connect(alice).namePoll("climate", 7));
  await assert.rejects(names.namePoll("missing", 99));
  await (await names.namePoll("climate", 7)).wait();
  assert.deepEqual(JSON.parse(await names.text(namehash("climate.polls.example.eth"), "xyz.venekovox.poll")), {
    version: 1,
    chainId: "11155111",
    maci: (await maci.getAddress()).toLowerCase(),
    pollId: "7",
    poll: (await poll.getAddress()).toLowerCase(),
  });
  assert.equal((await polls.getState(id("climate"))).latestOwner, await admin.getAddress());
  await assert.rejects(names.namePoll("another", 7));
});
test("invalid labels and missing registrar permission cannot create a profile", async () => {
  const { names, profiles } = await setup();
  for (const label of ["", "ab", "-alice", "alice-", "Alice", "a.b", "émoji", "ab--cd", "xn--foo", "x".repeat(33)]) {
    assert.equal(await names.validLabel(label), false);
    await assert.rejects(names.connect(alice).claimProfile(label));
  }
  await (await profiles.authorize(ZeroAddress)).wait();
  await assert.rejects(names.connect(alice).claimProfile("alice"));
  assert.equal(await names.profileName(await alice.getAddress()), "");
});
test("stale ownership, resolver and registration state do not restore a false identity", async () => {
  const { names, profiles } = await setup();
  await (await names.connect(alice).claimProfile("alice")).wait();
  for (const [owner, resolver, status] of [
    [await bob.getAddress(), await names.getAddress(), 2],
    [await alice.getAddress(), ZeroAddress, 2],
    [await alice.getAddress(), await names.getAddress(), 0],
  ]) {
    await (await profiles.alter("alice", owner, resolver, status)).wait();
    assert.equal(await names.profileName(await alice.getAddress()), "");
    assert.equal(await names.addr(namehash("alice.people.example.eth")), ZeroAddress);
  }
});
test("re-registration to the same owner cannot revive records from an older ENS resource", async () => {
  const { names, profiles } = await setup();
  await (await names.connect(alice).claimProfile("alice")).wait();
  await (await profiles.reregister("alice")).wait();
  assert.equal(await names.profileName(await alice.getAddress()), "");
});
test("expiry disables recovery and claims; unknown records stay empty", async () => {
  const { names } = await setup();
  await (await names.connect(alice).claimProfile("alice")).wait();
  assert.equal(await names.text(namehash("alice.people.example.eth"), "xyz.venekovox.poll"), "");
  await rpc.request({ method: "evm_increaseTime", params: [3601] });
  await rpc.request({ method: "evm_mine", params: [] });
  assert.equal(await names.profileName(await alice.getAddress()), "");
  assert.equal(await names.available("another", false), false);
  await assert.rejects(names.connect(bob).claimProfile("another"));
});
