/* eslint-disable import/no-extraneous-dependencies */
import "@nomicfoundation/hardhat-toolbox";

import type { HardhatUserConfig } from "hardhat/config";

const FORK_RPC = process.env.SEPOLIA_RPC_URL || "https://1rpc.io/sepolia";
const FORK_BLOCK = process.env.ENS_FORK_BLOCK ? Number(process.env.ENS_FORK_BLOCK) : 11_684_876;
const USE_FORK = process.env.ENS_FORK === "1";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  defaultNetwork: "hardhat",
  paths: {
    sources: "./contracts/ens",
    tests: "./test-ens",
    artifacts: "./artifacts-ens",
    cache: "./cache-ens",
  },
  typechain: {
    outDir: "typechain-ens",
  },
  gasReporter: {
    enabled: false,
  },
  networks: {
    hardhat: {
      chainId: 11_155_111,
      ...(USE_FORK
        ? {
            forking: {
              url: FORK_RPC,
              blockNumber: FORK_BLOCK,
            },
          }
        : {}),
    },
  },
};

export default config;
