/* eslint-disable no-console */
import { task } from "hardhat/config";

/**
 * Deploy the W1 CallerProbe diagnostic contract.
 *
 * Alejandro controls funded accounts. This task never prints, logs or asks for a
 * private key — it uses whatever signer Hardhat is already configured with.
 */
task("deploy-caller-probe", "Deploy CallerProbe for the W1 sponsored-execution experiment").setAction(async (_, hre) => {
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost" && !process.env.PRIVATE_KEY) {
    throw new Error(
      "Public-network deploy requires PRIVATE_KEY in the local environment (never paste it into chat). Alejandro controls funded accounts.",
    );
  }

  const [signer] = await hre.ethers.getSigners();
  const factory = await hre.ethers.getContractFactory("CallerProbe", signer);
  const probe = await factory.deploy();
  await probe.waitForDeployment();
  const tx = probe.deploymentTransaction();
  const network = await hre.ethers.provider.getNetwork();

  console.log(
    JSON.stringify(
      {
        contract: "CallerProbe",
        address: await probe.getAddress(),
        deployer: await signer.getAddress(),
        txHash: tx?.hash ?? null,
        network: hre.network.name,
        chainId: Number(network.chainId),
      },
      null,
      2,
    ),
  );
});
