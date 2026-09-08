import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const ethersUrl = pathToFileURL(require.resolve("ethers")).href;

function transpile(file) {
  return ts
    .transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    })
    .outputText.replaceAll('from "ethers"', `from "${ethersUrl}"`);
}

const pollNameJs = transpile(new URL("../../src/ens/pollName.ts", import.meta.url));
const pollNameUrl = "data:text/javascript;base64," + Buffer.from(pollNameJs).toString("base64");
const scheduleJs = transpile(new URL("../../src/polls/schedule.ts", import.meta.url)).replaceAll(
  'from "../ens/pollName"',
  `from "${pollNameUrl}"`,
);
const { readPollSchedule, ScheduleError } = await import(
  "data:text/javascript;base64," + Buffer.from(scheduleJs).toString("base64")
);
const { maciAbi, pollAbi } = await import(pollNameUrl);

const maci = "0x1111111111111111111111111111111111111111";
const poll = "0x2222222222222222222222222222222222222222";

function makeProvider({ start = 0n, end = 0n, code = "0x6000", registered = poll } = {}) {
  return {
    getNetwork: async () => ({ chainId: 11155111n }),
    getBlock: async () => ({ number: 99, hash: "0xabc", timestamp: 100 }),
    getCode: async () => code,
    call: async ({ data }) => {
      if (data.startsWith(maciAbi.getFunction("getPoll").selector)) {
        return maciAbi.encodeFunctionResult("getPoll", [registered, maci, maci]);
      }
      if (data.startsWith(pollAbi.getFunction("getStartAndEndDate").selector)) {
        return pollAbi.encodeFunctionResult("getStartAndEndDate", [start, end]);
      }
      throw new Error("unexpected call");
    },
  };
}

test("zero dates are an invalid voting window, not an open poll", async () => {
  const schedule = await readPollSchedule(makeProvider({ start: 0n, end: 0n }), maci, "0", "11155111");
  assert.equal(schedule.status, "INVALID_WINDOW");
  assert.equal(schedule.startTime, "0");
  assert.equal(schedule.endTime, "0");
  assert.equal(schedule.pollAddress, poll);
  assert.equal(schedule.chainId, "11155111");
  assert.equal(schedule.pollId, "0");
  assert.equal(schedule.maciAddress, maci);
});

test("a live window is open at the snapshot timestamp", async () => {
  const schedule = await readPollSchedule(makeProvider({ start: 90n, end: 120n }), maci, "0", "11155111");
  assert.equal(schedule.status, "OPEN");
});

test("missing poll code is a mismatch, not an empty list", async () => {
  await assert.rejects(
    () => readPollSchedule(makeProvider({ code: "0x" }), maci, "0", "11155111"),
    (error) => error instanceof ScheduleError && error.code === "POLL_MISMATCH",
  );
});

test("rejects the wrong RPC network before reading poll state", async () => {
  let reads = 0;
  const provider = {
    ...makeProvider({ start: 90n, end: 120n }),
    getNetwork: async () => ({ chainId: 1n }),
    getBlock: async () => { reads++; throw new Error("must not read wrong chain"); },
  };
  await assert.rejects(
    () => readPollSchedule(provider, maci, "0", "11155111"),
    error => error instanceof ScheduleError && error.code === "POLL_MISMATCH",
  );
  assert.equal(reads, 0);
});
