import { Interface, ensNormalize, dnsEncode, namehash, getAddress, ZeroAddress } from "ethers";
import type { Provider } from "ethers";

export const ENS_CHAIN_ID = 11155111n;
// ENS official deployments, checked 2026-09-06: this Sepolia proxy routes through ENSv2.
export const UNIVERSAL_RESOLVER = "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe";
export const POLL_RECORD_KEY = "xyz.venekovox.poll";
export const universalAbi = new Interface([
  "function resolve(bytes name,bytes data) view returns(bytes result,address resolver)",
]);
export const textAbi = new Interface(["function text(bytes32 node,string key) view returns(string)"]);
export const maciAbi = new Interface([
  "function getPoll(uint256) view returns(address poll,address messageProcessor,address tally)",
]);
export const pollAbi = new Interface(["function getStartAndEndDate() view returns(uint256,uint256)", "function voteOptions() view returns(uint256)"]);
export const tallyAbi = new Interface(["function mode() view returns(uint8)"]);
export type LookupCode =
  | "INVALID_NAME"
  | "MISSING_RECORD"
  | "INVALID_RECORD"
  | "UNSUPPORTED_CHAIN"
  | "UNTRUSTED_MACI"
  | "POLL_MISMATCH"
  | "LOOKUP_FAILED"
  | "NOT_CONFIGURED";
export class PollNameError extends Error {
  constructor(public readonly code: LookupCode) {
    super(code);
  }
}
export interface PollReference {
  version: 1;
  chainId: string;
  maci: string;
  pollId: string;
  poll: string;
}
export interface NamedPoll {
  name: string;
  reference: PollReference;
  resolver: string;
  blockNumber: number;
  blockHash: string;
  startTime: string;
  endTime: string;
  status: "OPEN" | "UPCOMING" | "CLOSED" | "INVALID_WINDOW";
}
export function normalizePollName(input: string): string {
  try {
    const name = ensNormalize(input.trim());
    if (!name.endsWith(".eth") || name.length > 255) throw new Error();
    dnsEncode(name);
    return name;
  } catch {
    throw new PollNameError("INVALID_NAME");
  }
}
export function parsePollRecord(raw: string): PollReference {
  if (!raw) throw new PollNameError("MISSING_RECORD");
  try {
    if (raw.length > 2048) throw new Error();
    const value = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      value.version !== 1 ||
      Object.keys(value).sort().join(",") !== "chainId,maci,poll,pollId,version"
    )
      throw new Error();
    for (const key of ["chainId", "pollId"]) {
      if (
        typeof value[key] !== "string" ||
        !/^(0|[1-9][0-9]{0,77})$/.test(value[key]) ||
        BigInt(value[key]) >= 1n << 256n
      )
        throw new Error();
    }
    const maci = getAddress(value.maci),
      poll = getAddress(value.poll);
    if (maci === ZeroAddress || poll === ZeroAddress) throw new Error();
    return { version: 1, chainId: value.chainId, maci, pollId: value.pollId, poll };
  } catch {
    throw new PollNameError("INVALID_RECORD");
  }
}
export function votingWindow(start: bigint, end: bigint, now: bigint): NamedPoll["status"] {
  if (start <= 0n || end <= start) return "INVALID_WINDOW";
  if (now < start) return "UPCOMING";
  // Poll.isOpenForVoting rejects timestamps > endDate.
  return now > end ? "CLOSED" : "OPEN";
}
export type ReadProvider = Pick<Provider, "getNetwork" | "getBlock" | "getCode" | "call">;
export async function resolvePollName(
  input: string,
  provider: ReadProvider,
  allowedMaci: readonly string[],
): Promise<NamedPoll> {
  const name = normalizePollName(input);
  let allowed: string[];
  try {
    allowed = allowedMaci.map(getAddress);
    if (!allowed.length || allowed.includes(ZeroAddress)) throw new Error();
  } catch {
    throw new PollNameError("NOT_CONFIGURED");
  }
  try {
    if ((await provider.getNetwork()).chainId !== ENS_CHAIN_ID) throw new PollNameError("UNSUPPORTED_CHAIN");
    const block = await provider.getBlock("latest");
    if (!block?.hash) throw new PollNameError("LOOKUP_FAILED");
    const call = (to: string, data: string, ccip = false) =>
      provider.call({ to, data, blockTag: block.number, enableCcipRead: ccip });
    const request = textAbi.encodeFunctionData("text", [namehash(name), POLL_RECORD_KEY]);
    const result = await call(
      UNIVERSAL_RESOLVER,
      universalAbi.encodeFunctionData("resolve", [dnsEncode(name), request]),
      true,
    );
    const [encoded, resolver] = universalAbi.decodeFunctionResult("resolve", result);
    if (getAddress(resolver) === ZeroAddress) throw new PollNameError("MISSING_RECORD");
    const reference = parsePollRecord(textAbi.decodeFunctionResult("text", encoded)[0]);
    if (BigInt(reference.chainId) !== ENS_CHAIN_ID) throw new PollNameError("UNSUPPORTED_CHAIN");
    if (!allowed.includes(reference.maci)) throw new PollNameError("UNTRUSTED_MACI");
    const contracts = maciAbi.decodeFunctionResult(
      "getPoll",
      await call(reference.maci, maciAbi.encodeFunctionData("getPoll", [reference.pollId])),
    );
    if (getAddress(contracts[0]) !== reference.poll || (await provider.getCode(reference.poll, block.number)) === "0x")
      throw new PollNameError("POLL_MISMATCH");
    const [start, end] = pollAbi.decodeFunctionResult(
      "getStartAndEndDate",
      await call(reference.poll, pollAbi.encodeFunctionData("getStartAndEndDate")),
    );
    // Detect a reorg of the snapshot while resolving, rather than presenting a mixed result.
    if ((await provider.getBlock(block.number))?.hash !== block.hash) throw new PollNameError("LOOKUP_FAILED");
    return {
      name,
      reference,
      resolver: getAddress(resolver),
      blockNumber: block.number,
      blockHash: block.hash,
      startTime: start.toString(),
      endTime: end.toString(),
      status: votingWindow(start, end, BigInt(block.timestamp)),
    };
  } catch (error) {
    if (error instanceof PollNameError) throw error;
    throw new PollNameError("LOOKUP_FAILED");
  }
}
