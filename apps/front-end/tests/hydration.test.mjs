import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../src/lib/hydration.ts", import.meta.url), "utf8");
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
const { runHydration, hydrationContextKey } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);

const ACCOUNT = "0x" + "a1".repeat(20);
const CHAIN = 11155111n;
const MACI = "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a";
const RECEIPT = { txHash: "0x" + "cd".repeat(32), submittedAt: 1757000000000 };
const BLOCKED = ["connecting", "signing-up", "joining", "voting"];

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function session(overrides = {}) {
  const writes = [];
  const state = {
    generation: 0,
    busy: false,
    status: "idle",
    hydratedFor: null,
    inFlightFor: null,
    operationId: 0,
    liveReceipt: null,
  };
  const peekGate = deferred();
  const lookupGate = deferred();
  const receiptGate = deferred();
  let peekResult = { kind: "found", account: ACCOUNT, chainId: CHAIN };
  let storedReceipt = RECEIPT;

  function io() {
    const snapshot = state.generation;
    return {
      canApply: () =>
        snapshot === state.generation && !state.busy && !BLOCKED.includes(state.status),
      getOperationId: () => state.operationId,
      liveReceipt: () => state.liveReceipt,
      contextKey: hydrationContextKey,
      isHydratedFor: (key) => state.hydratedFor === key,
      isInFlightFor: (key) => state.inFlightFor === key,
      beginFlight: (key) => {
        if (snapshot === state.generation) state.inFlightFor = key;
      },
      endFlight: (key) => {
        if (snapshot === state.generation && state.inFlightFor === key) state.inFlightFor = null;
      },
      markHydrated: (key) => {
        if (snapshot === state.generation) state.hydratedFor = key;
      },
      clearHydrated: () => {
        if (snapshot === state.generation) state.hydratedFor = null;
      },
      peekWallet: async () => {
        await peekGate.promise;
        return peekResult;
      },
      getConfig: () => ({ maciAddress: MACI, chainId: CHAIN, pollId: 0n }),
      readKey: () => ({ publicKey: "maci-public" }),
      lookupParticipation: async () => {
        await lookupGate.promise;
        return { registered: true, stateIndex: "5", isJoined: true, pollStateIndex: "17" };
      },
      loadReceipt: () => storedReceipt,
      checkReceipt: async () => {
        await receiptGate.promise;
        return { status: "confirmed", pollMatch: true, accountMatch: true };
      },
      apply: (write) => writes.push(write),
      ...overrides,
    };
  }

  return {
    writes,
    state,
    peekGate,
    lookupGate,
    receiptGate,
    io,
    bump() {
      state.generation += 1;
      state.operationId += 1;
      state.hydratedFor = null;
      state.inFlightFor = null;
    },
    setPeek(value) {
      peekResult = value;
    },
    setStoredReceipt(value) {
      storedReceipt = value;
    },
    contextKey: hydrationContextKey(CHAIN, ACCOUNT),
    waitFor(predicate) {
      return new Promise((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
          if (predicate()) return resolve();
          if (Date.now() - start > 1000) return reject(new Error("timed out waiting"));
          setImmediate(tick);
        };
        tick();
      });
    },
  };
}

test("stale generation during peek does not reset or write", async () => {
  const s = session();
  const run = runHydration(s.io());
  s.bump();
  s.peekGate.resolve();
  await run;
  assert.deepEqual(s.writes, []);
  assert.equal(s.state.hydratedFor, null);
});

test("a duplicate hydrate for an in-flight context does not clear then skip", async () => {
  const s = session();
  const first = runHydration(s.io());
  s.peekGate.resolve();
  await s.waitFor(() => s.writes.some((w) => w.type === "checking"));
  const secondWritesBefore = s.writes.length;
  const second = runHydration(s.io());
  await second;
  assert.equal(s.writes.length, secondWritesBefore);
  s.lookupGate.resolve();
  s.receiptGate.resolve();
  await first;
  assert.equal(s.writes[0].type, "checking");
  assert.equal(s.writes.at(-2).type, "ready");
  assert.equal(s.writes.at(-1).type, "receipt");
  assert.equal(s.state.hydratedFor, s.contextKey);
});

test("already-hydrated context is skipped before any write", async () => {
  const s = session();
  s.state.hydratedFor = s.contextKey;
  s.peekGate.resolve();
  await runHydration(s.io());
  assert.deepEqual(s.writes, []);
});

