import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ethers = require("ethers");
const source = ts.transpileModule(readFileSync(new URL("../src/routes/polls.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const maci = "0x1111111111111111111111111111111111111111";
const poll = "0x2222222222222222222222222222222222222222";
const maciAbi = new ethers.Interface(["function getPoll(uint256) view returns(address,address,address)"]);
const pollAbi = new ethers.Interface(["function getStartAndEndDate() view returns(uint256,uint256)"]);

async function request(network) {
  let reads = 0;
  let destroyed = false;
  class Provider {
    async getNetwork() { return { chainId: network }; }
    async getBlock() { reads++; return { number: 99, hash: "0xabc", timestamp: 100 }; }
    async getCode() { return "0x6000"; }
    async call({ data }) {
      return data.startsWith(maciAbi.getFunction("getPoll").selector)
        ? maciAbi.encodeFunctionResult("getPoll", [poll, maci, maci])
        : pollAbi.encodeFunctionResult("getStartAndEndDate", [90n, 120n]);
    }
    destroy() { destroyed = true; }
  }
  const module = { exports: {} };
  runInNewContext(source, {
    module, exports: module.exports, console,
    process: { env: { CHAIN_ID: "11155111", MACI_ADDRESS: maci, POLL_ID: "0" } },
    require: name => name === "ethers" ? { ...ethers, JsonRpcProvider: Provider } : require(name),
  });
  const router = module.exports.default;
  const handler = router.stack.find(layer => layer.route?.path === "/configured").route.stack[0].handle;
  const response = {
    code: 200,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({}, response);
  return { response, reads, destroyed };
}

test("wrong RPC network fails before poll reads and releases the provider", async () => {
  const { response, reads, destroyed } = await request(1n);
  assert.equal(response.code, 502);
  assert.equal(response.body.error, "POLL_MISMATCH");
  assert.equal(reads, 0);
  assert.equal(destroyed, true);
});

test("matching RPC network returns its chain and open window", async () => {
  const { response, reads, destroyed } = await request(11155111n);
  assert.equal(response.code, 200);
  assert.equal(response.body.chainId, "11155111");
  assert.equal(response.body.pollAddress, poll);
  assert.equal(response.body.status, "OPEN");
  assert.equal(reads, 1);
  assert.equal(destroyed, true);
});
