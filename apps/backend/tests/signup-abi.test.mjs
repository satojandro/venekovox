import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const maciSol = readFileSync(new URL("../../../packages/contracts/contracts/MACI.sol", import.meta.url), "utf8");
const template = readFileSync(
  new URL("../../../apps/subgraph/templates/subgraph.template.yaml", import.meta.url),
  "utf8",
);

test("subgraph SignUp handler matches the current MACI event ABI", () => {
  assert.match(
    maciSol,
    /event SignUp\(\s*uint256 _stateIndex,\s*uint256 _timestamp,\s*uint256 indexed _userPublicKeyX,\s*uint256 indexed _userPublicKeyY\s*\)/s,
  );
  assert.match(template, /event: SignUp\(uint256,uint256,indexed uint256,indexed uint256\)/);
  assert.match(template, /handler: handleSignUp/);
  assert.match(
    template,
    /file: \.\/node_modules\/@maci-protocol\/contracts\/build\/artifacts\/contracts\/MACI\.sol\/MACI\.json/,
  );
});