test("busy submission blocks hydration writes, including the opening checking write", async () => {
  const s = session();
  s.state.busy = true;
  s.peekGate.resolve();
  await runHydration(s.io());
  assert.deepEqual(s.writes, []);
  assert.equal(s.state.hydratedFor, null);
});

test("in-flight vote status blocks hydration writes", async () => {
  const s = session();
  s.state.status = "voting";
  s.peekGate.resolve();
  await runHydration(s.io());
  assert.deepEqual(s.writes, []);
});

test("marker is not set until the receipt check finishes", async () => {
  const s = session();
  const run = runHydration(s.io());
  s.peekGate.resolve();
  s.lookupGate.resolve();
  await s.waitFor(() => s.writes.some((w) => w.type === "ready"));
  assert.equal(s.state.hydratedFor, null);
  assert.equal(
    s.writes.some((w) => w.type === "receipt"),
    false,
  );
  s.receiptGate.resolve();
  await run;
  assert.equal(s.writes.at(-1).type, "receipt");
  assert.equal(s.state.hydratedFor, s.contextKey);
});

test("wrong-chain writes the account so the notice is not stuck behind Connect Wallet", async () => {
  const s = session();
  s.setPeek({ kind: "found", account: ACCOUNT, chainId: 1n });
  s.peekGate.resolve();
  await runHydration(s.io());
  assert.deepEqual(s.writes, [{ type: "wrong-chain", account: ACCOUNT }]);
  assert.equal(s.state.hydratedFor, null);
});

test("key-storage failures are an explicit write, not an uncaught throw", async () => {
  const s = session({
    readKey: () => {
      throw new Error("localStorage blocked");
    },
  });
  s.peekGate.resolve();
  await runHydration(s.io());
  assert.equal(s.writes.at(-1).type, "key-storage-error");
  assert.equal(s.state.hydratedFor, null);
});

test("lookup failure does not mark the context hydrated, so a later run can retry", async () => {
  const s = session({
    lookupParticipation: async () => {
      throw new Error("rpc down");
    },
  });
  s.peekGate.resolve();
  await runHydration(s.io());
  assert.equal(s.writes.at(-1).type, "lookup-failed");
  assert.equal(s.state.hydratedFor, null);
});

test("wallet-event generation bump during lookup discards the stale result", async () => {
  const s = session();
  const run = runHydration(s.io());
  s.peekGate.resolve();
  await s.waitFor(() => s.writes.some((w) => w.type === "checking"));
  s.bump();
  s.lookupGate.resolve();
  s.receiptGate.resolve();
  await run;
  assert.equal(
    s.writes.some((w) => w.type === "ready" || w.type === "receipt"),
    false,
  );
  assert.equal(s.state.hydratedFor, null);
});

test("hydrate started while busy writes nothing; a later run after release hydrates", async () => {
  const s = session();
  s.state.busy = true;
  const blocked = runHydration(s.io());
  s.peekGate.resolve();
  await blocked;
  assert.deepEqual(s.writes, []);
  s.state.busy = false;
  await runHydration({
    ...s.io(),
    peekWallet: async () => ({ kind: "found", account: ACCOUNT, chainId: CHAIN }),
    lookupParticipation: async () => ({ registered: true, isJoined: false }),
    loadReceipt: () => null,
    checkReceipt: async () => ({ status: "confirmed", pollMatch: true, accountMatch: true }),
  });
  assert.equal(s.writes[0].type, "checking");
  assert.equal(
    s.writes.some((w) => w.type === "ready"),
    true,
  );
});

test("a delayed hydration must not overwrite a newer submission receipt", async () => {
  const oldReceipt = { txHash: "0x" + "aa".repeat(32), submittedAt: 1 };
  const newReceipt = { txHash: "0x" + "bb".repeat(32), submittedAt: 2 };
  const s = session();
  s.setStoredReceipt(oldReceipt);
  const run = runHydration({
    ...s.io(),
    checkReceipt: async () => {
      await s.receiptGate.promise;
      return { status: "reverted", pollMatch: false, accountMatch: true };
    },
  });
  s.peekGate.resolve();
  s.lookupGate.resolve();
  await s.waitFor(() => s.writes.some((w) => w.type === "ready"));
  // Submission starts and completes while the old receipt RPC is in flight.
  s.state.operationId += 1;
  s.state.busy = false;
  s.state.status = "voted";
  s.state.liveReceipt = newReceipt;
  s.receiptGate.resolve();
  await run;
  assert.equal(
    s.writes.some((w) => w.type === "receipt"),
    false,
    "stale reverted receipt must not replace the new submission",
  );
});
