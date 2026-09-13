import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareNamingPlan } from "../scripts/prepareEnsRegistration.mjs";
const input = {
  profileParent: "people.example.eth",
  pollParent: "polls.example.eth",
  profileRegistry: "0x" + "11".repeat(20),
  pollRegistry: "0x" + "22".repeat(20),
  operator: "0x" + "33".repeat(20),
  maci: "0x" + "44".repeat(20),
  registrationExpiry: "2000000000",
};
test("prepares constructor arguments and narrowly scoped unsigned role grants", () => {
  const result = prepareNamingPlan({ ...input, registrar: "0x" + "55".repeat(20) });
  assert.equal(result.constructorArguments[2], input.profileParent);
  assert.equal(result.constructorArguments[8], "2000000000");
  assert.equal(result.authorizations.length, 2);
  assert.equal(result.authorizations[0].to, input.profileRegistry);
  assert.equal(result.authorizations[0].value, "0");
});
test("configuration rejects ambiguous expiry, shared namespace and zero addresses", () => {
  for (const patch of [
    { registrationExpiry: 2000000000 },
    { registrationExpiry: "01" },
    { registrationExpiry: (1n << 64n).toString() },
    { profileRegistry: input.pollRegistry },
    { profileParent: input.pollParent },
    { profileParent: "PEOPLE.example.eth" },
    { operator: "0x" + "00".repeat(20) },
  ])
    assert.throws(() => prepareNamingPlan({ ...input, ...patch }));
});
