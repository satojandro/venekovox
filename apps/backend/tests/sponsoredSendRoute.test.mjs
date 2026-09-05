import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { importTs } from "./loadTs.mjs";

const PROBE = "0x" + "29".repeat(20);
const TOKEN = "lab-operator-secret";

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function fakeReq({ body = {}, headers = {} } = {}) {
  return {
    body,
    get(name) {
      const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
      return key ? headers[key] : undefined;
    },
  };
}

async function loadRoute() {
  return importTs("../src/routes/sponsoredStatus.ts", import.meta.url);
}

function findHandler(router, method, path) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  assert.ok(layer, `missing ${method.toUpperCase()} ${path}`);
  return layer.route.stack[0].handle;
}

test("malformed chainId on sponsored-send returns 400 INVALID_CHAIN", async () => {
  const previous = { ...process.env };
  process.env.W1_LAB_ALLOW_SPONSORED_SEND = "true";
  process.env.W1_LAB_OPERATOR_TOKEN = TOKEN;
  process.env.W1_LAB_PROBE_ADDRESS = PROBE;
  process.env.W1_LAB_CHAIN_ID = "11155111";
  process.env.PRIVY_APP_ID = "app-id";
  process.env.PRIVY_APP_SECRET = "app-secret";
  process.env.W1_LAB_WALLET_ID = "wallet-id";

  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("Privy must not be called for invalid chainId");
  });

  try {
    const mod = await loadRoute();
    const handler = findHandler(mod.default, "post", "/lab/sponsored-send");
    const res = fakeRes();
    await handler(
      fakeReq({
        body: {
          to: PROBE,
          data: "0xb74af5a9",
          value: "0x0",
          chainId: "not-a-chain",
        },
        headers: { "x-w1-lab-operator-token": TOKEN },
      }),
      res,
    );
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error_code, "INVALID_CHAIN");
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally {
    fetchMock.mock.restore();
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
  }
});

test("unauthenticated chain-1 send never reaches Privy", async () => {
  const previous = { ...process.env };
  process.env.W1_LAB_ALLOW_SPONSORED_SEND = "true";
  process.env.W1_LAB_OPERATOR_TOKEN = TOKEN;
  process.env.W1_LAB_PROBE_ADDRESS = PROBE;
  process.env.W1_LAB_CHAIN_ID = "11155111";
  process.env.PRIVY_APP_ID = "app-id";
  process.env.PRIVY_APP_SECRET = "app-secret";
  process.env.W1_LAB_WALLET_ID = "wallet-id";

  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("Privy must not be called without auth");
  });

  try {
    const mod = await loadRoute();
    const handler = findHandler(mod.default, "post", "/lab/sponsored-send");
    const res = fakeRes();
    await handler(
      fakeReq({
        body: {
          to: "0x" + "ab".repeat(20),
          data: "0xa9059cbb",
          value: "0xde0b6b3a7640000",
          chainId: "1",
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error_code, "LAB_UNAUTHORIZED");
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally {
    fetchMock.mock.restore();
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
  }
});

test("authenticated allowlisted probe reaches Privy with zero value", async () => {
  const previous = { ...process.env };
  process.env.W1_LAB_ALLOW_SPONSORED_SEND = "true";
  process.env.W1_LAB_OPERATOR_TOKEN = TOKEN;
  process.env.W1_LAB_PROBE_ADDRESS = PROBE;
  process.env.W1_LAB_CHAIN_ID = "11155111";
  process.env.PRIVY_APP_ID = "app-id";
  process.env.PRIVY_APP_SECRET = "app-secret";
  process.env.W1_LAB_WALLET_ID = "wallet-id";

  let captured;
  const fetchMock = mock.method(globalThis, "fetch", async (_url, init) => {
    captured = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return { data: { transaction_id: "tx-lab-ok", user_operation_hash: "0x" + "11".repeat(32) } };
      },
    };
  });

  try {
    const mod = await loadRoute();
    const handler = findHandler(mod.default, "post", "/lab/sponsored-send");
    const res = fakeRes();
    await handler(
      fakeReq({
        body: {
          to: PROBE,
          data: "0xb74af5a9",
          value: "0x0",
          chainId: "11155111",
        },
        headers: { "x-w1-lab-operator-token": TOKEN },
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.vendor.transactionId, "tx-lab-ok");
    assert.equal(captured.sponsor, true);
    assert.equal(captured.caip2, "eip155:11155111");
    assert.equal(captured.params.transaction.value, "0x0");
    assert.equal(captured.params.transaction.to, PROBE.toLowerCase());
  } finally {
    fetchMock.mock.restore();
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
  }
});
