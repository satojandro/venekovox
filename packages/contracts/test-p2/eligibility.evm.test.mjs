// Focused local-EVM integration suite. See docs/build.md P2 commands for pinned test tooling.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const require = createRequire(process.env.P2_TOOLCHAIN_PACKAGE_JSON || import.meta.url);
const solc = require("solc");
const ganache = require("ganache");
const { BrowserProvider, ContractFactory, Wallet, keccak256, toUtf8Bytes } = require("ethers");
import { load } from "../../../apps/backend/tests/p2/load.mjs";
const { AUTHORIZATION_TYPES, authorizationDomain, encodeAuthorization } = await load(
  "../../src/eligibility/authorization.ts",
);
const { accountControlVerifier } = await load("../../src/eligibility/accountControl.ts");
const fixture = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IBasePolicy} from "@excubiae/contracts/contracts/interfaces/IBasePolicy.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
contract Target {
 IBasePolicy public policy; uint public count;
 constructor(address p){policy=IBasePolicy(p);}
 function enter(bytes calldata evidence,bool failAfter) external {
  policy.enforce(msg.sender,evidence); require(!failAfter,"DOWNSTREAM_REVERT"); count++;
 }
}
contract Account {
 address public immutable owner; constructor(address a){owner=a;}
 function execute(address target,bytes calldata evidence) external {
  require(msg.sender==owner,"OWNER_ONLY"); Target(target).enter(evidence,false);
 }
 function isValidSignature(bytes32 digest,bytes calldata signature) external view returns(bytes4){
  return ECDSA.recover(digest,signature)==owner ? bytes4(0x1626ba7e):bytes4(0xffffffff);
 }
}`;
let rpc, provider, owner, alice, bob, artifacts;
const issuer = Wallet.createRandom();
const cfg = {
  chainId: 1337n,
  configId: keccak256(toUtf8Bytes("passport-18-v1")),
  action: keccak256(toUtf8Bytes("signup")),
};
before(async () => {
  const policyPath = fileURLToPath(new URL("../contracts/eligibility/SelfEligibilityPolicy.sol", import.meta.url));
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: {
          "SelfEligibilityPolicy.sol": { content: readFileSync(policyPath, "utf8") },
          "Fixture.sol": { content: fixture },
        },
        settings: {
          evmVersion: "shanghai",
          optimizer: { enabled: true, runs: 200 },
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      }),
      {
        import: (path) => {
          for (const base of require.resolve.paths(path) ?? []) {
            try {
              return { contents: readFileSync(join(base, path), "utf8") };
            } catch {}
          }
          return { error: "Missing import " + path };
        },
      },
    ),
  );
  assert.deepEqual(
    (output.errors ?? []).filter((e) => e.severity === "error"),
    [],
  );
  artifacts = { ...output.contracts["SelfEligibilityPolicy.sol"], ...output.contracts["Fixture.sol"] };
  rpc = ganache.provider({
    logging: { quiet: true },
    chain: { chainId: 1337, hardfork: "shanghai" },
    wallet: { totalAccounts: 4 },
  });
  provider = new BrowserProvider(rpc);
  provider.pollingInterval = 10;
  [owner, alice, bob] = await Promise.all([0, 1, 2].map((i) => provider.getSigner(i)));
});
after(async () => {
  await rpc?.disconnect();
});
async function deploy(name, args = []) {
  const a = artifacts[name];
  const c = await new ContractFactory(a.abi, a.evm.bytecode.object, owner).deploy(...args);
  await c.waitForDeployment();
  return c;
}
async function setup(bind = true) {
  const p = await deploy("SelfEligibilityPolicy", [await owner.getAddress(), issuer.address, cfg.configId, cfg.action]);
  const target = await deploy("Target", [await p.getAddress()]);
  if (bind) await (await p.setTarget(await target.getAddress())).wait();
  return { p, target };
}
async function grant(f, account, overrides = {}, domainOverrides = {}, signer = issuer) {
  const block = await provider.send("eth_getBlockByNumber", ["latest", false]);
  const now = Number(BigInt(block.timestamp));
  const a = {
    account,
    target: await f.target.getAddress(),
    identityTag: keccak256(toUtf8Bytes("one-document")),
    configId: cfg.configId,
    action: cfg.action,
    nonce: keccak256(toUtf8Bytes("challenge")),
    issuedAt: now,
    expiresAt: now + 300,
    ...overrides,
  };
  const domain = { ...authorizationDomain({ ...cfg, policyAddress: await f.p.getAddress() }), ...domainOverrides };
  const signature = await signer.signTypedData(domain, AUTHORIZATION_TYPES, a);
  return { a, signature, evidence: encodeAuthorization(a, signature), domain };
}
test("EOA valid authorization consumed by target, digest matches offchain signer", async () => {
  const f = await setup(),
    g = await grant(f, await alice.getAddress());
  await (await f.target.connect(alice).enter(g.evidence, false)).wait();
  assert.equal(await f.target.count(), 1n);
  assert.equal(await f.p.usedAccounts(await alice.getAddress()), true);
  assert.equal(await f.p.usedIdentityTags(g.a.identityTag), true);
  await assert.rejects(f.target.connect(alice).enter.staticCall(g.evidence, false));
});
test("arbitrary callers cannot consume someone else's authorization directly", async () => {
  const f = await setup(),
    g = await grant(f, await alice.getAddress());
  await assert.rejects(f.p.connect(bob).enforce.staticCall(await alice.getAddress(), g.evidence));
  assert.equal(await f.p.usedIdentityTags(g.a.identityTag), false);
  await assert.rejects(f.target.connect(bob).enter.staticCall(g.evidence, false));
});
test("missing evidence cannot bypass eligibility", async () => {
  const f = await setup();
  await assert.rejects(f.target.connect(alice).enter.staticCall("0x", false));
});
test("target is owner-bound once, requires contract code and rejects unbound enforcement", async () => {
  const f = await setup(false),
    g = await grant(f, await alice.getAddress());
  await assert.rejects(f.target.connect(alice).enter.staticCall(g.evidence, false));
  await assert.rejects(f.p.connect(bob).setTarget.staticCall(await f.target.getAddress()));
  await assert.rejects(f.p.setTarget.staticCall(await alice.getAddress()));
  await (await f.p.setTarget(await f.target.getAddress())).wait();
  await assert.rejects(f.p.setTarget.staticCall(await f.target.getAddress()));
});
test("chain/policy/target/config/action/issuer/expiry are all bound", async () => {
  const f = await setup(),
    account = await alice.getAddress();
  const block = await provider.send("eth_getBlockByNumber", ["latest", false]);
  const now = Number(BigInt(block.timestamp));
  const cases = [
    [{}, { chainId: 1n }],
    [{}, { verifyingContract: await alice.getAddress() }],
    [{ target: await bob.getAddress() }],
    [{ configId: keccak256(toUtf8Bytes("other")) }],
    [{ action: keccak256(toUtf8Bytes("join")) }],
    [{ expiresAt: now }],
    [{ issuedAt: now + 30 }],
    [{ expiresAt: now + 901 }],
    [{ identityTag: "0x" + "00".repeat(32) }],
    [{ nonce: "0x" + "00".repeat(32) }],
  ];
  for (const [overrides, domain = {}] of cases) {
    const g = await grant(f, account, overrides, domain);
    await assert.rejects(f.target.connect(alice).enter.staticCall(g.evidence, false));
  }
  const wrong = await grant(f, account, {}, {}, Wallet.createRandom());
  await assert.rejects(f.target.connect(alice).enter.staticCall(wrong.evidence, false));
});
test("same identity under a second account and second identity under same account are rejected", async () => {
  const f = await setup(),
    g = await grant(f, await alice.getAddress());
  await (await f.target.connect(alice).enter(g.evidence, false)).wait();
  const second = await grant(f, await bob.getAddress(), { nonce: keccak256(toUtf8Bytes("second")) });
  await assert.rejects(f.target.connect(bob).enter.staticCall(second.evidence, false));
  const another = await grant(f, await alice.getAddress(), { identityTag: keccak256(toUtf8Bytes("another")) });
  await assert.rejects(f.target.connect(alice).enter.staticCall(another.evidence, false));
});
test("downstream revert rolls back consumption; retry succeeds", async () => {
  const f = await setup(),
    g = await grant(f, await alice.getAddress());
  await assert.rejects(
    (async () => {
      const tx = await f.target.connect(alice).enter(g.evidence, true, { gasLimit: 500000 });
      await tx.wait();
    })(),
  );
  assert.equal(await f.p.usedIdentityTags(g.a.identityTag), false);
  await (await f.target.connect(alice).enter(g.evidence, false)).wait();
  assert.equal(await f.target.count(), 1n);
});
test("contract account works through forwarder; owner address cannot replace actual caller", async () => {
  const f = await setup(),
    account = await deploy("Account", [await alice.getAddress()]);
  const g = await grant(f, await account.getAddress());
  await (await account.connect(alice).execute(await f.target.getAddress(), g.evidence)).wait();
  assert.equal(await f.p.usedAccounts(await account.getAddress()), true);
  assert.equal(await f.p.usedAccounts(await alice.getAddress()), false);
  const f2 = await setup(),
    wrong = await grant(f2, await alice.getAddress());
  await assert.rejects(account.connect(alice).execute.staticCall(await f2.target.getAddress(), wrong.evidence));
});
test("real deployed ERC-1271 account validates account-control challenge", async () => {
  const signer = Wallet.createRandom(),
    account = await deploy("Account", [signer.address]);
  const verify = accountControlVerifier(provider, 1337n),
    message = "p2-test challenge";
  assert.equal(await verify(await account.getAddress(), message, await signer.signMessage(message)), true);
  assert.equal(await verify(await account.getAddress(), message, await issuer.signMessage(message)), false);
});
