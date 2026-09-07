import { BigInt, dataSource, ethereum } from "@graphprotocol/graph-ts";

import { GovernanceFramework, Proposal, Poll } from "../generated/schema";

/** Governance read model; do not create public Vote/Delegate records from ciphertext. */
export function createProposal(poll: Poll, event: ethereum.Event): void {
  const frameworkId = poll.maci.toHexString();
  let framework = GovernanceFramework.load(frameworkId);
  if (framework == null) {
    framework = new GovernanceFramework(frameworkId);
    framework.name = "MACI";
    framework.type = "MACI";
    framework.contractAddress = frameworkId;
    framework.network = dataSource.network();
    framework.schemaVersion = "venekovox-governance-2.0.0";
    framework.save();
  }
  const proposal = new Proposal(poll.id.toHexString());
  proposal.governanceFramework = frameworkId;
  proposal.poll = poll.id;
  proposal.txnHash = event.transaction.hash.toHexString();
  proposal.creationBlock = event.block.number;
  proposal.creationTime = event.block.timestamp;
  proposal.creationLogIndex = event.logIndex;
  proposal.startTime = poll.startDate;
  proposal.endTime = poll.endDate;
  proposal.ballotPrivacy = "ENCRYPTED";
  proposal.coordinatorTrust = "COORDINATOR_CAN_DECRYPT";
  proposal.tallyStatus = "UNAVAILABLE";
  proposal.registrationCount = BigInt.zero();
  proposal.publishedMessageCount = BigInt.zero();
  proposal.offchainBatchCount = BigInt.zero();
  proposal.voteOptionCapacity = poll.voteOptions;
  proposal.votingMode = poll.mode;
  proposal.tallyAddress = poll.tally;
  proposal.updatedAt = event.block.timestamp;
  proposal.save();
}

export function recordPublication(event: ethereum.Event): void {
  const proposal = Proposal.load(event.address.toHexString());
  if (proposal == null) {
    return;
  }
  // Poll's constructor publishes a placeholder before MACI emits DeployPoll.
  // A later publish in that same transaction is still a real publication event.
  // `==` is deliberate: this is AssemblyScript, where String `==` is the overloaded
  // VALUE comparison and `===` is reference identity. Rewriting to `===` compiles but
  // silently never matches. Verified by compiling both forms to WASM and executing them.
  // eslint-disable-next-line eqeqeq
  if (proposal.txnHash == event.transaction.hash.toHexString() && event.logIndex.lt(proposal.creationLogIndex)) {
    return;
  }
  proposal.publishedMessageCount = proposal.publishedMessageCount.plus(BigInt.fromI32(1));
  proposal.updatedAt = event.block.timestamp;
  proposal.save();
}

export function recordRegistration(poll: Poll, event: ethereum.Event): void {
  const proposal = Proposal.load(poll.id.toHexString());
  if (proposal == null) {
    return;
  }
  proposal.registrationCount = poll.registrationCount;
  proposal.updatedAt = event.block.timestamp;
  proposal.save();
}

export function recordOffchainBatch(event: ethereum.Event): void {
  const proposal = Proposal.load(event.address.toHexString());
  if (proposal == null) {
    return;
  }
  proposal.offchainBatchCount = proposal.offchainBatchCount.plus(BigInt.fromI32(1));
  proposal.updatedAt = event.block.timestamp;
  proposal.save();
}
