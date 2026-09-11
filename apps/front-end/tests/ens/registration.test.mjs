import { test } from "node:test";
import assert from "node:assert/strict";
import { getAddress, namehash, ZeroAddress } from "ethers";
import { ens, ensv2, pollName } from "./load.mjs";

const account = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
const registrar = "0x3333333333333333333333333333333333333333";
const profiles = "0x4444444444444444444444444444444444444444";
const parent = "people.venekovox.eth";
const name = "ada.people.venekovox.eth";
const factory = ensv2.SEPOLIA_ENSV2.VerifiableFactory;
const resolverImpl = ensv2.SEPOLIA_ENSV2.PermissionedResolverImpl;
const proxyLogic = ensv2.SEPOLIA_ENSV2.VerifiableFactoryProxyLogic;
const predicted = ensv2.predictOwnedResolver({ factory, proxyLogic, owner: account });

function config() {
  return {
    registrar,
    profileParent: parent,
    profileRegistry: profiles,
    operator: other,
    expiry: 2_000_000_000n,
    factory: getAddress(factory),
    resolverImpl: getAddress(resolverImpl),
    proxyLogic: getAddress(proxyLogic),
  };
}

function setupProvider({
  claimed = "",
  available = true,
  resolverCode = false,
  actualResolver = ZeroAddress,
  forward = ZeroAddress,
  chainId = 11155111n,
  theme = "",
} = {}) {
  const calls = [];
  const sent = [];
  const provider = {
    getNetwork: async () => ({ chainId }),
    getBlock: async () => ({ number: 10, hash: "0xabc", timestamp: 100 }),
    getCode: async (address) => {
      if (getAddress(address) === getAddress(predicted) && resolverCode) return "0x6000";
      if (getAddress(address) === getAddress(registrar)) return "0x6000";
      return "0x";
    },
    waitForTransaction: async (hash) => ({ hash, status: 1 }),
    call: async (tx) => {
      calls.push(tx);
      const data = tx.data;
      if (data.startsWith(ensv2.profilesAbi.getFunction("profileParent").selector)) {
        return ensv2.profilesAbi.encodeFunctionResult("profileParent", [parent]);
      }
      if (data.startsWith(ensv2.profilesAbi.getFunction("profileParentNode").selector)) {
        return ensv2.profilesAbi.encodeFunctionResult("profileParentNode", [namehash(parent)]);
      }
      if (data.startsWith(ensv2.profilesAbi.getFunction("profileRegistry").selector)) {
        return ensv2.profilesAbi.encodeFunctionResult("profileRegistry", [profiles]);
      }
      if (data.startsWith(ensv2.profilesAbi.getFunction("operator").selector)) {
        return ensv2.profilesAbi.encodeFunctionResult("operator", [other]);
      }
      if (data.startsWith(ensv2.profilesAbi.getFunction("registrationExpiry").selector)) {
        return ensv2.profilesAbi.encodeFunctionResult("registrationExpiry", [2_000_000_000n]);
      }
      if (data.startsWith(ensv2.profilesAbi.getFunction("factory").selector)) {
        return ensv2.profilesAbi.encodeFunctionResult("factory", [factory]);
      }
      if (data.startsWith(ensv2.profilesAbi.getFunction("resolverImpl").selector)) {
        return ensv2.profilesAbi.encodeFunctionResult("resolverImpl", [resolverImpl]);
      }
      if (data.startsWith(ensv2.profilesAbi.getFunction("profileName").selector)) {
        return ensv2.profilesAbi.encodeFunctionResult("profileName", [claimed]);
      }
      if (data.startsWith(ensv2.profilesAbi.getFunction("available").selector)) {
        return ensv2.profilesAbi.encodeFunctionResult("available", [available]);
      }
      if (data.startsWith(ensv2.factoryAbi.getFunction("proxyLogic").selector)) {
        return ensv2.factoryAbi.encodeFunctionResult("proxyLogic", [proxyLogic]);
      }
      if (data.startsWith(ensv2.registryAbi.getFunction("getSubregistry").selector)) {
        const label = ensv2.registryAbi.decodeFunctionData("getSubregistry", data)[0];
        if (label === "eth")
          return ensv2.registryAbi.encodeFunctionResult("getSubregistry", [ensv2.SEPOLIA_ENSV2.ETHRegistry]);
        if (label === "venekovox") return ensv2.registryAbi.encodeFunctionResult("getSubregistry", [other]);
        if (label === "people") return ensv2.registryAbi.encodeFunctionResult("getSubregistry", [profiles]);
        return ensv2.registryAbi.encodeFunctionResult("getSubregistry", [ZeroAddress]);
      }
      if (data.startsWith(ensv2.registryAbi.getFunction("getResolver").selector)) {
        return ensv2.registryAbi.encodeFunctionResult("getResolver", [actualResolver]);
      }
      if (tx.to && getAddress(tx.to) === getAddress(pollName.UNIVERSAL_RESOLVER)) {
        if (!forward || forward === ZeroAddress) throw new Error("no addr");
        const encoded = ensv2.addressAbi.encodeFunctionResult("addr", [forward]);
        return pollName.universalAbi.encodeFunctionResult("resolve", [encoded, actualResolver]);
      }
      if (data.startsWith(ensv2.addressAbi.getFunction("addr").selector)) {
        return ensv2.addressAbi.encodeFunctionResult("addr", [forward]);
      }
      if (data.startsWith(ensv2.textAbi.getFunction("text").selector)) {
        return ensv2.textAbi.encodeFunctionResult("text", [theme]);
      }
      throw new Error("unexpected call " + data.slice(0, 10));
    },
  };
  const wallet = {
    peek: async () => ({ kind: "injected", account, chainId: 11155111n }),
    send: async (call, context) => {
      sent.push({ call, context });
      if (wallet.failNext) {
        wallet.failNext = false;
        throw new Error("write rejected");
      }
      return "0x" + "ab".repeat(32);
    },
    subscribe: () => () => undefined,
    failNext: false,
  };
  return { provider, wallet, calls, sent };
}

