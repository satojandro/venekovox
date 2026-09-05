import assert from "node:assert/strict";
import { test } from "node:test";
import { importTs } from "./loadTs.mjs";

const { CALLER_PROBE_SELECTORS, validateLabSponsoredSend } = await importTs(
  "../src/routes/labSendPolicy.ts",
  import.meta.url,
);

const PROBE = "0x" + "29".repeat(20);
const TOKEN = "lab-operator-secret";

function env(overrides = {}) {
  return {
    allowSponsoredSend: "true",
    operatorToken: TOKEN,
    probeAddress: PROBE,
    chainId: "11155111",
    privyAppId: "app-id",
    privyAppSecret: "app-secret",
    labWalletId: "wallet-id",
    ...overrides,
  };
}

function auth(token = TOKEN) {
  return { operatorTokenHeader: token };
}

function body(overrides = {}) {
  return {
    to: PROBE,
    data: CALLER_PROBE_SELECTORS.probe,
    value: "0x0",
    chainId: "11155111",
    ...overrides,
  };
}

test("happy path accepts allowlisted probe() with operator token", () => {
  const result = validateLabSponsoredSend(env(), auth(), body());
  assert.equal(result.ok, true);
  assert.equal(result.to, PROBE.toLowerCase());
  assert.equal(result.value, "0x0");
  assert.equal(result.chainId, 11155111n);
});

test("toggle alone is not authorization — missing token config is blocked", () => {
  const result = validateLabSponsoredSend(env({ operatorToken: "" }), auth(), body());
  assert.equal(result.ok, false);
  assert.equal(result.error_code, "LAB_AUTH_NOT_CONFIGURED");
  assert.equal(result.httpStatus, 503);
});

test("unauthenticated request is rejected", () => {
  const result = validateLabSponsoredSend(env(), auth(""), body());
  assert.equal(result.ok, false);
  assert.equal(result.error_code, "LAB_UNAUTHORIZED");
  assert.equal(result.httpStatus, 401);
});

test("wrong operator token is rejected", () => {
  const result = validateLabSponsoredSend(env(), auth("other"), body());
  assert.equal(result.ok, false);
  assert.equal(result.error_code, "LAB_UNAUTHORIZED");
});

test("disabled lab send stays 503", () => {
  const result = validateLabSponsoredSend(env({ allowSponsoredSend: "false" }), auth(), body());
  assert.equal(result.ok, false);
  assert.equal(result.error_code, "LAB_SEND_DISABLED");
});

test("arbitrary destination is rejected", () => {
  const result = validateLabSponsoredSend(env(), auth(), body({ to: "0x" + "ab".repeat(20) }));
  assert.equal(result.ok, false);
  assert.equal(result.error_code, "PROBE_MISMATCH");
  assert.equal(result.httpStatus, 400);
});

test("nonzero value is rejected", () => {
  const result = validateLabSponsoredSend(env(), auth(), body({ value: "0x1" }));
  assert.equal(result.ok, false);
  assert.equal(result.error_code, "NONZERO_VALUE");
});

test("unsupported chain is rejected", () => {
  const result = validateLabSponsoredSend(env(), auth(), body({ chainId: "1" }));
  assert.equal(result.ok, false);
  assert.equal(result.error_code, "UNSUPPORTED_CHAIN");
  assert.equal(result.httpStatus, 400);
});

test("malformed chainId returns controlled INVALID_CHAIN (not a thrown BigInt)", () => {
  const result = validateLabSponsoredSend(env(), auth(), body({ chainId: "not-a-chain" }));
  assert.equal(result.ok, false);
  assert.equal(result.error_code, "INVALID_CHAIN");
  assert.equal(result.httpStatus, 400);
});

test("disallowed selector is rejected", () => {
  const result = validateLabSponsoredSend(env(), auth(), body({ data: "0xa9059cbb" }));
  assert.equal(result.ok, false);
  assert.equal(result.error_code, "SELECTOR_NOT_ALLOWED");
});

test("alwaysRevert selector is allowed", () => {
  const result = validateLabSponsoredSend(env(), auth(), body({ data: CALLER_PROBE_SELECTORS.alwaysRevert }));
  assert.equal(result.ok, true);
});

test("calldata with arguments after selector is rejected", () => {
  const result = validateLabSponsoredSend(
    env(),
    auth(),
    body({ data: CALLER_PROBE_SELECTORS.probe + "00".repeat(32) }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.error_code, "SELECTOR_NOT_ALLOWED");
});
