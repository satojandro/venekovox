import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { COMMON_QUERY, queryFor } from "../../client/governance.mjs";
const require = createRequire(import.meta.url);
const graphRequire = createRequire(require.resolve("@graphprotocol/graph-cli/package.json"));
const { parse, print, buildASTSchema, validate } = graphRequire("graphql");
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const v1 = read("../../schemas/schema.v1.graphql"),
  v2 = read("../../schemas/schema.v2.graphql");
const reference = read("../../reference/messari-openzeppelin-governor.graphql");
const api = `scalar BigInt\nscalar BigDecimal\nscalar Bytes\ndirective @entity(immutable:Boolean) on OBJECT\ndirective @derivedFrom(field:String!) on FIELD_DEFINITION
 enum Proposal_orderBy { creationTime } enum OrderDirection { asc desc }
 type Query { proposals(first:Int,orderBy:Proposal_orderBy,orderDirection:OrderDirection):[Proposal!]! _meta:_Meta }
 type _Meta { block:_Block! hasIndexingErrors:Boolean! } type _Block { number:Int! hash:Bytes }\n`;
test("native v1 entity definitions remain unchanged", () => {
  const definitions = new Map(parse(v2).definitions.map((d) => [d.name.value, print(d)]));
  for (const d of parse(v1).definitions) assert.equal(definitions.get(d.name.value), print(d));
});
test("identical common query validates against pinned Governor reference and MACI v2", () => {
  for (const source of [reference, v2])
    assert.deepEqual(validate(buildASTSchema(parse(api + source)), parse(COMMON_QUERY)), []);
});
test("source-specific queries validate without requiring private individual votes", () => {
  assert.deepEqual(validate(buildASTSchema(parse(api + v2)), parse(queryFor("maci"))), []);
  assert.deepEqual(validate(buildASTSchema(parse(api + reference)), parse(queryFor("governor"))), []);
});
