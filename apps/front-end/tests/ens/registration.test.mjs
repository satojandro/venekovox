import { test } from "node:test";
import assert from "node:assert/strict";
import { load, ethers } from "./load.mjs";
const { Interface, namehash, ZeroAddress } = ethers;
const { registerName, readNamingConfig, recoverProfile, normalizeLabel, namesAbi, addressAbi } = await load(
  "../../src/ens/registration.ts",
);
const { UNIVERSAL_RESOLVER, universalAbi, textAbi, maciAbi, pollAbi } = await load("../../src/ens/pollName.ts");
const registrar = "0x1111111111111111111111111111111111111111";
const maci = "0x2222222222222222222222222222222222222222";
const account = "0x3333333333333333333333333333333333333333";
const profiles = "0x4444444444444444444444444444444444444444";
const polls = "0x5555555555555555555555555555555555555555";
const poll = "0x6666666666666666666666666666666666666666";
const hash = "0x" + "ab".repeat(32);
const parentAbi = new Interface(["function getSubregistry(string label) view returns(address)"]);
function setup(options = {}) {
  let listener,
    submitted = false,
    sends = 0;
  const session = { kind: "found", account, chainId: 11155111n };
  const config = {
    registrar,
    profileParent: "people.example.eth",
    pollParent: "polls.example.eth",
    operator: account,
    maci,
    expiry: 500n,
  };
  const record = { version: 1, chainId: "11155111", maci, pollId: "7", poll };
  const values = {
    ...config,
    registrationExpiry: config.expiry,
    profileParentNode: namehash(config.profileParent),
    pollParentNode: namehash(config.pollParent),
    profileRegistry: profiles,
    pollRegistry: polls,
  };
  const provider = {
    getNetwork: async () => ({ chainId: options.chain ?? 11155111n }),
    getBlock: async (tag) => ({
      number: 10,
      hash: options.reorg && tag !== "latest" ? "changed" : "blockhash",
      timestamp: 100,
    }),
    getCode: async () => "0x6000",
    call: async (tx) => {
      if (tx.data.startsWith(parentAbi.getFunction("getSubregistry").selector)) {
        const [label] = parentAbi.decodeFunctionData("getSubregistry", tx.data);
        return parentAbi.encodeFunctionResult("getSubregistry", [
          options.unlinked ? ZeroAddress : label === "people" ? profiles : label === "polls" ? polls : maci,
        ]);
      }
      if (tx.to === registrar) {
        const parsed = namesAbi.parseTransaction(tx),
          method = parsed.name;
        if (method === "available") return namesAbi.encodeFunctionResult(method, [!options.unavailable]);
        if (method === "profileName")
          return namesAbi.encodeFunctionResult(method, [
            submitted || options.existing ? "alice.people.example.eth" : "",
          ]);
        if (method === "claimProfile" || method === "namePoll") {
          assert.equal(tx.from, account);
          if (options.switchBeforeSend) listener();
          if (options.simulationFails) throw Error("revert");
          return namesAbi.encodeFunctionResult(method, [namehash("alice.people.example.eth")]);
        }
        return namesAbi.encodeFunctionResult(method, [values[method]]);
      }
      if (tx.to === UNIVERSAL_RESOLVER) {
        const [, data] = universalAbi.decodeFunctionData("resolve", tx.data);
        if (data.startsWith(addressAbi.getFunction("addr").selector))
          return universalAbi.encodeFunctionResult("resolve", [
            addressAbi.encodeFunctionResult("addr", [options.wrongForward ? poll : account]),
            registrar,
          ]);
        return universalAbi.encodeFunctionResult("resolve", [
          textAbi.encodeFunctionResult("text", [JSON.stringify(record)]),
          registrar,
        ]);
      }
      if (tx.to === maci) return maciAbi.encodeFunctionResult("getPoll", [poll, polls, polls]);
      if (tx.to === poll) return pollAbi.encodeFunctionResult("getStartAndEndDate", [90, 120]);
      throw Error("Unexpected call");
    },
    waitForTransaction: async (h) => {
      assert.equal(h, hash);
      if (options.timeout) throw Error("timeout");
      if (options.switchAfterSend) listener();
      const event = options.isPoll
        ? namesAbi.encodeEventLog(namesAbi.getEvent("PollNamed"), [
            7,
            namehash("climate.polls.example.eth"),
            "climate",
            poll,
          ])
        : namesAbi.encodeEventLog(namesAbi.getEvent("ProfileClaimed"), [
            account,
            namehash("alice.people.example.eth"),
            "alice",
          ]);
      return { status: options.reverted ? 0 : 1, logs: options.noEvent ? [] : [{ address: registrar, ...event }] };
    },
  };
  const wallet = {
    peek: async () => session,
    subscribe: (fn) => {
      listener = fn;
      return () => {
        listener = undefined;
      };
    },
    send: async (call, context) => {
      assert.equal(context.account, account);
      assert.equal(call.value, 0n);
      sends++;
      if (options.reject) throw Error("user rejected");
      submitted = true;
      return hash;
    },
  };
  const run = (extra = {}) =>
    registerName({
      provider,
      wallet,
      registrar,
      allowedMaci: maci,
      label: options.isPoll ? "climate" : "alice",
      pollId: options.isPoll ? "7" : undefined,
      ...extra,
    });
  return { provider, config, wallet, run, sends: () => sends, subscribed: () => !!listener };
}
test("labels canonicalize only within the contract's ASCII subset", () => {
  assert.equal(normalizeLabel(" Alice "), "alice");
  for (const label of ["ab", "-alice", "alice-", "a.b", "émoji", "ab--cd", "xn--foo", "x".repeat(33)])
    assert.throws(() => normalizeLabel(label), /INVALID_LABEL/);
});
test("configuration verifies ENS hierarchy before registering", async () => {
  const f = setup();
  assert.deepEqual(await readNamingConfig(f.provider, registrar, maci), f.config);
  for (const options of [{ unlinked: true }, { chain: 1n }, { reorg: true }]) {
    const bad = setup(options);
    await assert.rejects(bad.run());
    assert.equal(bad.sends(), 0);
  }
});
test("profile success needs registrar event and forward resolution, not merely a successful receipt", async () => {
  const f = setup();
  assert.deepEqual(await f.run(), { name: "alice.people.example.eth", transactionHash: hash, account });
  assert.equal(f.subscribed(), false);
  for (const options of [{ noEvent: true }, { wrongForward: true }, { reverted: true }]) {
    const bad = setup(options);
    await assert.rejects(bad.run());
    assert.equal(bad.sends(), 1);
    assert.equal(bad.subscribed(), false);
  }
});
test("poll naming checks its emitted reference through the existing discovery resolver", async () => {
  const f = setup({ isPoll: true });
  assert.equal((await f.run()).name, "climate.polls.example.eth");
});
test("account switch away and back during preflight prevents broadcast", async () => {
  const f = setup({ switchBeforeSend: true });
  await assert.rejects(f.run(), /CONTEXT_CHANGED/);
  assert.equal(f.sends(), 0);
});
test("account switch after broadcast never returns success for a new context and retains hash", async () => {
  const f = setup({ switchAfterSend: true });
  await assert.rejects(f.run(), (e) => e.code === "CONTEXT_CHANGED" && e.transactionHash === hash);
  assert.equal(f.sends(), 1);
});
test("timeouts retain the original transaction and do not automatically resend", async () => {
  const f = setup({ timeout: true });
  await assert.rejects(f.run(), (e) => e.code === "RECHECK_TRANSACTION" && e.transactionHash === hash);
  assert.equal(f.sends(), 1);
});
test("collision, rejected signature and simulation errors do not report success", async () => {
  for (const options of [{ unavailable: true }, { reject: true }, { simulationFails: true }]) {
    const f = setup(options);
    await assert.rejects(f.run());
    assert.equal(f.sends(), options.reject ? 1 : 0);
    assert.equal(f.subscribed(), false);
  }
});
test("reconnect reads existing name without signing and rejects a forward mismatch", async () => {
  const f = setup({ existing: true });
  assert.equal(await recoverProfile(f.provider, f.config, account), "alice.people.example.eth");
  assert.equal(f.sends(), 0);
  const bad = setup({ existing: true, wrongForward: true });
  await assert.rejects(recoverProfile(bad.provider, bad.config, account), /PROFILE_MISMATCH/);
  const empty = setup();
  assert.equal(await recoverProfile(empty.provider, empty.config, account), null);
});
test("leaving the page cancels an operation before it requests a signature", async () => {
  const f = setup(),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(f.run({ signal: controller.signal }), /CONTEXT_CHANGED/);
  assert.equal(f.sends(), 0);
});
test("invalid poll IDs never reach the wallet", async () => {
  for (const pollId of ["01", "-1", "1.0", (1n << 256n).toString()]) {
    const f = setup({ isPoll: true });
    await assert.rejects(f.run({ pollId }), /INVALID_POLL_ID/);
    assert.equal(f.sends(), 0);
  }
});
