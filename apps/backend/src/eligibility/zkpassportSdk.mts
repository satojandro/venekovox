import { createRequire } from "node:module";
import type { ZKPassport as ZKPassportInstance, ProofResult, Query, QueryResult, CountryName } from "@zkpassport/sdk";
import type { ZkPassportTransport, ZkPassportVerifyResult, ZkPassportQueryConfig } from "./zkpassport.js";

/**
 * Native ESM boundary for @zkpassport/sdk@0.16.2.
 *
 * Node ESM entry on strict pnpm layouts (this repo's store) throws
 * ERR_UNSUPPORTED_DIR_IMPORT for the `buffer/` directory import inside the SDK's
 * dist/esm bundle. The SDK's declared `exports` map also provides a CJS entry
 * (`./dist/cjs/index.cjs`), which resolves cleanly — so we load the module with
 * createRequire and keep only TYPE imports from the package (erased at runtime).
 *
 * The mobile app bridges to a CLIENT-side SDK instance (browser); server-side we
 * never call request() because it opens a WebSocket bridge and blocks headless.
 * We use createQuery() — an OFFLINE builder that makes no network connection —
 * to rebuild the exact expected query, then verify(), which cryptographically
 * checks proofs against that query, the query result, scope and dev mode.
 */
const require = createRequire(process.env.P2_TOOLCHAIN_PACKAGE_JSON || import.meta.url);
const {
  ZKPassport,
  NullifierType,
}: { ZKPassport: typeof ZKPassportInstance; NullifierType: Record<number, string> } = require("@zkpassport/sdk");

/**
 * Normalize the SDK's NUMERIC NullifierType enum (NON_SALTED=0, SALTED=1,
 * NON_SALTED_MOCK=2, SALTED_MOCK=3) to the string tags the eligibility
 * boundary uses. The adapter must never compare raw enum numbers, or a
 * legitimate salted proof (number 1) would fail a string comparison.
 */
export function tagNullifierType(value: number | undefined): ZkPassportVerifyResult["uniqueIdentifierType"] {
  if (value === undefined) return undefined;
  return (NullifierType[value] as ZkPassportVerifyResult["uniqueIdentifierType"]) ?? undefined;
}

export function zkpassportTransport(domain: string, options?: { devMode?: boolean }): ZkPassportTransport {
  if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error("ZKPASSPORT_INVALID_DOMAIN");
  const zk = new ZKPassport(domain, { disableProofStorage: true });
  return {
    // Offline: builds the same query shape the trial server will verify against.
    buildQuery: (cfg: ZkPassportQueryConfig): Query => {
      const qb = zk.createQuery();
      if (cfg.discloseGender) qb.disclose("gender");
      if (cfg.minimumAge !== undefined) qb.gte("age", cfg.minimumAge);
      if (cfg.ageBand) qb.range("age", cfg.ageBand.min, cfg.ageBand.max);
      if (cfg.nationalityIn?.length) qb.in("nationality", cfg.nationalityIn as CountryName[]);
      // D17: salted uniqueness requires strict facematch. The canonical query
      // carries it so the client query can never match without it.
      if (cfg.facematch === "strict") qb.facematch("strict");
      return qb.done().query;
    },
    verify: async (input: {
      proofs: unknown[];
      originalQuery: unknown;
      queryResult: unknown;
      validity: number;
      scope: string;
      devMode: boolean;
      writingDirectory?: string;
      oprfKeyId?: string;
    }): Promise<ZkPassportVerifyResult> => {
      const result = await zk.verify({
        proofs: input.proofs as ProofResult[],
        originalQuery: input.originalQuery as Query,
        queryResult: input.queryResult as QueryResult,
        validity: input.validity,
        scope: input.scope,
        devMode: input.devMode,
        ...(input.writingDirectory ? { writingDirectory: input.writingDirectory } : {}),
        ...(input.oprfKeyId ? { oprfKeyId: input.oprfKeyId } : {}),
      });
      // The SDK returns uniqueIdentifierType as a numeric enum; normalize to the
      // string tag so the eligibility adapter compares stable labels, not enum
      // numbers that change with SDK versions.
      return { ...result, uniqueIdentifierType: tagNullifierType(result.uniqueIdentifierType) };
    },
  };
}
