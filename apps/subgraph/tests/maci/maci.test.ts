/* eslint-disable no-underscore-dangle, @typescript-eslint/no-unnecessary-type-assertion */
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { test, describe, afterEach, clearStore, assert, beforeAll } from "matchstick-as";

import { Account, MACI, Poll, StateLeaf, User } from "../../generated/schema";
import { handleSignUp, handleDeployPoll } from "../../src/maci";
import { DEFAULT_POLL_ADDRESS, mockMaciContract, mockPollContract } from "../common";

import { createSignUpEvent, createDeployPollEvent } from "./utils";

export { handleSignUp, handleDeployPoll };

describe("MACI", () => {
  beforeAll(() => {
    mockMaciContract();
    mockPollContract();
  });

  afterEach(() => {
    clearStore();
  });

  test("should handle signup properly", () => {
    const event = createSignUpEvent(BigInt.fromI32(1), BigInt.fromI32(1), BigInt.fromI32(1), BigInt.fromI32(1));

    handleSignUp(event);

    const userId = `${event.params._userPublicKeyX.toString()} ${event.params._userPublicKeyY.toString()}`;
    const maciAddress = event.address;
    const user = User.load(userId)!;
    const account = Account.load(event.params._stateIndex.toString())!;
    const maci = MACI.load(maciAddress)!;
    const poll = Poll.load(maci.latestPoll);

    assert.fieldEquals("User", user.id, "id", userId);
    assert.fieldEquals("Account", account.id, "id", event.params._stateIndex.toString());
    assert.fieldEquals("MACI", maciAddress.toHexString(), "numPoll", "0");
    assert.fieldEquals("MACI", maciAddress.toHexString(), "totalSignups", "1");
    assert.fieldEquals("MACI", maciAddress.toHexString(), "latestPoll", "0x00000000");
    assert.assertTrue(maci.polls.load().length === 0);
    assert.assertNull(poll);
    assert.entityCount("StateLeaf", 1);
    const leafId = event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString();
    assert.fieldEquals("StateLeaf", leafId, "stateIndex", "1");
    assert.fieldEquals("StateLeaf", leafId, "publicKeyX", "1");
    assert.fieldEquals("StateLeaf", leafId, "publicKeyY", "1");
    assert.fieldEquals("StateLeaf", leafId, "timestamp", "1");
    const leaf = StateLeaf.load(event.transaction.hash.concatI32(event.logIndex.toI32()))!;
    assert.assertTrue(leaf.maci.equals(maciAddress));
  });

  test("should handle deploy poll properly (qv)", () => {
    const event = createDeployPollEvent(BigInt.fromI32(1), BigInt.fromI32(1), BigInt.fromI32(1), BigInt.fromI32(0));

    handleDeployPoll(event);

    const maciAddress = event.address;
    const maci = MACI.load(maciAddress)!;
    const poll = Poll.load(maci.latestPoll)!;

    assert.fieldEquals("Poll", poll.id.toHex(), "id", DEFAULT_POLL_ADDRESS.toHexString());
    assert.fieldEquals("MACI", maciAddress.toHexString(), "numPoll", "1");
    assert.fieldEquals("MACI", maciAddress.toHexString(), "totalSignups", "0");
    assert.fieldEquals("MACI", maciAddress.toHexString(), "latestPoll", poll.id.toHex());
    assert.fieldEquals("Poll", poll.id.toHexString(), "mode", "0");
    assert.assertTrue(maci.polls.load().length === 1);
  });

  test("should handle deploy poll properly (non-qv)", () => {
    const event = createDeployPollEvent(BigInt.fromI32(1), BigInt.fromI32(1), BigInt.fromI32(1), BigInt.fromI32(1));

    handleDeployPoll(event);

    const maciAddress = event.address;
    const maci = MACI.load(maciAddress)!;
    const poll = Poll.load(maci.latestPoll)!;

    assert.fieldEquals("Poll", poll.id.toHex(), "id", DEFAULT_POLL_ADDRESS.toHexString());
    assert.fieldEquals("MACI", maciAddress.toHexString(), "numPoll", "1");
    assert.fieldEquals("MACI", maciAddress.toHexString(), "totalSignups", "0");
    assert.fieldEquals("MACI", maciAddress.toHexString(), "latestPoll", poll.id.toHex());
    assert.fieldEquals("Poll", poll.id.toHexString(), "mode", "1");
    assert.assertTrue(maci.polls.load().length === 1);
  });

  test("should handle signup with deployed poll properly", () => {
    const deployPollEvent = createDeployPollEvent(
      BigInt.fromI32(1),
      BigInt.fromI32(1),
      BigInt.fromI32(1),
      BigInt.fromI32(0),
    );

    const signUpEvent = createSignUpEvent(BigInt.fromI32(1), BigInt.fromI32(1), BigInt.fromI32(1), BigInt.fromI32(1));

    handleDeployPoll(deployPollEvent);
    handleSignUp(signUpEvent);

    const userId = `${signUpEvent.params._userPublicKeyX.toString()} ${signUpEvent.params._userPublicKeyY.toString()}`;
    const maciAddress = deployPollEvent.address;
    const user = User.load(userId)!;
    const account = Account.load(signUpEvent.params._stateIndex.toString())!;
    const maci = MACI.load(maciAddress)!;
    const poll = Poll.load(maci.latestPoll)!;

    assert.fieldEquals("User", user.id, "id", userId);
    assert.fieldEquals("Account", account.id, "id", signUpEvent.params._stateIndex.toString());
    assert.fieldEquals("MACI", maciAddress.toHexString(), "numPoll", "1");
    assert.fieldEquals("MACI", maciAddress.toHexString(), "totalSignups", "1");
    assert.fieldEquals("MACI", maciAddress.toHexString(), "latestPoll", poll.id.toHex());
    assert.assertTrue(maci.polls.load().length === 1);
    assert.assertNotNull(poll);
    assert.entityCount("StateLeaf", 1);
  });

  test("two SignUp events write two StateLeaves from the four-param ABI", () => {
    const first = createSignUpEvent(BigInt.fromI32(1), BigInt.fromI32(100), BigInt.fromI32(11), BigInt.fromI32(12));
    const second = createSignUpEvent(BigInt.fromI32(2), BigInt.fromI32(200), BigInt.fromI32(21), BigInt.fromI32(22));
    first.logIndex = BigInt.fromI32(0);
    second.logIndex = BigInt.fromI32(1);
    second.transaction.hash = Bytes.fromHexString("0x2222222222222222222222222222222222222222222222222222222222222222");

    handleSignUp(first);
    handleSignUp(second);

    assert.entityCount("StateLeaf", 2);
    const firstId = first.transaction.hash.concatI32(first.logIndex.toI32()).toHexString();
    const secondId = second.transaction.hash.concatI32(second.logIndex.toI32()).toHexString();
    assert.fieldEquals("StateLeaf", firstId, "stateIndex", "1");
    assert.fieldEquals("StateLeaf", firstId, "publicKeyX", "11");
    assert.fieldEquals("StateLeaf", firstId, "publicKeyY", "12");
    assert.fieldEquals("StateLeaf", firstId, "timestamp", "100");
    assert.fieldEquals("StateLeaf", secondId, "stateIndex", "2");
    assert.fieldEquals("StateLeaf", secondId, "publicKeyX", "21");
    assert.fieldEquals("StateLeaf", secondId, "publicKeyY", "22");
    assert.fieldEquals("StateLeaf", secondId, "timestamp", "200");
    assert.fieldEquals("MACI", first.address.toHexString(), "totalSignups", "2");
  });
});
