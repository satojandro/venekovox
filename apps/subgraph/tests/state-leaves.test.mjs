import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const graphRequire = createRequire(require.resolve("@graphprotocol/graph-cli/package.json"));
const { parse, print, buildASTSchema, validate } = graphRequire("graphql");
const v2 = readFileSync(new URL("../schemas/schema.v2.graphql", import.meta.url), "utf8");
const v1 = readFileSync(new URL("../schemas/schema.v1.graphql", import.meta.url), "utf8");
const query = readFileSync(new URL("../queries/state-leaves.graphql", import.meta.url), "utf8");

const api = `scalar BigInt
scalar Bytes
directive @entity(immutable:Boolean) on OBJECT
directive @derivedFrom(field:String!) on FIELD_DEFINITION
enum StateLeaf_orderBy { stateIndex }
enum OrderBy { stateIndex }
enum OrderDirection { asc desc }
input Block_height { number: Int }
input StateLeaf_filter { maci: Bytes stateIndex_gt: BigInt }
type Query {
  stateLeaves(first:Int, orderBy:StateLeaf_orderBy, orderDirection:OrderDirection, where:StateLeaf_filter, block:Block_height): [StateLeaf!]!
  poll(id:ID, block:Block_height): Poll
  _meta: _Meta
}
type _Meta { block: _Block! hasIndexingErrors: Boolean! }
type _Block { number: Int! hash: Bytes }
`;

test("v1 and v2 both define StateLeaf with the same fields", () => {
  const from = (source) => {
    const map = new Map(parse(source).definitions.map((d) => [d.name.value, print(d)]));
    return map.get("StateLeaf");
  };
  assert.equal(from(v1), from(v2));
  assert.match(from(v1), /stateIndex: BigInt!/);
  assert.match(from(v1), /publicKeyX: BigInt!/);
  assert.match(from(v1), /publicKeyY: BigInt!/);
});

test("state-leaves query validates against v2", () => {
  const errors = validate(buildASTSchema(parse(api + v2)), parse(query));
  assert.deepEqual(errors, []);
});

/** Pure pagination helper — same contract the backend tree service uses. */
export async function collectStateLeaves({ fetchPage, pageSize, startCursor = 0n }) {
  const pages = [];
  let cursor = startCursor;
  for (;;) {
    const page = await fetchPage(cursor, pageSize);
    pages.push(page);
    if (page.length < pageSize) break;
    cursor = BigInt(page[page.length - 1].stateIndex);
  }
  return pages;
}

export function assertContiguousSignupIndexes(leaves) {
  for (let i = 0; i < leaves.length; i += 1) {
    const expected = BigInt(i + 1);
    if (BigInt(leaves[i].stateIndex) !== expected) {
      throw new Error(`signup index gap at ${i}: expected ${expected}, got ${leaves[i].stateIndex}`);
    }
  }
}

test("Poll 1 fixture: two SignUp leaves fit in one page", async () => {
  const fixture = [
    { stateIndex: "1", publicKeyX: "11", publicKeyY: "12" },
    { stateIndex: "2", publicKeyX: "21", publicKeyY: "22" },
  ];
  const pages = await collectStateLeaves({
    pageSize: 1000,
    fetchPage: async (cursor, size) => fixture.filter((row) => BigInt(row.stateIndex) > cursor).slice(0, size),
  });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].length, 2);
  assertContiguousSignupIndexes(pages.flat());
});

test("pagination exceeds 2000 leaves uses more than two pages", async () => {
  const fixture = Array.from({ length: 2001 }, (_, i) => ({
    stateIndex: String(i + 1),
    publicKeyX: String(i + 1),
    publicKeyY: "1",
  }));
  const pages = await collectStateLeaves({
    pageSize: 1000,
    fetchPage: async (cursor, size) => fixture.filter((row) => BigInt(row.stateIndex) > cursor).slice(0, size),
  });
  assert.equal(pages.length, 3);
  assert.equal(pages.flat().length, 2001);
  assertContiguousSignupIndexes(pages.flat());
});

test("pagination gap is rejected", () => {
  assert.throws(() => assertContiguousSignupIndexes([{ stateIndex: "1" }, { stateIndex: "3" }]), /gap/);
});
