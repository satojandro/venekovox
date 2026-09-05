import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Interface } from "ethers";
import {
  architectureMayBeApproved,
  EXPERIMENT_STEPS,
  loadEvidenceLog,
  saveEvidenceLog,
  type ExperimentId,
  type ExperimentNote,
  type GateVerdict,
} from "../lib/w1/protocol";
import { CALLER_PROBE_ABI, summarizeProbeReceipt } from "../lib/sponsored/probe";
import {
  checkSponsoredPublication,
  DEFAULT_TRUSTED_ENTRY_POINTS,
  innerFromPollLogs,
  isTxHash,
  type OuterReceipt,
  type VendorView,
} from "../lib/sponsored/verifier";
import { classifyAccountCode } from "../lib/wallet/delegation";
import { loadLabDraft, upsertLabDraft } from "../lib/sponsored/labDraft";

/**
 * W1 lab page. This is not the voting product.
 *
 * Vocabulary used on this screen:
 * - Outer transaction: the thing an explorer shows (often bundler → EntryPoint).
 * - User operation: the inner call the user meant to make.
 * - msg.sender: who the *contract* saw, which may differ from the outer `from`.
 */

const BACKEND = import.meta.env.VITE_W1_BACKEND_URL || "http://localhost:3100";
const PROBE = import.meta.env.VITE_W1_PROBE_ADDRESS || "";
const CHAIN_ID = BigInt(import.meta.env.VITE_CHAIN_ID ?? "11155111");
const ENTRY_POINTS = (import.meta.env.VITE_W1_ENTRY_POINTS as string | undefined)
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

interface StatusApiResponse {
  status?: string;
  vendorLookup?: "ok" | "missing" | "error" | "timeout";
  vendor?: VendorView | null;
  error_code?: string;
  message?: string;
  httpStatus?: number;
  blocked?: boolean;
}

function asVendorView(value: unknown): VendorView | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const transactionId =
    (typeof row.transactionId === "string" && row.transactionId) ||
    (typeof row.transaction_id === "string" && row.transaction_id) ||
    (typeof row.id === "string" && row.id) ||
    null;
  if (!transactionId) return null;
  const phaseRaw =
    (typeof row.phase === "string" && row.phase) || (typeof row.status === "string" && row.status) || "unknown";
  const phase = (
    ["pending", "confirmed", "reverted", "failed", "replaced", "denied", "unknown"] as const
  ).includes(phaseRaw as VendorView["phase"])
    ? (phaseRaw as VendorView["phase"])
    : "unknown";
  const userOperationHash =
    (typeof row.userOperationHash === "string" && row.userOperationHash) ||
    (typeof row.user_operation_hash === "string" && row.user_operation_hash) ||
    null;
  const transactionHash =
    (typeof row.transactionHash === "string" && row.transactionHash) ||
    (typeof row.transaction_hash === "string" && row.transaction_hash) ||
    null;
  return {
    transactionId,
    phase,
    userOperationHash,
    transactionHash: transactionHash && transactionHash.length > 2 ? transactionHash : null,
  };
}

async function assertConfiguredChain(wallet: NonNullable<typeof window.ethereum>): Promise<bigint> {
  const current = BigInt(await wallet.request({ method: "eth_chainId" }));
  if (current !== CHAIN_ID) {
    throw new Error(`Wrong network: wallet is on chain ${current}, configured experiment chain is ${CHAIN_ID}.`);
  }
  return current;
}

