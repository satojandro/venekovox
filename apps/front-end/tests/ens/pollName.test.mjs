import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url),
  ts = require("typescript");
const source = readFileSync(new URL("../../src/ens/pollName.ts", import.meta.url), "utf8");
let js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
js = js.replaceAll('from "ethers"', `from "${pathToFileURL(require.resolve("ethers"))}"`);
const {
  resolvePollName,
  parsePollRecord,
  normalizePollName,
  votingWindow,
  universalAbi,
  textAbi,
  maciAbi,
  pollAbi,
  UNIVERSAL_RESOLVER,
  POLL_RECORD_KEY,
} = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const maci = "0x1111111111111111111111111111111111111111",
  poll = "0x2222222222222222222222222222222222222222",
  resolver = "0x3333333333333333333333333333333333333333";
const record = { version: 1, chainId: "11155111", maci, pollId: "0", poll };
function setup({
  raw = JSON.stringify(record),
  chainId = 11155111n,
  registered = poll,
  code = "0x6000",
  start = 90n,
  end = 120n,
  reorg = false,
} = {}) {
  const calls = [];
  const provider = {
    getNetwork: async () => ({ chainId }),
    getBlock: async (tag) => ({
      number: 10,
      hash: reorg && tag !== "latest" ? "changed" : "blockhash",
      timestamp: 100,
    }),
    getCode: async (a, b) => {
      assert.equal(b, 10);
      return code;
    },
    call: async (tx) => {
      calls.push(tx);
      assert.equal(tx.blockTag, 10);
      if (tx.to === UNIVERSAL_RESOLVER) {
        const [dns, data] = universalAbi.decodeFunctionData("resolve", tx.data);
        assert.ok(dns.startsWith("0x"));
        assert.equal(textAbi.decodeFunctionData("text", data)[1], POLL_RECORD_KEY);
        assert.equal(tx.enableCcipRead, true);
        return universalAbi.encodeFunctionResult("resolve", [textAbi.encodeFunctionResult("text", [raw]), resolver]);
      }
      if (tx.to === maci) {
        assert.equal(maciAbi.decodeFunctionData("getPoll", tx.data)[0], 0n);
        return maciAbi.encodeFunctionResult("getPoll", [registered, resolver, resolver]);
      }
      return pollAbi.encodeFunctionResult("getStartAndEndDate", [start, end]);
    },
  };
  return { provider, calls };
}
test("uses real ethers ENS normalization and canonical record parsing", () => {
  assert.equal(normalizePollName(" Climate.ETH "), "climate.eth");
  assert.deepEqual(parsePollRecord(JSON.stringify(record)), record);
});
test("invalid name, root and unsupported namespace reject", () => {
  for (const name of ["", "eth", "bad..eth", "https://a.eth", "a.com"])
    assert.throws(() => normalizePollName(name), /INVALID_NAME/);
});
test("strict record shape rejects ambiguous numbers, extra fields, zero address and overflow", () => {
  for (const patch of [
    { version: 2 },
    { pollId: 0 },
    { pollId: "01" },
    { pollId: "-1" },
    { chainId: 11155111 },
    { pollId: (1n << 256n).toString() },
    { poll: "0x" + "0".repeat(40) },
    { url: "https://evil.test" },
  ])
    assert.throws(() => parsePollRecord(JSON.stringify({ ...record, ...patch })), /INVALID_RECORD/);
  assert.throws(() => parsePollRecord(""), /MISSING_RECORD/);
  assert.throws(() => parsePollRecord("{"), /INVALID_RECORD/);
});
test("resolves via Universal Resolver and validates target at one block", async () => {
  const f = setup(),
    result = await resolvePollName("climate.eth", f.provider, [maci]);
  assert.equal(result.reference.poll, poll);
  assert.equal(result.status, "OPEN");
  assert.equal(result.blockNumber, 10);
  assert.equal(f.calls.length, 3);
});
test("wrong RPC network is rejected before any resolver call", async () => {
  const f = setup({ chainId: 1n });
  await assert.rejects(resolvePollName("a.eth", f.provider, [maci]), /UNSUPPORTED_CHAIN/);
  assert.equal(f.calls.length, 0);
});
test("unsupported record chain and untrusted deployment cannot redirect users", async () => {
  for (const [patch, error] of [
    [{ chainId: "1" }, "UNSUPPORTED_CHAIN"],
    [{ maci: resolver }, "UNTRUSTED_MACI"],
  ]) {
    const f = setup({ raw: JSON.stringify({ ...record, ...patch }) });
    await assert.rejects(resolvePollName("a.eth", f.provider, [maci]), new RegExp(error));
    assert.equal(f.calls.length, 1);
  }
});
test("missing record remains distinct from RPC failure", async () => {
  const f = setup({ raw: "" });
  await assert.rejects(resolvePollName("a.eth", f.provider, [maci]), /MISSING_RECORD/);
  f.provider.call = async () => {
    throw new Error("RPC secret URL");
  };
  await assert.rejects(resolvePollName("a.eth", f.provider, [maci]), (e) => e.message === "LOOKUP_FAILED");
});
test("wrong poll, absent code and snapshot reorg fail closed", async () => {
  for (const options of [{ registered: resolver }, { code: "0x" }, { reorg: true }]) {
    const f = setup(options);
    await assert.rejects(resolvePollName("a.eth", f.provider, [maci]));
  }
});
test("window boundary follows Poll.sol and historical zero dates are invalid", () => {
  assert.equal(votingWindow(90n, 120n, 89n), "UPCOMING");
  assert.equal(votingWindow(90n, 120n, 90n), "OPEN");
  assert.equal(votingWindow(90n, 120n, 120n), "OPEN");
  assert.equal(votingWindow(90n, 120n, 121n), "CLOSED");
  assert.equal(votingWindow(0n, 0n, 100n), "INVALID_WINDOW");
});
test("empty trusted deployment list blocks all resolution", async () => {
  const f = setup();
  await assert.rejects(resolvePollName("a.eth", f.provider, []), /NOT_CONFIGURED/);
  assert.equal(f.calls.length, 0);
});
