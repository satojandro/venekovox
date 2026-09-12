import express, { Request, Response } from "express";
import { FetchRequest, Interface, JsonRpcProvider, getAddress, isAddress, ZeroAddress } from "ethers";

const router: import("express").Router = express.Router();

const maciAbi = new Interface([
  "function getPoll(uint256) view returns(address poll,address messageProcessor,address tally)",
]);
const pollAbi = new Interface([
  "function getStartAndEndDate() view returns(uint256,uint256)",
  "function voteOptions() view returns(uint256)",
]);
const tallyAbi = new Interface(["function mode() view returns(uint8)"]);

function votingWindow(start: bigint, end: bigint, now: bigint): "OPEN" | "UPCOMING" | "CLOSED" | "INVALID_WINDOW" {
  if (start <= 0n || end <= start) return "INVALID_WINDOW";
  if (now < start) return "UPCOMING";
  return now > end ? "CLOSED" : "OPEN";
}

function publicRpcUrl(): string {
  return (process.env.PUBLIC_RPC_URL || process.env.VITE_PUBLIC_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com").trim();
}

/** Public schedule for the configured poll. No identity, keys, or results. */
router.get("/configured", async (_req: Request, res: Response) => {
  const maciAddress = (
    process.env.MACI_ADDRESS ||
    process.env.VITE_MACI_ADDRESS ||
    "0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a"
  ).trim();
  const pollId = (process.env.POLL_ID || process.env.VITE_POLL_ID || "0").trim();
  const chainId = (process.env.CHAIN_ID || process.env.VITE_CHAIN_ID || "11155111").trim();
  if (
    !isAddress(maciAddress) ||
    !/^(0|[1-9][0-9]{0,77})$/.test(pollId) ||
    !/^(0|[1-9][0-9]{0,77})$/.test(chainId)
  ) {
    return res.status(503).json({ error: "NOT_CONFIGURED" });
  }

  let provider: JsonRpcProvider | undefined;
  try {
    const request = new FetchRequest(publicRpcUrl());
    request.timeout = 15000;
    provider = new JsonRpcProvider(request);
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(chainId)) {
      return res.status(502).json({ error: "POLL_MISMATCH" });
    }
    const block = await provider.getBlock("latest");
    if (!block?.hash) return res.status(502).json({ error: "LOOKUP_FAILED" });
    const contracts = maciAbi.decodeFunctionResult(
      "getPoll",
      await provider.call({
        to: maciAddress,
        data: maciAbi.encodeFunctionData("getPoll", [pollId]),
        blockTag: block.number,
      }),
    );
    const pollAddress = getAddress(contracts[0]);
    const tallyAddress = getAddress(contracts[2]);
    if (pollAddress === ZeroAddress || (await provider.getCode(pollAddress, block.number)) === "0x") {
      return res.status(502).json({ error: "POLL_MISMATCH" });
    }
    if (tallyAddress === ZeroAddress || (await provider.getCode(tallyAddress, block.number)) === "0x") {
      return res.status(502).json({ error: "POLL_MISMATCH" });
    }
    const [start, end] = pollAbi.decodeFunctionResult(
      "getStartAndEndDate",
      await provider.call({
        to: pollAddress,
        data: pollAbi.encodeFunctionData("getStartAndEndDate"),
        blockTag: block.number,
      }),
    );
    const voteOptions = pollAbi.decodeFunctionResult(
      "voteOptions",
      await provider.call({
        to: pollAddress,
        data: pollAbi.encodeFunctionData("voteOptions"),
        blockTag: block.number,
      }),
    )[0];
    const mode = tallyAbi.decodeFunctionResult(
      "mode",
      await provider.call({
        to: tallyAddress,
        data: tallyAbi.encodeFunctionData("mode"),
        blockTag: block.number,
      }),
    )[0];
    return res.json({
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
    });
  } catch (error) {
    console.error("Configured poll lookup failed:", error instanceof Error ? error.message : "unknown");
    return res.status(502).json({ error: "LOOKUP_FAILED" });
  } finally {
    provider?.destroy();
  }
});

export default router;