export default function W1Experiment() {
  const [notes, setNotes] = useState(() => loadEvidenceLog());
  const [txHash, setTxHash] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [participant, setParticipant] = useState("");
  const [pollAddress, setPollAddress] = useState("");
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  /** Which transactionId `submittedAt` belongs to — never reuse across different ids. */
  const [submittedTxId, setSubmittedTxId] = useState<string | null>(null);
  /** Operator token for lab sponsored send — memory only; never a VITE_ env. */
  const [operatorToken, setOperatorToken] = useState("");
  const approved = useMemo(() => architectureMayBeApproved(notes), [notes]);
  const trustedEntryPoints = ENTRY_POINTS?.length ? ENTRY_POINTS : [...DEFAULT_TRUSTED_ENTRY_POINTS];

  useEffect(() => {
    try {
      saveEvidenceLog(notes);
    } catch {
      /* storage blocked: the on-screen notes still work for this session */
    }
  }, [notes]);

  // E4: restore durable identifiers after refresh.
  useEffect(() => {
    const draft = loadLabDraft();
    if (!draft) return;
    if (draft.chainId !== CHAIN_ID.toString()) {
      setReport(
        JSON.stringify(
          {
            restored: false,
            reason: "saved draft chain does not match VITE_CHAIN_ID",
            draftChainId: draft.chainId,
            configuredChainId: CHAIN_ID.toString(),
          },
          null,
          2,
        ),
      );
      return;
    }
    setTransactionId(draft.transactionId);
    if (draft.participant) setParticipant(draft.participant);
    if (draft.pollAddress) setPollAddress(draft.pollAddress);
    if (draft.transactionHash) setTxHash(draft.transactionHash);
    setSubmittedAt(draft.submittedAt);
    setSubmittedTxId(draft.transactionId);
    setReport(
      JSON.stringify(
        {
          restored: true,
          meaning: "E4: durable identifiers survived refresh. Reconcile to resume pending/confirmed/failed/unknown.",
          draft,
        },
        null,
        2,
      ),
    );
  }, []);

  function updateNote(id: ExperimentId, patch: Partial<ExperimentNote>) {
    setNotes((current) => ({
      ...current,
      [id]: { ...current[id], ...patch, id, updatedAt: Date.now() },
    }));
  }

  const persistVendor = useCallback(
    (vendor: VendorView, intent?: string) => {
      const update: Parameters<typeof upsertLabDraft>[0] = {
        transactionId: vendor.transactionId,
        chainId: CHAIN_ID.toString(),
      };
      if (participant) update.participant = participant;
      if (pollAddress) update.pollAddress = pollAddress;
      if (vendor.userOperationHash) update.userOperationHash = vendor.userOperationHash;
      if (vendor.transactionHash) update.transactionHash = vendor.transactionHash;
      if (intent) update.intent = intent;
      // Only pass a timestamp that belongs to this transaction. Same-id updates let
      // upsertLabDraft preserve storage's submittedAt; a different id must not inherit it.
      if (submittedAt && submittedTxId === vendor.transactionId) {
        update.submittedAt = submittedAt;
      }
      const draft = upsertLabDraft(update);
      setSubmittedAt(draft.submittedAt);
      setSubmittedTxId(draft.transactionId);
      return draft;
    },
    [participant, pollAddress, submittedAt, submittedTxId],
  );

  function validateOptionalAddresses(): string | null {
    const acct = participant.trim();
    const poll = pollAddress.trim();
    if (acct && !/^0x[0-9a-fA-F]{40}$/.test(acct)) return "Participating account must be a 20-byte hex address.";
    if (poll && !/^0x[0-9a-fA-F]{40}$/.test(poll)) return "Poll address must be a 20-byte hex address.";
    return null;
  }

  async function decodeProbe(event: FormEvent) {
    event.preventDefault();
    setError("");
    setReport("");
    if (!isTxHash(txHash.trim())) {
      setError("Paste a 0x-prefixed 32-byte transaction hash.");
      return;
    }
    if (!PROBE) {
      setError("Set VITE_W1_PROBE_ADDRESS to the deployed CallerProbe (after Alejandro runs deploy-caller-probe).");
      return;
    }
    const wallet = window.ethereum;
    if (!wallet) {
      setError("Connect an injected wallet so we can read the chain. This decode step does not send a sponsored transaction.");
      return;
    }
    try {
      const observedChainId = await assertConfiguredChain(wallet);
      const provider = new BrowserProvider(wallet);
      const receipt = await provider.getTransactionReceipt(txHash.trim());
      const tx = await provider.getTransaction(txHash.trim());
      if (!receipt) {
        setReport(
          JSON.stringify(
            {
              observedChainId: observedChainId.toString(),
              meaning: "RPC returned no receipt yet. That is pending (propagation lag), not vendor failure.",
            },
            null,
            2,
          ),
        );
        return;
      }
      const summary = summarizeProbeReceipt({
        probeAddress: PROBE,
        receipt: {
          status: receipt.status,
          from: receipt.from,
          to: receipt.to,
          logs: receipt.logs.map((log) => ({ address: log.address, topics: [...log.topics], data: log.data })),
        },
      });
      const callerCode = summary.echoedCaller ? classifyAccountCode(await provider.getCode(summary.echoedCaller)) : null;
      const toCode = summary.outerTo ? classifyAccountCode(await provider.getCode(summary.outerTo)) : null;
      setReport(
        JSON.stringify(
          {
            observedChainId: observedChainId.toString(),
            configuredChainId: CHAIN_ID.toString(),
            outerFrom: summary.outerFrom,
            outerTo: summary.outerTo,
            outerStatus: summary.outerStatus,
            txTo: tx?.to ?? null,
            echoedCaller: summary.echoedCaller,
            echoedOrigin: summary.echoedOrigin,
            echoedGasPrice: summary.echoedGasPrice,
            outerSenderDiffersFromCaller: summary.outerSenderDiffersFromCaller,
            callerDelegation: callerCode,
            outerToCode: toCode,
            note: "If outerSenderDiffersFromCaller is true, P1's transaction.from = participant check would fail even when the probe saw the user.",
          },
          null,
          2,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decode failed.");
    }
  }

  async function reconcileVendor(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    setReport("");
    const id = transactionId.trim();
    if (!id) {
      setError("Paste the Privy transaction_id from broadcast (not necessarily a tx hash).");
      return;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      const response = await fetch(`${BACKEND}/w1/transactions/${encodeURIComponent(id)}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      const body = (await response.json()) as StatusApiResponse;
      if (response.status === 503) {
        setReport(
          JSON.stringify({ blocked: true, ...body, meaning: "E1 is not configured. This is not a failed vote." }, null, 2),
        );
        return;
      }
      const vendor = asVendorView(body.vendor);
      let draft = null;
      let persistWarning: string | null = null;
      if (vendor) {
        try {
          draft = persistVendor(vendor);
        } catch (persistErr) {
          persistWarning =
            persistErr instanceof Error
              ? persistErr.message
              : "Draft storage failed. Status lookup and verification still ran.";
          // Do not keep a previous transaction's clock for a different id.
          if (submittedTxId !== vendor.transactionId) {
            setSubmittedAt(null);
            setSubmittedTxId(vendor.transactionId);
          }
        }
      }

      const displaySubmittedAt =
        draft?.submittedAt ??
        (vendor && submittedTxId === vendor.transactionId ? submittedAt : null);

      if (participant && pollAddress && vendor) {
        const wallet = window.ethereum;
        let outerReceipt: OuterReceipt | null = null;
        let outerReceiptLookup: "ok" | "null" | "error" = "null";
        let observedChainId: string | null = null;
        if (wallet && vendor.transactionHash && isTxHash(vendor.transactionHash)) {
          try {
            observedChainId = (await assertConfiguredChain(wallet)).toString();
            const provider = new BrowserProvider(wallet);
            const receipt = await provider.getTransactionReceipt(vendor.transactionHash);
            outerReceiptLookup = receipt ? "ok" : "null";
            outerReceipt = receipt
              ? {
                  status: receipt.status,
                  from: receipt.from,
                  to: receipt.to,
                  logs: receipt.logs.map((log) => ({
                    address: log.address,
                    topics: [...log.topics],
                    data: log.data,
                  })),
                }
              : null;
          } catch (err) {
            if (err instanceof Error && err.message.startsWith("Wrong network")) {
              setError(err.message);
              return;
            }
            outerReceiptLookup = "error";
          }
        }
        // Lab does not yet have EntryPoint/account execution linkage for Poll
        // publications — leave linkedToUserOperation false so co-located logs
        // cannot false-confirm.
        const verdict = checkSponsoredPublication({
          participant,
          pollAddress,
          lookup: {
            vendor,
            vendorLookup: body.vendorLookup === "timeout" ? "timeout" : response.ok ? (body.vendorLookup ?? "ok") : "error",
            outerReceipt,
            outerReceiptLookup,
            inner: outerReceipt ? innerFromPollLogs(outerReceipt, pollAddress, null, false) : null,
            trustedEntryPoints,
          },
        });
        setReport(
          JSON.stringify(
            {
              observedChainId,
              configuredChainId: CHAIN_ID.toString(),
              submittedAt: displaySubmittedAt,
              draft,
              persistWarning,
              vendor,
              verdict,
              note: "Publication confirmation stays unverified until operation-linked inner evidence exists.",
            },
            null,
            2,
          ),
        );
      } else {
        setReport(
          JSON.stringify(
            {
              configuredChainId: CHAIN_ID.toString(),
              submittedAt: displaySubmittedAt,
              draft,
              persistWarning,
              vendorLookup: body.vendorLookup,
              vendor,
              raw: body,
            },
            null,
            2,
          ),
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setReport(
          JSON.stringify(
            {
              vendorLookup: "timeout",
              meaning: "Timeout after broadcast stays outcome-unknown until reconciled. Do not show 'nothing happened'.",
            },
            null,
            2,
          ),
        );
        return;
      }
      setError(err instanceof Error ? err.message : "Vendor lookup failed.");
    }
  }

  async function sendInjectedProbe(revert: boolean) {
    setError("");
    setReport("");
    if (!PROBE) {
      setError("Set VITE_W1_PROBE_ADDRESS first. This button is an injected-wallet probe of CallerProbe, not sponsorship.");
      return;
    }
    const wallet = window.ethereum;
    if (!wallet) {
      setError("No injected wallet.");
      return;
    }
    try {
      const observedChainId = await assertConfiguredChain(wallet);
      const provider = new BrowserProvider(wallet);
      const signer = await provider.getSigner();
      const iface = new Interface(CALLER_PROBE_ABI);
      const data = iface.encodeFunctionData(revert ? "alwaysRevert" : "probe");
      const tx = await signer.sendTransaction({ to: PROBE, data });
      const receipt = await tx.wait();
      setReport(
        JSON.stringify(
          {
            warning: "This was a user-funded injected transaction. It does not prove Privy sponsorship.",
            observedChainId: observedChainId.toString(),
            configuredChainId: CHAIN_ID.toString(),
            hash: tx.hash,
            status: receipt?.status ?? null,
          },
          null,
          2,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Injected probe failed.");
    }
  }

  async function sendLabSponsored(revert: boolean) {
    setError("");
    setReport("");
    if (!PROBE) {
      setError("Set VITE_W1_PROBE_ADDRESS first.");
      return;
    }
    if (!operatorToken.trim()) {
      setError("Enter the lab operator token (server W1_LAB_OPERATOR_TOKEN). It is not a VITE_ secret.");
      return;
    }
    const addressError = validateOptionalAddresses();
    if (addressError) {
      setError(addressError);
      return;
    }
    const iface = new Interface(CALLER_PROBE_ABI);
    const data = iface.encodeFunctionData(revert ? "alwaysRevert" : "probe");
    const intent = revert ? "alwaysRevert" : "probe";
    try {
      const response = await fetch(`${BACKEND}/w1/lab/sponsored-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-w1-lab-operator-token": operatorToken.trim(),
        },
        body: JSON.stringify({
          to: PROBE,
          data,
          chainId: CHAIN_ID.toString(),
          value: "0x0",
        }),
      });
      const body = (await response.json()) as StatusApiResponse;
      if (response.status === 503 || response.status === 401) {
        setReport(JSON.stringify({ blocked: response.status === 503, unauthorized: response.status === 401, ...body }, null, 2));
        return;
      }
      const vendor = asVendorView(body.vendor);
      if (vendor) {
        // Always keep broadcast identifiers in memory first — persistence must not hide them.
        setTransactionId(vendor.transactionId);
        if (vendor.transactionHash) setTxHash(vendor.transactionHash);

        let draft = null;
        let persistWarning: string | null = null;
        try {
          draft = persistVendor(vendor, intent);
        } catch (persistErr) {
          persistWarning =
            persistErr instanceof Error
              ? persistErr.message
              : "Draft storage failed. Copy the transaction_id below — the send already happened.";
          // Broadcast succeeded — keep a clock in memory for this id even if storage failed.
          setSubmittedAt(Date.now());
          setSubmittedTxId(vendor.transactionId);
        }

        setReport(
          JSON.stringify(
            {
              meaning: "Lab-only sponsored send. Production voting is still gated.",
              configuredChainId: CHAIN_ID.toString(),
              transactionId: vendor.transactionId,
              userOperationHash: vendor.userOperationHash,
              transactionHash: vendor.transactionHash,
              draft,
              persistWarning,
              vendor,
              raw: body,
            },
            null,
            2,
          ),
        );
        return;
      }
      setReport(JSON.stringify({ responseStatus: response.status, body }, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lab sponsored send failed.");
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-amber-400">W1 experiment — architecture not approved</p>
        <h1 className="text-3xl font-bold">Sponsored execution lab</h1>
        <p className="text-gray-300">
          Privy is the first vendor to try (D06 provisional). A same account address does not mean the same transaction
          shape. P1 still only confirms a direct EOA <code>publishMessage</code> to the Poll. This page collects E1–E6
          evidence so we can write a sponsored verifier instead of weakening P1.
        </p>
        <p className="text-sm text-amber-200">
          {approved
            ? "All six rows are marked pass on this device. Treat that as a notebook claim until public tx evidence is recorded."
            : "Architecture stays unapproved until every row below is pass with evidence."}
        </p>
        <p className="text-xs text-gray-500">Configured chain: {CHAIN_ID.toString()}. Lab sends refuse other networks.</p>
      </header>

      <section className="space-y-4">
        {EXPERIMENT_STEPS.map((step) => {
          const note = notes[step.id];
          return (
            <article key={step.id} className="border border-gray-700 rounded-lg p-4 space-y-3 bg-gray-900/40">
              <h2 className="font-semibold">
                {step.id}. {step.title}
              </h2>
              <p className="text-sm text-gray-400">Proves: {step.proves}</p>
              <p className="text-sm text-gray-500">Capture: {step.capture}</p>
              <label className="block text-sm">
                Verdict
                <select
                  className="mt-1 w-full bg-gray-950 border border-gray-700 rounded p-2"
                  value={note.verdict}
                  onChange={(event) => updateNote(step.id, { verdict: event.target.value as GateVerdict })}
                >
                  <option value="not-run">not run</option>
                  <option value="pass">pass</option>
                  <option value="fail">fail</option>
                  <option value="blocked">blocked (config)</option>
                </select>
              </label>
              <label className="block text-sm">
                Evidence notes (public links and ids only — no secrets)
                <textarea
                  className="mt-1 w-full bg-gray-950 border border-gray-700 rounded p-2 min-h-[4rem]"
                  value={note.evidence}
                  onChange={(event) => updateNote(step.id, { evidence: event.target.value })}
                />
              </label>
            </article>
          );
        })}
      </section>

      <section className="border border-gray-700 rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Decode a CallerProbe transaction (E2/E3)</h2>
        <form onSubmit={decodeProbe} className="space-y-3">
          <input
            className="w-full bg-gray-950 border border-gray-700 rounded p-2"
            placeholder="0x transaction hash"
            value={txHash}
            onChange={(event) => setTxHash(event.target.value)}
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded">
            Decode outer vs inner caller
          </button>
        </form>
        <label className="block text-sm">
          Lab operator token (memory only — matches server <code>W1_LAB_OPERATOR_TOKEN</code>, never a <code>VITE_</code> env)
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full bg-gray-950 border border-gray-700 rounded p-2"
            value={operatorToken}
            onChange={(event) => setOperatorToken(event.target.value)}
            placeholder="operator token"
          />
        </label>
        <p className="text-xs text-gray-500">
          Injected buttons are user-funded diagnostics. Lab sponsored buttons call the backend proxy with{" "}
          <code>sponsor: true</code> (E2–E6), require the operator token, and are not wired into voting.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="border border-gray-600 px-3 py-2 rounded" onClick={() => void sendInjectedProbe(false)}>
            Injected probe()
          </button>
          <button type="button" className="border border-gray-600 px-3 py-2 rounded" onClick={() => void sendInjectedProbe(true)}>
            Injected alwaysRevert()
          </button>
          <button type="button" className="border border-amber-700 px-3 py-2 rounded text-amber-200" onClick={() => void sendLabSponsored(false)}>
            Lab sponsored probe()
          </button>
          <button type="button" className="border border-amber-700 px-3 py-2 rounded text-amber-200" onClick={() => void sendLabSponsored(true)}>
            Lab sponsored alwaysRevert()
          </button>
        </div>
      </section>

      <section className="border border-gray-700 rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">Reconcile a Privy transaction_id (E3/E4)</h2>
        <form onSubmit={reconcileVendor} className="space-y-3">
          <input
            className="w-full bg-gray-950 border border-gray-700 rounded p-2"
            placeholder="Privy transaction_id"
            value={transactionId}
            onChange={(event) => setTransactionId(event.target.value)}
          />
          <input
            className="w-full bg-gray-950 border border-gray-700 rounded p-2"
            placeholder="Participating account (0x…)"
            value={participant}
            onChange={(event) => setParticipant(event.target.value)}
          />
          <input
            className="w-full bg-gray-950 border border-gray-700 rounded p-2"
            placeholder="Resolved Poll address (optional, for publication check)"
            value={pollAddress}
            onChange={(event) => setPollAddress(event.target.value)}
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded">
            Look up vendor status
          </button>
        </form>
        {submittedAt && submittedTxId && submittedTxId === transactionId.trim() ? (
          <p className="text-xs text-gray-500">
            Original submission time for {submittedTxId} (preserved across refresh): {new Date(submittedAt).toISOString()}
          </p>
        ) : null}
      </section>

      {error ? <pre className="text-red-300 whitespace-pre-wrap">{error}</pre> : null}
      {report ? <pre className="text-sm bg-black/50 border border-gray-800 rounded p-4 overflow-x-auto">{report}</pre> : null}
    </main>
  );
}
