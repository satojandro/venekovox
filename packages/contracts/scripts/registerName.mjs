/**
 * Register venekovoxv1.eth on ENSv2 Sepolia.
 *
 * Run from packages/contracts:
 *   node scripts/registerName.mjs
 *
 * Requires: PRIVATE_KEY and SEPOLIA_RPC_URL in .env
 */
import "dotenv/config";
import {
  JsonRpcProvider,
  Wallet,
  Interface,
  FetchRequest,
  keccak256,
  toUtf8Bytes,
  ZeroAddress,
  ZeroHash,
} from "ethers";

const ETH_REGISTRAR = "0xa88553f454b77203b0d036a05c894d555eaaa2cc";
const MOCK_USDC = "0x768f42455a2d082e23ceef7d51e5787c82d67a39";
const LABEL = "venekovoxv1";
const DURATION = 86400n * 365n; // 1 year

const registrarAbi = new Interface([
  "function isAvailable(string label) view returns(bool)",
  "function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns(bytes32)",
  "function commit(bytes32 commitment)",
  "function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns(uint256)",
  "function commitmentAt(bytes32) view returns(uint64)",
  "function MIN_COMMITMENT_AGE() view returns(uint64)",
]);

const erc20Abi = new Interface([
  "function balanceOf(address) view returns(uint256)",
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns(bool)",
]);

async function main() {
  const rpc = process.env.SEPOLIA_RPC_URL;
  const pk = process.env.PRIVATE_KEY;
  if (!rpc || !pk) {
    console.error("Need SEPOLIA_RPC_URL and PRIVATE_KEY in .env");
    process.exit(1);
  }

  const request = new FetchRequest(rpc);
  request.timeout = 15000;
  const provider = new JsonRpcProvider(request);
  const wallet = new Wallet(pk, provider);
  const addr = await wallet.getAddress();
  console.log(`Registering from: ${addr}`);

  // Check availability
  const availData = registrarAbi.encodeFunctionData("isAvailable", [LABEL]);
  const availResult = await provider.call({ to: ETH_REGISTRAR, data: availData });
  const available = registrarAbi.decodeFunctionResult("isAvailable", availResult)[0];
  if (!available) {
    console.error(`${LABEL}.eth is not available`);
    process.exit(1);
  }
  console.log(`${LABEL}.eth is available ✅`);

  // Mint MockUSDC if needed
  const balData = erc20Abi.encodeFunctionData("balanceOf", [addr]);
  const balResult = await provider.call({ to: MOCK_USDC, data: balData });
  let balance = erc20Abi.decodeFunctionResult("balanceOf", balResult)[0];
  console.log(`MockUSDC balance: ${balance}`);

  if (balance < 10000000n) {
    console.log("Minting MockUSDC...");
    const mintData = erc20Abi.encodeFunctionData("mint", [addr, 100000000n]);
    const mintTx = await wallet.sendTransaction({ to: MOCK_USDC, data: mintData });
    await mintTx.wait();
    console.log("  ✅ Minted 100 MockUSDC");

    const balResult2 = await provider.call({ to: MOCK_USDC, data: balData });
    balance = erc20Abi.decodeFunctionResult("balanceOf", balResult2)[0];
    console.log(`  New balance: ${balance}`);
  }

  // Approve registrar to spend MockUSDC
  console.log("Approving MockUSDC spend...");
  const approveData = erc20Abi.encodeFunctionData("approve", [ETH_REGISTRAR, 100000000n]);
  const approveTx = await wallet.sendTransaction({ to: MOCK_USDC, data: approveData });
  await approveTx.wait();
  console.log("  ✅ Approved");

  // Compute commitment
  const secret = keccak256(toUtf8Bytes("venekovoxv1-secret-" + Date.now()));
  const commitmentData = registrarAbi.encodeFunctionData("makeCommitment", [
    LABEL,
    addr,
    secret,
    ZeroAddress,
    ZeroAddress,
    DURATION,
    ZeroHash,
  ]);
  const commitmentResult = await provider.call({ to: ETH_REGISTRAR, data: commitmentData });
  const commitment = registrarAbi.decodeFunctionResult("makeCommitment", commitmentResult)[0];
  console.log(`Commitment: ${commitment}`);

  // Submit commitment
  console.log("Submitting commitment...");
  const commitData = registrarAbi.encodeFunctionData("commit", [commitment]);
  const commitTx = await wallet.sendTransaction({ to: ETH_REGISTRAR, data: commitData });
  const commitReceipt = await commitTx.wait();
  console.log(`  ✅ Committed (tx: ${commitTx.hash})`);

  // Wait for MIN_COMMITMENT_AGE
  const minAgeData = registrarAbi.encodeFunctionData("MIN_COMMITMENT_AGE");
  const minAgeResult = await provider.call({ to: ETH_REGISTRAR, data: minAgeData });
  const minAge = Number(registrarAbi.decodeFunctionResult("MIN_COMMITMENT_AGE", minAgeResult)[0]);
  console.log(`Waiting ${minAge}s for commitment to mature...`);
  await new Promise((r) => setTimeout(r, (minAge + 5) * 1000));

  // Register
  console.log("Registering...");
  const registerData = registrarAbi.encodeFunctionData("register", [
    LABEL,
    addr,
    secret,
    ZeroAddress,
    ZeroAddress,
    DURATION,
    MOCK_USDC,
    ZeroHash,
  ]);
  const registerTx = await wallet.sendTransaction({ to: ETH_REGISTRAR, data: registerData });
  const registerReceipt = await registerTx.wait();
  console.log(`  ✅ Registered! (tx: ${registerTx.hash})`);
  console.log(`\n🎉 ${LABEL}.eth is now owned by ${addr}`);
  console.log(`\nYou can now use this name as the parent for VenekoVoxNames.`);

  provider.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
