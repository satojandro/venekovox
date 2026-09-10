import { Wallet, JsonRpcProvider, FetchRequest, ethers } from "ethers";
import { accountControlVerifier } from "./accountControl";
import { ZkPassportEligibility, type ZkPassportConfig } from "./zkpassport";
import { zkpassportTransport } from "./zkpassportSdk";
import { MemorySessionStore, type SessionStore } from "./sessionStore";

/**
 * Wire the proven ZKPassport adapter into the product process.
 *
 * Env uses ZKP_* (not TRIAL_*). Test mode (default) generates throwaway issuer
 * keys and policy/target addresses — never the zero address, because
 * accountAddress() rejects it. Live mode fails fast if issuer/tag secrets
 * are missing. Durable storage is NOT provided (G01).
 */

export interface ProductEligibility {
  service: ZkPassportEligibility;
  /** In-memory index only. Not the challenge source of truth (that's the adapter). */
  sessions: SessionStore;
  mode: "test" | "live";
  provider: "zkpassport";
}

export interface ProductEnv {
  ZKP_MODE?: string;
  ZKP_DOMAIN?: string;
  ZKP_SCOPE?: string;
  ZKP_CONFIG_ID?: string;
  ZKP_LIVE_REQUIRED?: string;
  ZKP_OPRF_KEY_ID?: string;
  ZKP_VALIDITY?: string;
  ZKP_NATIONALITY_ALLOWLIST?: string;
  /** REVEAL opt-ins — the mobile app coalesces REVEALs into one disclose_bytes
   *  circuit (age/country CHECKs ride the compare circuits). All default
   *  OFF for Stage 1. Age ranges ARE a CHECK (mobile compare_age handles
   *  .range("age",min,max)); range analytics do NOT require birthdate. */
  ZKP_DISCLOSE_GENDER?: string;
  ZKP_DISCLOSE_BIRTHDATE?: string;
  ZKP_DISCLOSE_NATIONALITY?: string;
  ISSUER_PRIVATE_KEY?: string;
  TAG_SECRET?: string;
  POLICY_ADDRESS?: string;
  TARGET_ADDRESS?: string;
  CHAIN_ID?: string;
  PUBLIC_RPC_URL?: string;
  VITE_PUBLIC_RPC_URL?: string;
}

function requiredLive(env: ProductEnv, testMode: boolean): void {
  if (testMode) return;
  if (!env.ISSUER_PRIVATE_KEY || !env.TAG_SECRET) {
    throw new Error("LIVE_MODE_REQUIRES_ISSUER_PRIVATE_KEY_AND_TAG_SECRET");
  }
}

export function createProductEligibility(env: ProductEnv = process.env as ProductEnv): ProductEligibility {
  const testMode = env.ZKP_MODE !== "live";
  requiredLive(env, testMode);

  const issuer = new Wallet(testMode ? Wallet.createRandom().privateKey : (env.ISSUER_PRIVATE_KEY as string));
  const chainId = BigInt(env.CHAIN_ID || "11155111");
  const policyAddress = env.POLICY_ADDRESS || (testMode ? Wallet.createRandom().address : ethers.ZeroAddress);
  const target = env.TARGET_ADDRESS || (testMode ? Wallet.createRandom().address : ethers.ZeroAddress);
  if (policyAddress === ethers.ZeroAddress || target === ethers.ZeroAddress) {
    throw new Error("POLICY_AND_TARGET_MUST_NOT_BE_ZERO_ADDRESS");
  }

  const tagSecret = testMode ? ethers.randomBytes(32) : Uint8Array.from(Buffer.from(env.TAG_SECRET as string, "hex"));
  if (tagSecret.length < 32) throw new Error("TAG_SECRET too short in live mode");

  const config: ZkPassportConfig = {
    chainId,
    policyAddress,
    target,
    configId: ethers.keccak256(ethers.toUtf8Bytes(env.ZKP_CONFIG_ID || "venekovox-stage1-salted-v1")),
    action: ethers.keccak256(ethers.toUtf8Bytes("signup")),
    identityNamespace: "venekovox:stage1:" + (testMode ? "test" : "live"),
    environment: testMode ? "test" : "live",
    zkDomain: env.ZKP_DOMAIN || "uxisnear.com",
    zkScope: env.ZKP_SCOPE || "venekovox-stage1",
    uniqueIdentifierType: "salted",
    oprfKeyId: env.ZKP_OPRF_KEY_ID || undefined,
    validity: Number(env.ZKP_VALIDITY || 604800),
    devMode: !env.ZKP_LIVE_REQUIRED,
    query: {
      nationalityIn: env.ZKP_NATIONALITY_ALLOWLIST?.split(",").filter(Boolean) || [
        "Venezuela",
        "United States",
        "Australia",
      ],
      minimumAge: 18,
      // REVEALs: all OFF for Stage 1 (minimal disclosure). REVEALs coalesce
      // into one disclose_bytes circuit on-device; age ranges are a CHECK
      // (mobile compare_age) — range analytics don't need birthdate REVEAL.
      reveal: {
        gender: env.ZKP_DISCLOSE_GENDER === "on",
        dateOfBirth: env.ZKP_DISCLOSE_BIRTHDATE === "on",
        nationality: env.ZKP_DISCLOSE_NATIONALITY === "on",
      },
      facematch: "strict",
    },
  };

  const rpcUrl = (env.PUBLIC_RPC_URL || env.VITE_PUBLIC_RPC_URL || "").trim();
  const verifyAccountControl = testMode
    ? async (account: string, message: string, signature: string) => {
        try {
          return ethers.verifyMessage(message, signature).toLowerCase() === account.toLowerCase();
        } catch {
          return false;
        }
      }
    : accountControlVerifier(
        new JsonRpcProvider(new FetchRequest(rpcUrl || "https://ethereum-sepolia-rpc.publicnode.com")),
        chainId,
      );

  const service = new ZkPassportEligibility(
    config,
    {
      now: () => Math.floor(Date.now() / 1000),
      identityTagSecret: tagSecret,
      verifyAccountControl,
      sign: (domain, types, value) => issuer.signTypedData(domain, types, value),
    },
    zkpassportTransport(config.zkDomain, { devMode: config.devMode }),
  );

  return {
    service,
    sessions: new MemorySessionStore(),
    mode: testMode ? "test" : "live",
    provider: "zkpassport",
  };
}
