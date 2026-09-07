import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMON_FIELDS, COMMON_QUERY, queryFor, normalize, readGovernance } from "../../client/governance.mjs";
const proposal = {
  id: "poll",
  txnHash: "tx",
  description: null,
  creationBlock: "10",
  creationTime: "100",
  governanceFramework: { id: "maci", name: "MACI", type: "MACI", contractAddress: "address" },
  ballotPrivacy: "ENCRYPTED",
  coordinatorTrust: "COORDINATOR_CAN_DECRYPT",
  tallyStatus: "UNAVAILABLE",
  registrationCount: "3",
  publishedMessageCount: "7",
  offchainBatchCount: "2",
  startTime: "90",
  endTime: "110",
  voteOptionCapacity: "5",
  votingMode: "0",
};
const data = (p) => ({ _meta: { block: { number: 11, hash: "hash" }, hasIndexingErrors: false }, proposals: [p] });
test("both source queries reuse the common proposal fields", () => {
  assert.ok(COMMON_QUERY.includes(COMMON_FIELDS));
  for (const kind of ["maci", "governor"]) assert.ok(queryFor(kind).includes(COMMON_FIELDS));
});
test("MACI cannot fabricate zero results or equate messages with voters", () => {
  const p = normalize(data(proposal), "maci", "fixture").proposals[0];
  assert.equal(p.results, null);
  assert.equal(p.publishedMessageCount, "7");
  assert.equal(p.registrationCount, "3");
  assert.match(p.participationMeaning, /neither/);
  assert.equal(p.description, null);
});
test("large voting weights remain exact strings; public totals are not finality proof", () => {
  const p = normalize(
    data({
      ...proposal,
      state: "ACTIVE",
      forWeightedVotes: "900719925474099312345",
      againstWeightedVotes: "0",
      abstainWeightedVotes: "0",
      totalWeightedVotes: "900719925474099312345",
    }),
    "governor",
    "fixture",
  ).proposals[0];
  assert.equal(p.results.for, "900719925474099312345");
  assert.match(p.resultStatus, /NOT_INDEPENDENTLY_FINALIZED/);
});
test("missing metadata and indexing errors fail closed", () => {
  assert.throws(() => normalize({ proposals: [] }, "maci", "fixture"));
  const d = data(proposal);
  d._meta.hasIndexingErrors = true;
  assert.throws(() => normalize(d, "maci", "fixture"));
});
test("new tally status needs explicit adapter support", () => {
  assert.throws(() => normalize(data({ ...proposal, tallyStatus: "VERIFIED" }), "maci", "fixture"), /upgrade/);
});
test("GraphQL errors are not silently converted into empty results", async () => {
  await assert.rejects(
    readGovernance({
      endpoint: "https://example.test",
      kind: "maci",
      label: "fixture",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ errors: [{ message: "secret" }], data: data(proposal) }),
      }),
    }),
    /GraphQL errors/,
  );
});
test("request errors do not reveal API-key-bearing endpoints", async () => {
  await assert.rejects(
    readGovernance({
      endpoint: "https://example.test/secret-key",
      kind: "maci",
      label: "fixture",
      fetchImpl: async () => {
        throw new Error("https://example.test/secret-key");
      },
    }),
    (e) => !e.message.includes("secret-key"),
  );
});
test("live read uses POST and bounded query variables with no mock fallback", async () => {
  const r = await readGovernance({
    endpoint: "https://example.test",
    kind: "maci",
    label: "fixture",
    fetchImpl: async (url, request) => {
      assert.equal(request.method, "POST");
      assert.equal(JSON.parse(request.body).variables.first, 5);
      return { ok: true, json: async () => ({ data: data(proposal) }) };
    },
  });
  assert.equal(r.indexedBlock, 11);
});
