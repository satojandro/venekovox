import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../../src/ens/accountDisplay.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { shortAddress, accountLabel } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const account = "0x1111111111111111111111111111111111111111";
test("ballot shows the verified name when present and the truncated address otherwise", () => {
  assert.equal(accountLabel(account, "alice.people.venekovoxv1.eth"), "alice.people.venekovoxv1.eth");
  assert.equal(accountLabel(account, null), "0x1111…1111");
  assert.equal(shortAddress(account), "0x1111…1111");
});
