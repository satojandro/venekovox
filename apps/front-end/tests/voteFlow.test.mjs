import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

// Execute the real TypeScript flow without loading the SDK/React or needing a wallet.
// Node 20 uses the project's TypeScript dependency; recent Node also has a built-in stripper.
const source = await readFile(new URL("../src/hooks/voteFlow.ts", import.meta.url), "utf8");
let javascript;
try {
  const ts = await import("typescript");
  javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
  const { stripTypeScriptTypes } = await import("node:module");
  if (!stripTypeScriptTypes) throw new Error("Install workspace dependencies to run this test on Node 20.");
  javascript = stripTypeScriptTypes(source);
}
const { createVoteFlow } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

function fixture(overrides = {}) {
  const calls = [];
  const progress = [];
  const session = {
    account: "0xabc",
    signer: {},
    publicKey: "public",
    privateKey: "private",
    assertCurrent: async () => {},
  };
  const sdk = {
    getSignedupUserData: async () => ({ isRegistered: false }),
    signup: async () => ({ stateIndex: "5" }),
    getJoinedUserData: async () => ({ isJoined: false }),
    joinPoll: async () => ({ pollStateIndex: "17" }),
    publish: async () => ({ hash: "0xreceipt", privateKey: "ephemeral-secret" }),
    ...overrides,
  };
  const wrappedSdk = Object.fromEntries(
    Object.entries(sdk).map(([name, fn]) => [
      name,
      async (args) => {
        calls.push({ name, args });
        return fn(args);
      },
    ]),
  );
  const vote = createVoteFlow({
    sdk: wrappedSdk,
    getSession: async () => session,
    getConfig: () => ({ maciAddress: "0xmaci", pollId: 0n, startBlock: 11567000 }),
    onProgress: (state) => progress.push(state),
  });
  return { vote, calls, progress, session };
}

test("first click uses the returned poll index, without a React render between join and publish", async () => {
  const f = fixture();
  assert.deepEqual(await f.vote(2), { hash: "0xreceipt" });
  assert.deepEqual(
    f.calls.map((c) => c.name),
    ["getSignedupUserData", "signup", "getJoinedUserData", "joinPoll", "publish"],
  );
  const args = f.calls.at(-1).args;
  assert.equal(args.stateIndex, 17n); // poll index, NOT MACI signup index 5
  assert.equal(args.voteOptionIndex, 2n);
  assert.equal(args.pollId, 0n);
  assert.equal(f.progress.at(-1).status, "voted");
});

test("empty gate arguments are valid even-length hex bytes", async () => {
  const f = fixture();
  await f.vote(0);
  assert.equal(f.calls.find((c) => c.name === "signup").args.sgData, "0x");
  const join = f.calls.find((c) => c.name === "joinPoll").args;
  assert.equal(join.sgDataArg, "0x");
  assert.equal(join.ivcpDataArg, "0x");
  assert.equal(join.startBlock, 11567000);
});

test("returning user recovers membership on chain without signup or join transactions", async () => {
  const f = fixture({
    getSignedupUserData: async () => ({ isRegistered: true, stateIndex: "5" }),
    getJoinedUserData: async () => ({ isJoined: true, pollStateIndex: "28" }),
  });
  await f.vote(1);
  assert.deepEqual(
    f.calls.map((c) => c.name),
    ["getSignedupUserData", "getJoinedUserData", "publish"],
  );
  assert.equal(f.calls.at(-1).args.stateIndex, 28n);
});

test("same-tick duplicate clicks do not start a second flow", async () => {
  let release;
  const f = fixture({
    signup: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  const first = f.vote(0);
  await assert.rejects(f.vote(1), /already in progress/);
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  release({ stateIndex: "5" });
  await first;
  assert.equal(f.calls.filter((c) => c.name === "publish").length, 1);
});

test("rejected signup releases the lock so a later attempt can succeed", async () => {
  let reject = true;
  const f = fixture({
    signup: async () => {
      if (reject) throw new Error("User rejected transaction");
      return { stateIndex: "5" };
    },
  });
  await assert.rejects(f.vote(0), /User rejected/);
  assert.equal(f.progress.at(-1).status, "idle");
  assert.equal(
    f.calls.some((c) => c.name === "publish"),
    false,
  );
  reject = false;
  await f.vote(0);
  assert.equal(f.progress.at(-1).status, "voted");
});

test("retry after a rejected publish reuses membership rather than rejoining", async () => {
  let joined = false;
  let attempts = 0;
  const f = fixture({
    getSignedupUserData: async () => ({ isRegistered: true, stateIndex: "5" }),
    getJoinedUserData: async () => ({ isJoined: joined, pollStateIndex: joined ? "17" : undefined }),
    joinPoll: async () => {
      joined = true;
      return { pollStateIndex: "17" };
    },
    publish: async () => {
      if (++attempts === 1) throw new Error("Rejected");
      return { hash: "0xreceipt" };
    },
  });
  await assert.rejects(f.vote(0), /Rejected/);
  await f.vote(0);
  assert.equal(f.calls.filter((c) => c.name === "joinPoll").length, 1);
});

test("wallet or network mismatch aborts before any SDK call", async () => {
  const f = fixture();
  f.session.assertCurrent = async () => {
    throw new Error("Wrong network");
  };
  await assert.rejects(f.vote(0), /Wrong network/);
  assert.equal(f.calls.length, 0);
});

test("wallet change while joining prevents the subsequent publish", async () => {
  let changed = false;
  const f = fixture({
    joinPoll: async () => {
      changed = true;
      return { pollStateIndex: "17" };
    },
  });
  f.session.assertCurrent = async () => {
    if (changed) throw new Error("Wallet changed");
  };
  await assert.rejects(f.vote(0), /Wallet changed/);
  assert.equal(
    f.calls.some((c) => c.name === "publish"),
    false,
  );
});

test("failed membership lookup does not blindly submit another join transaction", async () => {
  const f = fixture({
    getJoinedUserData: async () => {
      throw new Error("RPC unavailable");
    },
  });
  await assert.rejects(f.vote(0), /RPC unavailable/);
  assert.equal(
    f.calls.some((c) => c.name === "joinPoll"),
    false,
  );
});

test("invalid or missing poll state index never reaches publish", async () => {
  for (const pollStateIndex of [undefined, "0", "-1"]) {
    const f = fixture({ joinPoll: async () => ({ pollStateIndex }) });
    await assert.rejects(f.vote(0), /confirm poll membership/);
    assert.equal(
      f.calls.some((c) => c.name === "publish"),
      false,
    );
  }
});

test("invalid options and weights cannot start signup", async () => {
  for (const [option, weight] of [
    [-1, 1n],
    [1.5, 1n],
    [NaN, 1n],
    [0, 0n],
  ]) {
    const f = fixture();
    await assert.rejects(f.vote(option, weight), /Invalid vote/);
    assert.equal(f.calls.length, 0);
  }
});
