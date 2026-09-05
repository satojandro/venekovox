import { expect } from "chai";
import hre from "hardhat";

/**
 * Local analogue of W1 E2/E3: prove that "the account the contract saw" is not
 * the same question as "who sent the outer transaction".
 *
 * These tests do not talk to Privy. They lock the diagnostic contract's behavior
 * so a later Sepolia experiment has a known baseline.
 */
describe("CallerProbe (W1 diagnostic)", () => {
  it("a direct call records the EOA as both msg.sender and tx.origin", async () => {
    const [caller] = await hre.ethers.getSigners();
    const probe = await hre.ethers.deployContract("CallerProbe");
    await probe.waitForDeployment();

    const tx = await probe.probe();
    const receipt = await tx.wait();

    expect(receipt?.status).to.eq(1);
    expect(receipt?.from.toLowerCase()).to.eq((await caller.getAddress()).toLowerCase());
    expect(receipt?.to?.toLowerCase()).to.eq((await probe.getAddress()).toLowerCase());
    expect(await probe.lastCaller()).to.eq(await caller.getAddress());
    expect(await probe.lastOrigin()).to.eq(await caller.getAddress());
    expect(await probe.lastGasPrice()).to.be.gt(0n);
  });

  it("a forwarded call records the wrapper as msg.sender and the EOA as tx.origin", async () => {
    const [caller] = await hre.ethers.getSigners();
    const probe = await hre.ethers.deployContract("CallerProbe");
    const forwarder = await hre.ethers.deployContract("ProbeForwarder");
    await probe.waitForDeployment();
    await forwarder.waitForDeployment();

    const tx = await forwarder.forwardProbe(await probe.getAddress());
    const receipt = await tx.wait();

    expect(receipt?.status).to.eq(1);
    // Outer transaction: EOA → forwarder, not EOA → probe.
    expect(receipt?.from.toLowerCase()).to.eq((await caller.getAddress()).toLowerCase());
    expect(receipt?.to?.toLowerCase()).to.eq((await forwarder.getAddress()).toLowerCase());
    // Inner identity: the probe saw the wrapper, not the EOA.
    expect(await probe.lastCaller()).to.eq(await forwarder.getAddress());
    expect(await probe.lastOrigin()).to.eq(await caller.getAddress());
  });

  it("an uncaught alwaysRevert fails the outer transaction", async () => {
    const probe = await hre.ethers.deployContract("CallerProbe");
    await probe.waitForDeployment();

    await expect(probe.alwaysRevert()).to.be.revertedWith("W1_PROBE_REVERT");
  });

  it("a caught inner revert can still mine a successful outer transaction", async () => {
    const probe = await hre.ethers.deployContract("CallerProbe");
    const forwarder = await hre.ethers.deployContract("ProbeForwarder");
    await probe.waitForDeployment();
    await forwarder.waitForDeployment();

    const tx = await forwarder.forwardRevertCatching(await probe.getAddress());
    const receipt = await tx.wait();

    expect(receipt?.status).to.eq(1);
    const failed = receipt?.logs.some((log) => {
      try {
        return forwarder.interface.parseLog({ topics: [...log.topics], data: log.data })?.name === "InnerCallFailed";
      } catch {
        return false;
      }
    });
    expect(failed).to.eq(true);
  });
});
