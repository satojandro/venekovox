import { Interface, getAddress, isAddress, type JsonRpcSigner } from "ethers";

/**
 * Dry-run the join GATE (Poll.sol:388 policy.enforce) before asking the wallet
 * to sign. Public RPCs treat eth_call `from` as msg.sender, so we simulate
 * the Poll contract calling enforce(account, evidence).
 *
 * This is not a full joinPoll simulation (that still needs the joining ZK proof
 * and proving assets — G08). It is the eligibility bytes check Hermes asked for.
 *
 * SDK parameter: joinPoll({ sgDataArg }) → Poll.joinPoll(..., _signUpPolicyData).
 * MACI.signup({ sgData }) stays 0x until WP0 binds SelfEligibilityPolicy on MACI too.
 */

const maciAbi = new Interface([
  "function getPoll(uint256) view returns (address poll, address messageProcessor, address tally)",
]);
const pollAbi = new Interface([
  "function extContracts() view returns (address maci, address verifier, address verifyingKeysRegistry, address policy, address initialVoiceCreditProxy)",
]);
const policyAbi = new Interface(["function enforce(address subject, bytes evidence)"]);

export interface JoinDryRunInput {
  signer: Pick<JsonRpcSigner, "provider">;
  maciAddress: string;
  pollId: bigint;
  account: string;
  evidence: string;
  expectedPolicy?: string;
  expectedTarget?: string;
}

export interface JoinDryRunPass {
  ok: true;
  pollAddress: string;
  policyAddress: string;
}

export interface JoinDryRunFail {
  ok: false;
  reason: string;
}

export async function dryRunJoinGate(input: JoinDryRunInput): Promise<JoinDryRunPass> {
  const provider = input.signer.provider;
  if (!provider) throw new Error("Wallet has no provider for the join dry-run.");
  if (!input.evidence || input.evidence === "0x") {
    throw new Error("JOIN_DRY_RUN_FAILED: empty gate evidence");
  }

  const pollData = await provider.call({
    to: input.maciAddress,
    data: maciAbi.encodeFunctionData("getPoll", [input.pollId]),
  });
  const pollAddress = getAddress(maciAbi.decodeFunctionResult("getPoll", pollData)[0]);
  const ext = pollAbi.decodeFunctionResult(
    "extContracts",
    await provider.call({ to: pollAddress, data: pollAbi.encodeFunctionData("extContracts") }),
  );
  const policyAddress = getAddress(ext.policy ?? ext[3]);

  if (input.expectedTarget && isAddress(input.expectedTarget) && getAddress(input.expectedTarget) !== pollAddress) {
    throw new Error(`JOIN_DRY_RUN_FAILED: TARGET_ADDRESS ${input.expectedTarget} does not match poll ${pollAddress}`);
  }
  if (input.expectedPolicy && isAddress(input.expectedPolicy) && getAddress(input.expectedPolicy) !== policyAddress) {
    throw new Error(
      `JOIN_DRY_RUN_FAILED: POLICY_ADDRESS ${input.expectedPolicy} does not match poll policy ${policyAddress}`,
    );
  }

  try {
    await provider.call({
      from: pollAddress,
      to: policyAddress,
      data: policyAbi.encodeFunctionData("enforce", [input.account, input.evidence]),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`JOIN_DRY_RUN_FAILED: ${reason}`);
  }
  return { ok: true, pollAddress, policyAddress };
}
