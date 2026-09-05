// CallerProbe ABI (apps/w1 is packages/contracts/contracts/diagnostics/CallerProbe.sol).
// Kept here so the experiment UI / scripts can decode E2 evidence without typechain.

export const CALLER_PROBE_ABI = [
  "event Probed(address indexed caller, address indexed origin, uint256 gasPrice, bytes data)",
  "function probe() payable returns (address caller, address origin, uint256 gasPrice)",
  "function alwaysRevert()",
  "function lastCaller() view returns (address)",
  "function lastOrigin() view returns (address)",
  "function lastGasPrice() view returns (uint256)",
  "function lastData() view returns (bytes)",
] as const;

export interface ProbeObservation {
  caller: string;
  origin: string;
  gasPrice: bigint;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/i;

function readIndexedAddress(topic: string | undefined): string | null {
  if (!topic || !/^0x[0-9a-fA-F]{64}$/.test(topic)) return null;
  const addr = "0x" + topic.slice(26);
  return ADDRESS_RE.test(addr) ? addr : null;
}

function readUint256Word(data: string, wordIndex: number): bigint | null {
  const hex = data.startsWith("0x") || data.startsWith("0X") ? data.slice(2) : data;
  const start = wordIndex * 64;
  const word = hex.slice(start, start + 64);
  if (word.length !== 64 || !/^[0-9a-fA-F]+$/.test(word)) return null;
  return BigInt("0x" + word);
}

/**
 * Decode a Probed event without ethers. Topic[0] is the event signature;
 * topic[1] = caller, topic[2] = origin; data word 0 = gasPrice.
 */
export function decodeProbedLog(log: {
  topics?: readonly string[] | null;
  data?: string | null;
}): ProbeObservation | null {
  const caller = readIndexedAddress(log.topics?.[1]);
  const origin = readIndexedAddress(log.topics?.[2]);
  const gasPrice = log.data ? readUint256Word(log.data, 0) : null;
  if (!caller || !origin || gasPrice === null) return null;
  return { caller, origin, gasPrice };
}

export interface DiagnosticSummary {
  outerFrom: string | null;
  outerTo: string | null;
  outerStatus: number | null;
  /** Contract msg.sender from the Probed event, if present. */
  echoedCaller: string | null;
  echoedOrigin: string | null;
  echoedGasPrice: string | null;
  /** True when the outer sender is not the contract caller — typical of relayed/sponsored execution. */
  outerSenderDiffersFromCaller: boolean;
}

/**
 * E2/E3 evidence: compare the outer receipt with what CallerProbe actually saw.
 * This does not confirm a MACI vote.
 */
export function summarizeProbeReceipt(args: {
  receipt: {
    status?: number | null;
    from?: string | null;
    to?: string | null;
    logs?: readonly { address?: string | null; topics?: readonly string[] | null; data?: string | null }[] | null;
  };
  probeAddress: string;
}): DiagnosticSummary {
  const probe = args.probeAddress.toLowerCase();
  let echoed: ProbeObservation | null = null;
  for (const log of args.receipt.logs ?? []) {
    if (!log.address || log.address.toLowerCase() !== probe) continue;
    echoed = decodeProbedLog(log);
    if (echoed) break;
  }
  const outerFrom = args.receipt.from ?? null;
  return {
    outerFrom,
    outerTo: args.receipt.to ?? null,
    outerStatus: args.receipt.status ?? null,
    echoedCaller: echoed?.caller ?? null,
    echoedOrigin: echoed?.origin ?? null,
    echoedGasPrice: echoed ? echoed.gasPrice.toString() : null,
    outerSenderDiffersFromCaller: !!(
      outerFrom &&
      echoed?.caller &&
      outerFrom.toLowerCase() !== echoed.caller.toLowerCase()
    ),
  };
}

