/* eslint-disable no-underscore-dangle */
import { BigInt as GraphBN, Bytes, ethereum } from "@graphprotocol/graph-ts";

import { Account, MACI, StateLeaf, User } from "../../generated/schema";

export const createOrLoadMACI = (event: ethereum.Event, stateTreeDepth: GraphBN = GraphBN.fromI32(10)): MACI => {
  let maci = MACI.load(event.address);

  if (!maci) {
    maci = new MACI(event.address);
    maci.stateTreeDepth = stateTreeDepth;
    maci.updatedAt = event.block.timestamp;
    maci.numPoll = GraphBN.zero();
    maci.totalSignups = GraphBN.zero();
    maci.latestPoll = Bytes.empty();
    maci.save();
  }

  return maci;
};

export const createOrLoadUser = (publicKeyX: GraphBN, publicKeyY: GraphBN, event: ethereum.Event): User => {
  const publicKey = `${publicKeyX.toString()} ${publicKeyY.toString()}`;
  let user = User.load(publicKey);

  if (!user) {
    user = new User(publicKey);
    user.createdAt = event.block.timestamp;
    user.save();
  }

  return user;
};

export const createOrLoadAccount = (
  stateIndex: GraphBN,
  event: ethereum.Event,
  owner: string,
  voiceCreditBalance: GraphBN = GraphBN.zero(),
): Account => {
  const id = stateIndex.toString();
  let account = Account.load(id);

  if (!account) {
    account = new Account(id);
    account.owner = owner;
    account.voiceCreditBalance = voiceCreditBalance;
    account.createdAt = event.block.timestamp;
    account.save();
  }

  return account;
};

export const createStateLeaf = (
  event: ethereum.Event,
  stateIndex: GraphBN,
  publicKeyX: GraphBN,
  publicKeyY: GraphBN,
  timestamp: GraphBN,
): StateLeaf => {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32());
  const leaf = new StateLeaf(id);
  leaf.stateIndex = stateIndex;
  leaf.publicKeyX = publicKeyX;
  leaf.publicKeyY = publicKeyY;
  leaf.timestamp = timestamp;
  leaf.maci = event.address;
  leaf.save();
  return leaf;
};
