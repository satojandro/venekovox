import { createRequire } from "module";
const require = createRequire(process.env.ENS_TOOLCHAIN_PACKAGE_JSON || import.meta.url);
const solc = require("solc");
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const source = readFileSync("contracts/ens/VenekoVoxNames.sol", "utf8");
const output = JSON.parse(
  solc.compile(
    JSON.stringify({
      language: "Solidity",
      sources: { "VenekoVoxNames.sol": { content: source } },
      settings: {
        evmVersion: "shanghai",
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      },
    }),
  ),
);

const errors = (output.errors ?? []).filter((e) => e.severity === "error");
if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}

const artifact = output.contracts["VenekoVoxNames.sol"]["VenekoVoxNames"];
mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/VenekoVoxNames.json",
  JSON.stringify({ abi: artifact.abi, bytecode: artifact.evm.bytecode.object }, null, 2),
);
console.log("ABI functions:", artifact.abi.filter((x) => x.type === "function").length);
console.log("Bytecode length:", artifact.evm.bytecode.object.length);
console.log("Saved to artifacts/VenekoVoxNames.json");
