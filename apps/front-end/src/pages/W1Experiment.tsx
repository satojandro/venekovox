import { FormEvent, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Interface } from "ethers";
import { architectureMayBeApproved, EXPERIMENT_STEPS, loadEvidenceLog, saveEvidenceLog, type ExperimentId, type ExperimentNote, type GateVerdict } from "../lib/w1/protocol";
import { CALLER_PROBE_ABI, summarizeProbeReceipt } from "../lib/sponsored/probe";
import { checkSponsoredPublication, innerFromPollLogs, isTxHash } from "../lib/sponsored/verifier";
import { mapPrivyTransaction, type PrivyTransactionRecord } from "../lib/sponsored/vendorStatus";
import { classifyAccountCode } from "../lib/wallet/delegation";
import { createSponsoredStore } from "../lib/sponsored/records";

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
const MACI = (import.meta.env.VITE_MACI_ADDRESS as string) || "";
const POLL_ID = BigInt(import.meta.env.VITE_POLL_ID ?? "0");

export default function W1Experiment() {
  const [notes, setNotes] = useState(() => loadEvidenceLog());
  const [txHash, setTxHash] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [participant, setParticipant] = useState("");
  const [pollAddress, setPollAddress] = useState("");
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState<string>("");
  const approved = useMemo(() => architectureMayBeApproved(notes), [notes]);

  useEffect(() => {
    try {
      saveEvidenceLog(notes);
    } catch {
      /* storage blocked: the on-screen notes still work for this session */
    }
  }, [notes]);

  function updateNote(id: ExperimentId, patch: Partial<ExperimentNote>) {
    setNotes((current) => ({
      ...current,
      [id]: { ...current[id], ...patch, id, updatedAt: Date.now() },
    }));
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
      const provider = new BrowserProvider(wallet);
      const receipt = await provider.getTransactionReceipt(txHash.trim());
      const tx = await provider.getTransaction(txHash.trim());
      if (!receipt) {
        setReport("RPC returned no receipt yet. That is pending (propagation lag), not vendor failure.");
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

  async function reconcileVendor(event: FormEvent) {
    event.preventDefault();
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
      const response = await fetch(`${BACKEND}/w1/transactions/${encodeURIComponent(id)}`, { signal: controller.signal });
      clearTimeout(timer);
      const body = (await response.json()) as {
        vendorLookup?: string;
        vendor?: PrivyTransactionRecord & { phase?: string; transactionId?: string };
        error_code?: string;
        message?: string;
      };
      if (response.status === 503) {
        setReport(JSON.stringify({ blocked: true, ...body, meaning: "E1 is not configured. This is not a failed vote." }, null, 2));
        return;
      }
      const vendor = body.vendor
        ? mapPrivyTransaction({
            transaction_id: body.vendor.transactionId || body.vendor.id || id,
            status: body.vendor.phase || body.vendor.status,
            transaction_hash: body.vendor.transactionHash || body.vendor.transaction_hash,
            user_operation_hash: body.vendor.userOperationHash || body.vendor.user_operation_hash,
          })
        : mapPrivyTransaction(body.vendor);
      if (participant && pollAddress && vendor) {
        const wallet = window.ethereum;
        let outerReceipt = null;
        let outerReceiptLookup: "ok" | "null" | "error" = "null";
        if (wallet && vendor.transactionHash && isTxHash(vendor.transactionHash)) {
          try {
            const provider = new BrowserProvider(wallet);
            const receipt = await provider.getTransactionReceipt(vendor.transactionHash);
            outerReceiptLookup = receipt ? "ok" : "null";
            outerReceipt = receipt
              ? {
                  status: receipt.status,
                  from: receipt.from,
                  to: receipt.to,
                  logs: receipt.logs.map((log) => ({ address: log.address, topics: [...log.topics], data: log.data })),
                }
              : null;
          } catch {
            outerReceiptLookup = "error";
          }
        }
        const verdict = checkSponsoredPublication({
          participant,
          pollAddress,
          lookup: {
            vendor,
            vendorLookup: body.vendorLookup === "timeout" ? "timeout" : response.ok ? "ok" : "error",
            outerReceipt,
            outerReceiptLookup,
            inner: outerReceipt ? innerFromPollLogs(outerReceipt, pollAddress, null) : null,
          },
        });
        setReport(JSON.stringify({ vendor, verdict }, null, 2));
      } else {
        setReport(JSON.stringify({ vendorLookup: body.vendorLookup, vendor, raw: body }, null, 2));
      }

      const store = createSponsoredStore();
      if (vendor && participant && MACI) {
        try {
          store.save(
            { chainId: CHAIN_ID, maciAddress: MACI, pollId: POLL_ID, account: participant },
            {
              transactionId: vendor.transactionId,
              submittedAt: Date.now(),
              userOperationHash: vendor.userOperationHash || undefined,
              transactionHash: vendor.transactionHash || undefined,
            },
          );
        } catch {
          /* persistence is best-effort for the lab notebook */
        }
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
        <p className="text-xs text-gray-500">
          Injected-wallet buttons below only prove the diagnostic contract. They are not a Privy adapter.
        </p>
        <div className="flex gap-3">
          <button type="button" className="border border-gray-600 px-3 py-2 rounded" onClick={() => void sendInjectedProbe(false)}>
            Injected probe()
          </button>
          <button type="button" className="border border-gray-600 px-3 py-2 rounded" onClick={() => void sendInjectedProbe(true)}>
            Injected alwaysRevert()
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
      </section>

      {error ? <pre className="text-red-300 whitespace-pre-wrap">{error}</pre> : null}
      {report ? <pre className="text-sm bg-black/50 border border-gray-800 rounded p-4 overflow-x-auto">{report}</pre> : null}
    </main>
  );
}
