// W1 experiment protocol (E1–E6). Architecture is NOT approved until every row
// has evidence. Saving a note here is a lab notebook, not a pass.

export const EXPERIMENT_STEPS = [
  {
    id: "E1",
    title: "Enable Sepolia sponsorship",
    proves: "Actual app entitlement and the exact pinned SDK path",
    capture: "Dashboard plan/tier, TEE execution, Sepolia in the sponsorship chain list, SDK version",
  },
  {
    id: "E2",
    title: "Zero-ETH sponsored call to CallerProbe",
    proves: "Contract caller vs outer tx sender/recipient; delegation; gas payer",
    capture: "Probe address, tx/user-op ids, Probed caller/origin/gasPrice, outer from/to, 0xef0100 code check",
  },
  {
    id: "E3",
    title: "Deliberate revert of a sponsored call",
    proves: "User-op/call failure is distinct from outer-transaction success",
    capture: "transaction_id, webhook/API status, UserOperationEvent.success, outer receipt.status",
  },
  {
    id: "E4",
    title: "Refresh during submission",
    proves: "Durable identifiers and recoverable pending/confirmed/failed/unknown state",
    capture: "transaction_id survives reload; UI states; no automatic 'nothing happened'",
  },
  {
    id: "E5",
    title: "MACI signup, join, publish separately",
    proves: "Policy + caller + MACI key + execution path together — not a generic batching claim",
    capture: "Per-step ids, poll msg.sender matching E2 account, join proof accepted, timings",
  },
  {
    id: "E6",
    title: "Deny sponsorship",
    proves: "Explicit recoverable failure; no unexpected paid fallback",
    capture: "Error type, UI copy, confirmation that the injected adapter did not send ETH",
  },
] as const;

export type ExperimentId = (typeof EXPERIMENT_STEPS)[number]["id"];

export type GateVerdict = "not-run" | "pass" | "fail" | "blocked";

export interface ExperimentNote {
  id: ExperimentId;
  verdict: GateVerdict;
  evidence: string;
  updatedAt: number;
}

const STORAGE_KEY = "venekovox_w1_evidence:v1";

export function emptyNotes(): Record<ExperimentId, ExperimentNote> {
  const notes = {} as Record<ExperimentId, ExperimentNote>;
  for (const step of EXPERIMENT_STEPS) {
    notes[step.id] = { id: step.id, verdict: "not-run", evidence: "", updatedAt: 0 };
  }
  return notes;
}

export function parseEvidenceLog(raw: string | null): Record<ExperimentId, ExperimentNote> {
  const base = emptyNotes();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return base;
    for (const step of EXPERIMENT_STEPS) {
      const row = (parsed as Record<string, unknown>)[step.id];
      if (!row || typeof row !== "object") continue;
      const { verdict, evidence, updatedAt } = row as Record<string, unknown>;
      if (verdict !== "not-run" && verdict !== "pass" && verdict !== "fail" && verdict !== "blocked") continue;
      if (typeof evidence !== "string") continue;
      if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) continue;
      base[step.id] = { id: step.id, verdict, evidence, updatedAt };
    }
    return base;
  } catch {
    return base;
  }
}

export function loadEvidenceLog(storage: Pick<Storage, "getItem"> | null = globalThis.localStorage): Record<
  ExperimentId,
  ExperimentNote
> {
  if (!storage) return emptyNotes();
  try {
    return parseEvidenceLog(storage.getItem(STORAGE_KEY));
  } catch {
    return emptyNotes();
  }
}

export function saveEvidenceLog(
  notes: Record<ExperimentId, ExperimentNote>,
  storage: Pick<Storage, "setItem"> | null = globalThis.localStorage,
): void {
  if (!storage) throw new Error("Evidence storage is unavailable.");
  storage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function architectureMayBeApproved(notes: Record<ExperimentId, ExperimentNote>): boolean {
  return EXPERIMENT_STEPS.every((step) => notes[step.id].verdict === "pass");
}
