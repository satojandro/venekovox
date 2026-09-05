# W1 evidence log

Fill a row only with observed evidence. Empty cells mean the gate has not passed. Do not treat dashboard screenshots or SDK sketches as a completed experiment.

**Vendor under test:** Privy (first). Dynamic is conditional on enterprise sponsorship access.  
**Pinned SDK:** _unverified_  
**App entitlement / TEE / Sepolia sponsorship:** _unverified_  
**Architecture approved:** no

| Gate | Result | Public evidence (tx / address / notes) | Date | Limitation |
| ---- | ------ | -------------------------------------- | ---- | ---------- |
| E1 Enable Sepolia sponsorship + TEE + pinned SDK | | | | |
| E2 Zero-ETH sponsored call to CallerProbe | | | | |
| E3 Inner revert vs outer success | | | | |
| E4 Refresh during submission | | | | |
| E5 signup + join + publish together | | | | |
| E6 Sponsorship denied, no paid fallback | | | | |

## Observed execution shape (E2)

Record these as separate facts. Do not collapse them into "the address was the same, so P1 applies."

| Field | Observed value |
| ----- | -------------- |
| Participating account | |
| Account code / 7702 prefix (`0xef0100` + implementation) | |
| Probe `msg.sender` (`lastCaller`) | |
| Probe `tx.origin` (`lastOrigin`) | |
| Probe `tx.gasprice` | |
| Outer receipt `from` (bundler / relayer / user) | |
| Outer receipt `to` (probe / account / EntryPoint) | |
| Vendor `transaction_id` | |
| Vendor `user_operation_hash` | |
| Outer `transaction_hash` | |
| Gas payer (if distinguishable) | |