test("wrong chain is rejected before any write", async () => {
  ens.resetInFlightForTests();
  const { provider, wallet } = setupProvider({ chainId: 1n });
  await assert.rejects(ens.readProfileSetup(provider, config(), account), /WRONG_CHAIN/);
  await assert.rejects(ens.claimProfile(wallet, provider, config(), { account, chainId: 1n }, "ada"), /WRONG_CHAIN/);
});

test("registration then rejected address write then reconnect completes without a second claim", async () => {
  ens.resetInFlightForTests();
  const first = setupProvider({ claimed: "", resolverCode: true, available: true });
  await ens.claimProfile(first.wallet, first.provider, config(), { account, chainId: 11155111n }, "ada");
  assert.equal(first.sent.length, 1);
  assert.equal(getAddress(first.sent[0].call.to), getAddress(registrar));
  assert.ok(first.sent[0].call.data.startsWith(ensv2.profilesAbi.getFunction("claimProfile").selector));

  const incomplete = setupProvider({
    claimed: name,
    resolverCode: true,
    actualResolver: predicted,
    forward: ZeroAddress,
  });
  const before = await ens.readProfileSetup(incomplete.provider, config(), account);
  assert.equal(before.phase, "incomplete");
  incomplete.wallet.failNext = true;
  await assert.rejects(
    ens.writeProfileRecords(incomplete.wallet, incomplete.provider, config(), { account, chainId: 11155111n }, "lime"),
    /write rejected/,
  );
  const still = await ens.readProfileSetup(incomplete.provider, config(), account);
  assert.equal(still.phase, "incomplete");
  const claimCalls = incomplete.sent.filter((row) =>
    row.call.data.startsWith(ensv2.profilesAbi.getFunction("claimProfile").selector),
  );
  assert.equal(claimCalls.length, 0);

  const done = setupProvider({
    claimed: name,
    resolverCode: true,
    actualResolver: predicted,
    forward: account,
    theme: "lime",
  });
  await ens.writeProfileRecords(done.wallet, done.provider, config(), { account, chainId: 11155111n }, "lime");
  const ready = await ens.readProfileSetup(done.provider, config(), account);
  assert.equal(ready.phase, "ready");
  assert.equal(ready.forwardAddr, getAddress(account));
  assert.equal(
    done.sent.filter((row) => row.call.data.startsWith(ensv2.profilesAbi.getFunction("claimProfile").selector)).length,
    0,
  );
});

test("duplicate in-flight submit of the same operation is rejected", async () => {
  ens.resetInFlightForTests();
  const { provider } = setupProvider({ claimed: "", resolverCode: false });
  let release;
  const hanging = {
    peek: async () => ({ kind: "injected", account, chainId: 11155111n }),
    send: () =>
      new Promise((resolve, reject) => {
        release = reject;
      }),
    subscribe: () => () => undefined,
  };
  const first = ens.deployOwnedResolver(hanging, provider, config(), { account, chainId: 11155111n });
  await new Promise((resolve) => setTimeout(resolve, 10));
  await assert.rejects(
    ens.deployOwnedResolver(hanging, provider, config(), { account, chainId: 11155111n }),
    /IN_FLIGHT/,
  );
  assert.equal(ens.isInFlight(account, "deployResolver"), true);
  release(new Error("cleanup"));
  await assert.rejects(first);
});

test("account switch mid-flight is a context change, not a retry of claim", async () => {
  ens.resetInFlightForTests();
  const { provider } = setupProvider({ claimed: "", resolverCode: true, available: true });
  const wallet = {
    peek: async () => ({ kind: "injected", account: other, chainId: 11155111n }),
    send: async (_call, context) => {
      if (getAddress(context.account) !== getAddress(other)) throw new ens.NamingError("CONTEXT_CHANGED");
      return "0x" + "cd".repeat(32);
    },
    subscribe: () => () => undefined,
  };
  await assert.rejects(
    ens.claimProfile(wallet, provider, config(), { account, chainId: 11155111n }, "ada"),
    /CONTEXT_CHANGED/,
  );
});

test("already named accounts cannot claim a second label", async () => {
  ens.resetInFlightForTests();
  const { provider, wallet } = setupProvider({ claimed: name, resolverCode: true });
  await assert.rejects(
    ens.claimProfile(wallet, provider, config(), { account, chainId: 11155111n }, "ada"),
    /ALREADY_NAMED/,
  );
});

test("unavailable labels are rejected", async () => {
  ens.resetInFlightForTests();
  const { provider, wallet } = setupProvider({ claimed: "", resolverCode: true, available: false });
  await assert.rejects(
    ens.claimProfile(wallet, provider, config(), { account, chainId: 11155111n }, "ada"),
    /NAME_UNAVAILABLE/,
  );
});
