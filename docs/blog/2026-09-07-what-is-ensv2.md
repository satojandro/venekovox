# What is ENSv2, and how VenekoVox uses it to make voting feel human

_September 2026 — VenekoVox S1 build note_

Poll addresses look like this:

```
0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
```

Nobody can remember that. Nobody can say it out loud. Nobody can put it on a
flyer. If we want people to actually find and trust a poll, it needs a name —
`climate-action-2026.openpoll.eth` — that a human can read, share and verify.

This post explains why we built that on **ENSv2** rather than ENS, what's
actually different, and the specific trick that lets us promise a name can't be
taken away or sold.

---

## 1. ENS and ENSv2 are not "old version / new version" of the same thing

This was the thing that confused me most at the start, so it's worth being blunt:

|                | **ENS (v1)**                       | **ENSv2**                                       |
| -------------- | ---------------------------------- | ----------------------------------------------- |
| Where it lives | Ethereum **mainnet**               | **Sepolia** testnet (Beta)                      |
| Registry       | One flat contract for every name   | A **tree** — each name can own its own registry |
| Resolver       | Mostly one shared `PublicResolver` | **Per-account** resolvers                       |
| Names are      | ERC-721 NFTs                       | ERC-1155 in per-name collections                |
| Permissions    | Owner can do everything            | **32 granular roles**                           |
| Cost           | Real money                         | Free testnet ETH                                |

They are **different contracts on different chains**. A name you own on mainnet
does not exist on ENSv2, and a lookup that succeeds on one tells you nothing
about the other.

We found this the hard way. `nick.eth` is the example the ENS docs use
everywhere. On Sepolia Beta:

```
eth → 0xBDC85dD5…      ✓
nick → UNLINKED        ✗  (hierarchy broken)
```

It doesn't resolve. Sepolia Beta gets reset periodically by the ENS team, so
this is normal — but it means every "does this work?" check has to be live,
on-chain, right now. Documentation examples are not evidence.

## 2. The part that actually matters: permissions, not names

The naming is nice. The reason we're on v2 is underneath it.

In **ENSv1**, owning a name meant you could do anything with it — change its
resolver, hand it to someone, create subnames, delete it. One boolean: owner or
not.

In **ENSv2**, permissions are split into **32 separate roles**. Each is a bit in
a bitmap:

| Role                      | Lets you…                  |
| ------------------------- | -------------------------- |
| `ROLE_REGISTRAR`          | Create new subnames        |
| `ROLE_RENEW`              | Extend expiry              |
| `ROLE_SET_RESOLVER`       | Point a name at a resolver |
| `ROLE_SET_SUBREGISTRY`    | Attach a child registry    |
| `ROLE_UNREGISTER`         | Delete a name              |
| `ROLE_CAN_TRANSFER_ADMIN` | Transfer a name            |

You can hand out **one** of these without handing out the rest. That's the whole
game.

## 3. How VenekoVox uses it: `alice.venekovox.eth`

We registered two parent names on Sepolia:

```
venekovox.eth   →  alice.venekovox.eth        (people)
openpoll.eth    →  climate-2026.openpoll.eth  (polls)
```

Two separate trees rather than one, so each has its own expiry and its own admin.

### When you claim a name

You land on `/names`, connect a wallet, type `alice`, and sign **one**
transaction. Our contract `VenekoVoxNames.claimProfile("alice")` mints the name
_and_ sets its address record in the same transaction — so there's never a window
where a name exists but points nowhere.

Then the important bit: **the page doesn't trust the receipt.** It waits for the
transaction, then independently requires:

1. the matching `ProfileClaimed` event from our registrar, **and**
2. a fresh forward resolution through the Universal Resolver

Only then does it show you the name. If your account or network changed mid-flight,
it refuses to report success — even if the transaction itself succeeded.

### Why your name can't be sold or taken

Here's the trick, and it's the reason this post exists.

**Your name's non-transferability is not a rule in our code. It's an absence.**

When `VenekoVoxNames` registers your name, it calls:

```solidity
registry.register(label, msg.sender, address(0), address(this), 0, expiry);
//                                                              ↑
//                                              roleBitmap = ZERO
```

A role bitmap of **zero** means you receive _no roles at all_. So there is no
code path — anywhere, for anyone, including us — by which you could transfer,
rename, re-point or delegate that name.

Not "we check and block it." It doesn't exist to be done.

That matters for what VenekoVox is for. We build polling for people who can't
speak freely — state repression on one side, cancellation and peer pressure on
the other. A name in that system has to be a stable identity, not a tradeable
asset. Someone shouldn't be able to buy your reputation, and an administrator
shouldn't be able to quietly reassign it.

We apply the same rule to ourselves. Our registrar is granted exactly:

```
65537 = ROLE_REGISTRAR (1<<0) | ROLE_RENEW (1<<16)
```

Create names. Extend them. Nothing else. No `ROLE_UNREGISTER` (can't delete),
no `ROLE_CAN_TRANSFER_ADMIN` (can't move), no `ROLE_SET_RESOLVER` on anyone
else's name.

### When an admin publishes a poll

Polls work differently — only the operator can create them, and they have to be
real:

1. A MACI poll is deployed and has an ID.
2. Operator calls `namePoll("climate-2026", 42)`.
3. The contract enforces `msg.sender == operator`, reads the poll address from
   MACI, and **requires it has actual deployed code**. You can't name a poll that
   doesn't exist.
4. The name gets a `xyz.venekovox.poll` text record holding the chain ID, MACI
   address, poll ID and poll address.
5. Anyone can open `/p/climate-2026.openpoll.eth`, and the client verifies that
   reference against the real MACI deployment _before_ showing anything.

So a shared link is self-verifying. The name doesn't just look trustworthy —
it carries the proof with it.

## 4. What this gets us

- **Names people can say.** `alice.venekovox.eth`, not 42 hex characters.
- **Uncoercible identity.** Names can't be bought, sold, or quietly reassigned —
  by construction, not by policy.
- **Self-verifying links.** A poll link proves what it points at before it renders.
- **One transaction, no trust.** Atomic claim + record, verified by event _and_
  live resolution.

## 5. What we're being careful about

Honesty about limits, because this is a testnet Beta and a hackathon:

- **Sepolia Beta resets periodically.** These names can vanish. This is not
  production identity.
- **Parent administrators retain ENSv2 powers.** Ancestor expiry, registry
  upgrades and root roles remain outside our control. We require an **explicit
  absolute expiry** at deployment rather than pretending names are permanent.
- **No recovery yet.** Lose the wallet and the name is gone. There's no migration
  path in this build.
- **Gas isn't sponsored yet.** Users currently pay their own Sepolia gas. The
  Privy adapter is a drop-in and the contract is ready, but sponsorship covering
  naming is still to come.
- **Named voting isn't live.** An ENS-resolved poll opens checked discovery, not
  a working ballot — that needs poll metadata binding first.

D04 — our goal of genuinely permanent, non-transferable names — is **not** marked
achieved. The candidate forces an explicit expiry and keeps the ancestor trust
model. We'd rather say that than advertise something we can't deliver.

---

_Built at ETHGlobal Online 2026. Live on Sepolia ENSv2 Beta at block 11656196.
Setup and role decisions are recorded in
[ens-deployment-handoff.md](../ens-deployment-handoff.md)._
