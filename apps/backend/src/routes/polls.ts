import express, { Request, Response } from "express";
import { FetchRequest, Interface, JsonRpcProvider, getAddress, isAddress, ZeroAddress } from "ethers";

const router: import("express").Router = express.Router();

const maciAbi = new Interface([
  "function getPoll(uint256) view returns(address poll,address messageProcessor,address tally)",
]);
const pollAbi = new Interface(["function getStartAndEndDate() view returns(uint256,uint256)"]);

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
  if (!isAddress(maciAddress) || !/^(0|[1-9][0-9]{0,77})$/.test(pollId)) {
    return res.status(503).json({ error: "NOT_CONFIGURED" });
  }

  try {
    const request = new FetchRequest(publicRpcUrl());
    request.timeout = 15000;
    const provider = new JsonRpcProvider(request);
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
    if (pollAddress === ZeroAddress || (await provider.getCode(pollAddress, block.number)) === "0x") {
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
    return res.json({
      maciAddress: getAddress(maciAddress),
      pollId,
      pollAddress,
      startTime: start.toString(),
      endTime: end.toString(),
      status: votingWindow(start, end, BigInt(block.timestamp)),
      blockNumber: block.number,
      blockHash: block.hash,
    });
  } catch (error) {
    console.error("Configured poll lookup failed:", error instanceof Error ? error.message : "unknown");
    return res.status(502).json({ error: "LOOKUP_FAILED" });
  }
});

export default router;
