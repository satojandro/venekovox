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
const { createFlightAnchor, hydrationContextKey, invalidateFlight, runHydration } = await import(
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
    flightAnchor: createFlightAnchor(),
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
      canApply: () => snapshot === state.generation && !state.busy && !BLOCKED.includes(state.status),
      getOperationId: () => state.operationId,
      liveReceipt: () => state.liveReceipt,
      contextKey: hydrationContextKey,
      isHydratedFor: (key) => state.hydratedFor === key,
      flightAnchor: () => state.flightAnchor,
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
      invalidateFlight(state.flightAnchor);
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
  invalidateFlight(s.state.flightAnchor); // vote() invalidates the stale run's lock
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

test("delayed hydration -> submission -> stale cleanup -> successful fresh hydration", async () => {
  const s = session();
  s.peekGate.resolve();
  // Run A: hydration starts; its participation lookup is delayed.
  const staleRun = runHydration(s.io());
  await s.waitFor(() => s.state.flightAnchor.key === s.contextKey);
  assert.equal(s.state.flightAnchor.owner, 0, "Run A owns its lock");

  // A vote starts while the lookup is still in flight: the operation id bumps
  // and vote() invalidates the lock held by the older run.
  s.state.operationId += 1;
  invalidateFlight(s.state.flightAnchor);
  assert.equal(s.state.flightAnchor.key, null, "new operation invalidates the old lock");

  // Vote completes: a fresh hydration starts and must NOT be skipped as
  // "already in flight"; it acquires the lock under the new operation id.
  s.state.status = "voted";
  const freshRun = runHydration(s.io());
  await s.waitFor(() => s.state.flightAnchor.owner === 1);
  assert.equal(s.state.flightAnchor.key, s.contextKey, "fresh run holds the lock");

  // Run A's stale lookup finally resolves. Its cleanup must not clear the
  // newer run's lock, and it must not apply any stale results: the only new
  // write is Run B's "ready" (its receipt check is still gated).
  const writesBeforeStale = s.writes.length;
  s.lookupGate.resolve();
  await staleRun;
  assert.equal(s.state.flightAnchor.owner, 1, "stale cleanup must never clear a newer run's lock");
  assert.equal(s.state.flightAnchor.key, s.contextKey);
  assert.equal(s.writes.length, writesBeforeStale + 1, "stale run applied nothing after the vote");
  assert.equal(s.writes.at(-1).type, "ready", "fresh run's lookup applied");

  // Run B completes normally: applies its results, marks hydrated, and
  // releases the lock it owns.
  s.receiptGate.resolve();
  await freshRun;
  assert.equal(s.state.flightAnchor.key, null, "fresh run releases its own lock");
  assert.equal(s.state.hydratedFor, s.contextKey, "fresh run marks the context hydrated");

  // A later hydration — the vote flow's finally clears hydratedFor before
  // hydrating — sees no lock and completes again: participation recovery is
  // not blocked until a wallet-event reset or remount.
  s.state.hydratedFor = null;
  const recovery = runHydration({
    ...s.io(),
    loadReceipt: () => null,
    checkReceipt: async () => ({ status: "confirmed", pollMatch: true, accountMatch: true }),
  });
  await recovery;
  assert.equal(s.writes.filter((w) => w.type === "ready").length, 2, "post-recovery hydration runs a fresh lookup");
});
