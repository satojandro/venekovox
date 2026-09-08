import { getAddress, isAddress, ZeroAddress } from "ethers";
import { maciAbi, pollAbi, votingWindow, type NamedPoll } from "../ens/pollName";

export type PollSchedule = {
  pollAddress: string;
  startTime: string;
  endTime: string;
  status: NamedPoll["status"];
  blockNumber: number;
  blockHash: string;
};

export type ScheduleProvider = {
  getBlock: (tag: string | number) => Promise<{ number: number; hash: string | null; timestamp: number } | null>;
  getCode: (address: string, blockTag?: number) => Promise<string>;
  call: (tx: { to: string; data: string; blockTag?: number }) => Promise<string>;
};

export class ScheduleError extends Error {
  constructor(public readonly code: "NOT_CONFIGURED" | "LOOKUP_FAILED" | "POLL_MISMATCH") {
    super(code);
  }
}

export async function readPollSchedule(
  provider: ScheduleProvider,
  maciAddress: string,
  pollId: string,
): Promise<PollSchedule> {
  if (!isAddress(maciAddress) || getAddress(maciAddress) === ZeroAddress) {
    throw new ScheduleError("NOT_CONFIGURED");
  }
  if (!/^(0|[1-9][0-9]{0,77})$/.test(pollId)) throw new ScheduleError("NOT_CONFIGURED");

  try {
    const block = await provider.getBlock("latest");
    if (!block?.hash) throw new ScheduleError("LOOKUP_FAILED");
    const call = (to: string, data: string) => provider.call({ to, data, blockTag: block.number });
    const contracts = maciAbi.decodeFunctionResult(
      "getPoll",
      await call(maciAddress, maciAbi.encodeFunctionData("getPoll", [pollId])),
    );
    const pollAddress = getAddress(contracts[0]);
    if (pollAddress === ZeroAddress || (await provider.getCode(pollAddress, block.number)) === "0x") {
      throw new ScheduleError("POLL_MISMATCH");
    }
    const [start, end] = pollAbi.decodeFunctionResult(
      "getStartAndEndDate",
      await call(pollAddress, pollAbi.encodeFunctionData("getStartAndEndDate")),
    );
    if ((await provider.getBlock(block.number))?.hash !== block.hash) {
      throw new ScheduleError("LOOKUP_FAILED");
    }
    return {
      pollAddress,
      startTime: start.toString(),
      endTime: end.toString(),
      status: votingWindow(start, end, BigInt(block.timestamp)),
      blockNumber: block.number,
      blockHash: block.hash,
    };
  } catch (error) {
    if (error instanceof ScheduleError) throw error;
    throw new ScheduleError("LOOKUP_FAILED");
  }
}
