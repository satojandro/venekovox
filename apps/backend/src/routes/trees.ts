import { Router, type Request, type Response } from "express";
import { getInclusionProof, serializeProof, getJoinedParticipantStats } from "../trees/service";
import { SnapshotError } from "../trees/snapshot";

const router: import("express").Router = Router();

router.get("/inclusion-proof", async (req: Request, res: Response) => {
  try {
    const maci = String(req.query.maci || "");
    const publicKeyX = String(req.query.publicKeyX || "");
    const publicKeyY = String(req.query.publicKeyY || "");
    if (!maci || !publicKeyX || !publicKeyY) {
      return res.status(400).json({ error: "MISSING_PARAMS", message: "maci, publicKeyX, publicKeyY are required." });
    }
    const proof = await getInclusionProof({ maci, publicKeyX, publicKeyY });
    return res.json({
      leafIndex: proof.leafIndex,
      stateRootIndex: proof.stateRootIndex,
      inclusionProof: serializeProof(proof.inclusionProof),
      provenance: proof.provenance,
    });
  } catch (error) {
    const code = error instanceof SnapshotError ? error.code : "PROOF_UNAVAILABLE";
    const status = code === "NOT_CONFIGURED" || code === "NO_SNAPSHOT" || code === "VOTER_NOT_IN_SNAPSHOT" ? 404 : 502;
    return res.status(status).json({
      error: code,
      message: error instanceof Error ? error.message : "Inclusion proof unavailable.",
    });
  }
});

router.get("/joined-count", async (req: Request, res: Response) => {
  try {
    const stats = await getJoinedParticipantStats({
      ...process.env,
      POLL_ADDRESS: String(req.query.poll || process.env.POLL_ADDRESS || ""),
    });
    if (!stats) {
      return res.status(404).json({ error: "NOT_CONFIGURED" });
    }
    return res.json({
      joinedParticipants: stats.joinedParticipants,
      indexedBlock: stats.indexedBlock,
      indexedBlockHash: stats.indexedBlockHash,
      hasIndexingError: stats.hasIndexingError,
      meaning: "joined_participants",
    });
  } catch {
    return res.status(502).json({ error: "INDEX_UNAVAILABLE" });
  }
});

export default router;
