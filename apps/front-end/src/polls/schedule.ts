import { getAddress, isAddress, ZeroAddress } from "ethers";
import { maciAbi, pollAbi, tallyAbi, votingWindow, type NamedPoll } from "../ens/pollName";

export type PollSchedule = {
  chainId: string;
  maciAddress: string;
  pollId: string;
  pollAddress: string;
  tallyAddress: string;
  startTime: string;
  endTime: string;
  voteOptions: string;
  mode: string;
  status: NamedPoll["status"];
  blockNumber: number;
  blockHash: string;
};

export type ScheduleProvider = {
  getNetwork: () => Promise<{ chainId: bigint }>;
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
  chainId: string,
): Promise<PollSchedule> {
  if (!isAddress(maciAddress) || getAddress(maciAddress) === ZeroAddress) {
    throw new ScheduleError("NOT_CONFIGURED");
  }
  if (!/^(0|[1-9][0-9]{0,77})$/.test(pollId) || !/^(0|[1-9][0-9]{0,77})$/.test(chainId)) {
    throw new ScheduleError("NOT_CONFIGURED");
  }

  try {
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(chainId)) throw new ScheduleError("POLL_MISMATCH");
    const block = await provider.getBlock("latest");
    if (!block?.hash) throw new ScheduleError("LOOKUP_FAILED");
    const call = (to: string, data: string) => provider.call({ to, data, blockTag: block.number });
    const contracts = maciAbi.decodeFunctionResult(
      "getPoll",
      await call(maciAddress, maciAbi.encodeFunctionData("getPoll", [pollId])),
    );
    const pollAddress = getAddress(contracts[0]);
    const tallyAddress = getAddress(contracts[2]);
    if (pollAddress === ZeroAddress || (await provider.getCode(pollAddress, block.number)) === "0x") {
      throw new ScheduleError("POLL_MISMATCH");
    }
    if (tallyAddress === ZeroAddress || (await provider.getCode(tallyAddress, block.number)) === "0x") {
      throw new ScheduleError("POLL_MISMATCH");
    }
    const [start, end] = pollAbi.decodeFunctionResult(
      "getStartAndEndDate",
      await call(pollAddress, pollAbi.encodeFunctionData("getStartAndEndDate")),
    );
    const voteOptions = pollAbi.decodeFunctionResult(
      "voteOptions",
      await call(pollAddress, pollAbi.encodeFunctionData("voteOptions")),
    )[0];
    const mode = tallyAbi.decodeFunctionResult("mode", await call(tallyAddress, tallyAbi.encodeFunctionData("mode")))[0];
    if ((await provider.getBlock(block.number))?.hash !== block.hash) {
      throw new ScheduleError("LOOKUP_FAILED");
    }
    return {
      chainId: network.chainId.toString(),
      maciAddress: getAddress(maciAddress),
      pollId,
      pollAddress,
      tallyAddress,
      startTime: start.toString(),
      endTime: end.toString(),
      voteOptions: voteOptions.toString(),
      mode: mode.toString(),
      status: votingWindow(start, end, BigInt(block.timestamp)),
      blockNumber: block.number,
      blockHash: block.hash,
    };
  } catch (error) {
    if (error instanceof ScheduleError) throw error;
    throw new ScheduleError("LOOKUP_FAILED");
  }
}
