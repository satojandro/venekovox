import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  ts = require("typescript");
// Production mapping executed with Graph host doubles, separately WASM-compiled by graph build.
function setup() {
  const stores = {};
  function entity(name) {
    stores[name] = new Map();
    return class {
      constructor(id) {
        this.id = id;
      }
      static load(id) {
        const v = stores[name].get(id);
        return v ? Object.assign(new this(id), v) : null;
      }
      save() {
        stores[name].set(this.id, { ...this });
      }
    };
  }
  class BN {
    constructor(v) {
      this.value = globalThis.BigInt(v);
    }
    static zero() {
      return new BN(0);
    }
    static fromI32(v) {
      return new BN(v);
    }
    plus(v) {
      return new BN(this.value + v.value);
    }
    lt(v) {
      return this.value < v.value;
    }
    toString() {
      return this.value.toString();
    }
  }
  const models = { GovernanceFramework: entity("framework"), Proposal: entity("proposal") };
  const source = readFileSync(new URL("../../src/governance.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  new Function("require", "exports", js)(
    (name) => (name.includes("graph-ts") ? { BigInt: BN, dataSource: { network: () => "sepolia" } } : models),
    exports,
  );
  const bytes = (value) => ({ toHexString: () => value });
  const event = (address = "poll", tx = "deployment", log = 10) => ({
    address: bytes(address),
    transaction: { hash: bytes(tx) },
    logIndex: new BN(log),
    block: { timestamp: new BN(100), number: new BN(5) },
  });
  const poll = (id = "poll") => ({
    id: bytes(id),
    maci: bytes("maci"),
    startDate: new BN(90),
    endDate: new BN(120),
    voteOptions: new BN(5),
    mode: new BN(0),
    tally: bytes("tally"),
    registrationCount: new BN(0),
  });
  return { ...exports, stores, BN, event, poll, load: (id) => models.Proposal.load(id) };
}
test("deployment projection has no fabricated results or timestamp-to-block conversion", () => {
  const f = setup();
  f.createProposal(f.poll(), f.event());
  const p = f.load("poll");
  assert.equal(p.ballotPrivacy, "ENCRYPTED");
  assert.equal(p.coordinatorTrust, "COORDINATOR_CAN_DECRYPT");
  assert.equal(p.tallyStatus, "UNAVAILABLE");
  for (const key of ["description", "startBlock", "endBlock", "countedBallots", "forWeightedVotes", "resultCommitment"])
    assert.equal(p[key], undefined);
  assert.equal(p.startTime.toString(), "90");
  assert.equal(f.stores.framework.size, 1);
});
test("constructor placeholder excluded; later same-transaction publication included", () => {
  const f = setup();
  f.createProposal(f.poll(), f.event());
  f.recordPublication(f.event("poll", "deployment", 2));
  assert.equal(f.load("poll").publishedMessageCount.toString(), "0");
  f.recordPublication(f.event("poll", "deployment", 11));
  f.recordPublication(f.event("poll", "vote", 1));
  assert.equal(f.load("poll").publishedMessageCount.toString(), "2");
});
test("unknown poll events do not create ghost proposals", () => {
  const f = setup();
  f.recordPublication(f.event());
  f.recordOffchainBatch(f.event());
  f.recordRegistration(f.poll(), f.event());
  assert.equal(f.stores.proposal.size, 0);
});
test("registration sync is neither a tally nor a duplicate increment", () => {
  const f = setup(),
    poll = f.poll();
  f.createProposal(poll, f.event());
  poll.registrationCount = new f.BN(2);
  f.recordRegistration(poll, f.event());
  f.recordRegistration(poll, f.event());
  assert.equal(f.load("poll").registrationCount.toString(), "2");
  assert.equal(f.load("poll").countedBallots, undefined);
});
test("batch announcements are separate from publications and results", () => {
  const f = setup();
  f.createProposal(f.poll(), f.event());
  f.recordOffchainBatch(f.event());
  assert.equal(f.load("poll").offchainBatchCount.toString(), "1");
  assert.equal(f.load("poll").publishedMessageCount.toString(), "0");
  assert.equal(f.load("poll").tallyStatus, "UNAVAILABLE");
});
test("two polls share a framework but not publication counts", () => {
  const f = setup();
  f.createProposal(f.poll("a"), f.event("a"));
  f.createProposal(f.poll("b"), f.event("b"));
  f.recordPublication(f.event("a", "vote", 1));
  assert.equal(f.load("a").publishedMessageCount.toString(), "1");
  assert.equal(f.load("b").publishedMessageCount.toString(), "0");
  assert.equal(f.stores.framework.size, 1);
});
