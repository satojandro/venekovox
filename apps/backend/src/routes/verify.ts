import express, { Request, Response } from "express";
import { SelfBackendVerifier, DefaultConfigStore, AllIds } from "@selfxyz/core";

const router: import("express").Router = express.Router();

// LEGACY SELF PASS — retained only for the existing UI during migration.
// New eligibility work uses Enterprise (docs/build.md A1, D02).
// This route is NOT MACI eligibility authorization and must not be extended.
const SCOPE = process.env.SELF_SCOPE || "venekovox-trust-ritual";
const ENDPOINT = process.env.SELF_ENDPOINT || "http://localhost:3100/verify";
// true = accept mock passports (testnet/staging), false = real documents (mainnet)
const MOCK_PASSPORT = process.env.MOCK_PASSPORT === "true";

const allowedIds = new Map<1 | 2, boolean>([
  [1, true], // electronic passport
  [2, true], // EU ID card
]);

const selfBackendVerifier = new SelfBackendVerifier(
  SCOPE,
  ENDPOINT,
  MOCK_PASSPORT,
  allowedIds,
  new DefaultConfigStore({
    minimumAge: 18,
    excludedCountries: [],
    ofac: false,
  }),
  "uuid",
);

// POST /verify - Verify a Self.xyz ZK-proof produced by the mobile app
router.post("/", async (req: Request, res: Response) => {
  try {
    const { attestationId, proof, publicSignals, userContextData } = req.body ?? {};

    if (!attestationId || !proof || !publicSignals || !userContextData) {
      return res.status(400).json({
        status: "error",
        result: false,
        message: "attestationId, proof, publicSignals and userContextData are required",
      });
    }

    const result = await selfBackendVerifier.verify(attestationId, proof, publicSignals, userContextData);

    if (result.isValidDetails.isValid) {
      // Store only non-identifying disclosures; never persist name/ID number.
      const { nullifier } = result.discloseOutput;
      console.log(`✅ Verified. nullifier=${nullifier.slice(0, 12)}… nationality=${result.discloseOutput.nationality}`);

      return res.json({
        status: "verified",
        verifiedAt: new Date().toISOString(),
        // nullifier lets us dedupe re-verifications without knowing who the user is
        nullifier,
        userData: {
          nationality: result.discloseOutput.nationality,
          gender: result.discloseOutput.gender,
        },
        discloseOutput: result.discloseOutput,
      });
    }

    return res.status(400).json({
      status: "error",
      result: false,
      reason: "Verification failed",
      error_code: "VERIFICATION_FAILED",
      details: result.isValidDetails,
    });
  } catch (error: unknown) {
    // ConfigMismatchError carries structured issues from the SDK
    const err = error as { name?: string; issues?: unknown; message?: string };
    if (err?.name === "ConfigMismatchError") {
      return res.status(400).json({
        status: "error",
        result: false,
        error_code: "CONFIG_MISMATCH",
        issues: err.issues,
      });
    }
    console.error("❌ Verification error:", error);
    return res.status(500).json({
      status: "error",
      result: false,
      error_code: "UNKNOWN_ERROR",
      reason: err?.message || "Unknown error occurred",
    });
  }
});

// GET /verify - Health check for the verification endpoint
router.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "operational",
    service: "Self.xyz Verification",
    scope: SCOPE,
    mockPassport: MOCK_PASSPORT,
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

export default router;
