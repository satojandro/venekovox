/**
 * WP0 dry-run: prove the deployed SelfEligibilityPolicy (0x530B…5Ea) accepts a
 * correctly-formed issuer grant on Sepolia WITHOUT a real passport.
 *
 * Method: sign a synthetic Authorization with the issuer key (throwaway deployer,
 * 0xE132…ec6D = on-chain issuer), ABI-encode it exactly like the product backend's
 * encodeAuthorization(), then eth_call enforce(subject, evidence) FROM the poll
 * address (anvil impersonation — msg.sender == guarded) on a local fork of
 * Sepolia. enforce() is state-changing, so a raw eth_call on live RPC would roll
 * back the "consumed" writes and lie about replay; the fork gives real first-call
 * semantics. Negative cases verified: replay of a consumed identityTag, and a
 * second wallet presenting wallet A's grant (architect gate H, minus the passport).
 *
 * Run: PATH="$HOME/.foundry/bin:$PATH" node scripts/wp0-enforce-dryrun.mjs
 * Requires: anvil (foundry). Read-only w.r.t. mainnet Sepolia.
 */
import { execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { ethers } from "ethers";

const POLL = "0x517D42601F3c75DACD2166Af7FC9B8979b0bb709";
const POLICY = "0x530BDc1fBf343b838D6C5738Caa35bD3985d55Ea";
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const issuerWallet = new ethers.Wallet(readFileSync(".deployer-key", "utf8").trim());
const voterA = ethers.Wallet.createRandom();
const voterB = ethers.Wallet.createRandom();
console.log("issuer (deployer):", issuerWallet.address);
console.log("voter A (positive):", voterA.address);
console.log("voter B (negative):", voterB.address);

const coder = ethers.AbiCoder.defaultAbiCoder();
const AUTH_TUPLE =
  "tuple(address account,address target,bytes32 identityTag,bytes32 configId,bytes32 action,bytes32 nonce,uint64 issuedAt,uint64 expiresAt)";
const { keccak256, toUtf8Bytes } = ethers;

const domain = { name: "VenekoVox Self Eligibility", version: "1", chainId: 11155111n, verifyingContract: POLICY };
const types = {
  Authorization: [
    { name: "account", type: "address" },
    { name: "target", type: "address" },
    { name: "identityTag", type: "bytes32" },
    { name: "configId", type: "bytes32" },
    { name: "action", type: "bytes32" },
    { name: "nonce", type: "bytes32" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
  ],
};

async function evidenceFor(account, issuedAt, tagSeed) {
  const auth = {
    account,
    target: POLL,
    identityTag: keccak256(toUtf8Bytes("dryrun:" + tagSeed)), // synthetic — real one comes from TAG_SECRET HMAC
    configId: keccak256(toUtf8Bytes("venekovox-stage1-salted-v1")),
    action: keccak256(toUtf8Bytes("signup")),
    nonce: keccak256(toUtf8Bytes("dryrun-nonce:" + tagSeed)),
    issuedAt,
    expiresAt: issuedAt + 600, // < MAX_LIFETIME (15 min)
  };
  const signature = await issuerWallet.signTypedData(domain, types, auth);
  return coder.encode([AUTH_TUPLE, "bytes"], [auth, signature]);
}

// --- fork Sepolia locally ---
const anvil = spawn("anvil", ["--fork-url", RPC, "--port", "8545"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 4000));

try {
  const pk = new ethers.JsonRpcProvider("http://localhost:8545");

  // sanity: fork is at Sepolia state and policy is bound
  const net = await pk.getNetwork();
  if (net.chainId !== 11155111n) throw new Error("fork chainId mismatch: " + net.chainId);
  if ((await pk.getCode(POLICY)) === "0x") throw new Error("policy has no code on fork");

  // Anchor grants to the FORK's block clock, not the local wall clock: anvil
  // replays historical timestamps, so Date.now() can be AHEAD of fork
  // block.timestamp → issuedAt > block.timestamp → InvalidLifetime. The product
  // backend is immune (its `now` is the live chain clock via the real RPC).
  const forkNow = (await pk.getBlock("latest")).timestamp;

  // Impersonation makes enforce() a STATE-CHANGING call (it writes usedTags /
  // usedAccounts) — eth_call would roll those writes back and lie about replay.
  // eth_sendRawTransaction can't be used (the POLL contract has no key), so use
  // anvil_snapshot + revert for each probe instead: snapshot before the positive
  // call, send via eth_sendTransaction (impersonated), then revert the snapshot
  // after every probe so each one starts from identical pristine state.
  execSync(`cast rpc anvil_impersonateAccount ${POLL} --rpc-url http://localhost:8545`, { stdio: "ignore" });

  const iface = new ethers.Interface(["function enforce(address subject, bytes evidence)"]);
  const policy = new ethers.Contract(POLICY, iface, pk);

  const snapId = await pk.send("anvil_snapshot", []);
  const revertSnap = () => pk.send("anvil_revert", [snapId]);

  async function tryEnforce(subject, evidence, label, expectRevert = false, revertAfter = true) {
    const data = iface.encodeFunctionData("enforce", [subject, evidence]);
    let ok;
    try {
      await pk.send("anvil_setBalance", [POLL, "0x8AC7230489E80000"]); // 10 ETH gas
      const tx = await pk.send("eth_sendTransaction", [{ from: POLL, to: POLICY, data, gas: "0x1D4C0" }]);
      // anvil may not auto-mine under a fork with interval settings — force it
      await pk.send("evm_mine", []);
      const receipt = await pk.waitForTransaction(tx, 1, 15000);
      ok = receipt.status === 1;
    } catch (e) {
      // anvil_revert on an already-consumed snapshot id throws — that's our own
      // cleanup, not a probe result. Distinguish: only real probe failures set ok=false
      // before this point; here a thrown revert-of-probe means the tx itself reverted
      // and was caught by waitForTransaction... actually waitForTransaction returns
      // status=0 rather than throwing for reverts, so reaching catch means an RPC
      // error — treat as probe failure only if it's not the snapshot cleanup.
      if (String(e).includes("snapshot")) throw e;
      ok = false;
    }
    const pass = ok === !expectRevert;
    console.log(`${pass ? "✓" : "✗"} ${label}: ${ok ? "SUCCEEDED" : "reverted"}${pass ? "" : "  ← UNEXPECTED"}`);
    if (revertAfter) await revertSnap();
    return ok;
  }

  // POSITIVE: valid grant for voter A, called by the poll itself.
  // NO snapshot revert after this one — the replay probe needs its consumed state.
  const evA = await evidenceFor(voterA.address, forkNow, "A");
  const okA = await tryEnforce(voterA.address, evA, "positive (voter A, valid grant)", false, false);

  // REPLAY: same identityTag as the positive probe → AlreadyEnforced.
  // Probe order matters: positive (state persists) → replay (revert) → negative (revert).
  const okReplay = await tryEnforce(voterA.address, evA, "replay of consumed tag", true);

  // NEGATIVE H: second wallet reuses voter A's grant → account != subject
  const okB = await tryEnforce(voterB.address, evA, "second wallet w/ A's grant", true, true);

  console.log("---");
  console.log(
    okA ? "WP0 DRY-RUN PASS: on-chain policy accepts product-format grants" : "WP0 DRY-RUN FAIL: valid grant rejected",
  );
  console.log(!okReplay ? "replay protection verified" : "REPLAY NOT BLOCKED — investigate");
  console.log(!okB ? "second-wallet reject verified (gate H, minus passport)" : "SECOND WALLET ACCEPTED — investigate");

  process.exitCode = okA && !okReplay && !okB ? 0 : 1;
} finally {
  anvil.kill();
}
