import { createRequire } from "node:module";
import type { ZKPassport as ZKPassportInstance, ProofResult, Query, QueryResult, CountryName } from "@zkpassport/sdk";
import type { ZkPassportTransport, ZkPassportVerifyResult, ZkPassportQueryConfig } from "./zkpassport";

/**
 * Native SDK boundary for @zkpassport/sdk@0.16.2.
 *
 * Node ESM entry on strict pnpm layouts throws ERR_UNSUPPORTED_DIR_IMPORT
 * for the `buffer/` directory import inside the SDK's dist/esm bundle. The
 * SDK's declared `exports` map also provides a CJS entry (`./dist/cjs/index.cjs`),
 * which resolves cleanly — so we load the module with createRequire and keep
 * only TYPE imports from the package (erased at runtime).
 *
 * Product `app.ts` is CommonJS (tsc). This `.ts` copy of the proven `.mts`
 * adapter is the same createRequire transport so the mount can compile. Do not
 * fork query/verify semantics here.
 *
 * The mobile app bridges to a CLIENT-side SDK instance (browser); server-side
 * we never call request() because it opens a WebSocket bridge and blocks headless.
 */
const sdkRequire = createRequire(process.env.P2_TOOLCHAIN_PACKAGE_JSON || __filename);
const { ZKPassport, NullifierType }: { ZKPassport: typeof ZKPassportInstance; NullifierType: Record<number, string> } =
  sdkRequire("@zkpassport/sdk");

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
    buildQuery: (cfg: ZkPassportQueryConfig): Query => {
      const qb = zk.createQuery();
      if (cfg.discloseGender) qb.disclose("gender");
      if (cfg.minimumAge !== undefined) qb.gte("age", cfg.minimumAge);
      if (cfg.ageBand) qb.range("age", cfg.ageBand.min, cfg.ageBand.max);
      if (cfg.nationalityIn?.length) qb.in("nationality", cfg.nationalityIn as CountryName[]);
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
      return { ...result, uniqueIdentifierType: tagNullifierType(result.uniqueIdentifierType) };
    },
  };
}
