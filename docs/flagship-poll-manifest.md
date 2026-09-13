# Flagship poll manifest — pending Hermes deployment

Status: **not deployed**. Frontend metadata is ready under
`VITE_POLL_PRESET=superintelligence-v1`. Do not invent a poll ID. Do not relabel
Poll 0 or Poll 1 on MACI `0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a`.

## Question

Do you support a global ban on developing artificial superintelligence?

Neutral explanation is in the operator descriptor. This is a broad policy question,
not endorsement of a particular bill. A permanent ban is not a temporary pause.

## Frozen option indices

| Index | Label   |
| ----- | ------- |
| 0     | Support |
| 1     | Oppose  |
| 2     | Unsure  |

Expected on-chain: `voteOptions == 3`, MACI mode `2` (FULL / 1p1v). The UI fails
closed if a configured deployment does not match.

## Two distinct rounds

| Round     | Env                    | Purpose                                      | Results                         |
| --------- | ---------------------- | -------------------------------------------- | ------------------------------- |
| `open`    | `VITE_POLL_ROUND=open` | Judge participation while judging            | Do not show rehearsal totals    |
| `rehearsal` | `VITE_POLL_ROUND=rehearsal` | Closed poll for tally practice            | Never display as the open round |

Poll 1 (France, closes 16 September 2026) is **not** the tally target. Coordinator
key for that poll is recorded as lost in the S4.1 brief.

## Eligibility (Hermes, non-secret)

- Age ≥ 18, salted uniqueness, FaceMatch strict. No mock proofs for judges.
- Fresh `ZKP_CONFIG_ID` binding this poll’s semantics (do not reuse
  `venekovox-stage1-salted-v1`).
- Nationality allowlist is ZKPassport `CountryName` strings. Installed SDK 0.16.2
  uses **Czech Republic**, not Czechia. United Kingdom is not included.

```
ZKP_NATIONALITY_ALLOWLIST=United States,Canada,Australia,Austria,Belgium,Bulgaria,Croatia,Cyprus,Czech Republic,Denmark,Estonia,Finland,France,Germany,Greece,Hungary,Ireland,Italy,Latvia,Lithuania,Luxembourg,Malta,Netherlands,Poland,Portugal,Romania,Slovakia,Slovenia,Spain,Sweden
```

Exactly 30 nationalities. A listed nationality does not promise every document or
device is supported.

## Binding env (fill after read-back)

```
VITE_POLL_PRESET=superintelligence-v1
VITE_CHAIN_ID=
VITE_MACI_ADDRESS=
VITE_POLL_ID=
VITE_POLL_ADDRESS=
VITE_POLL_ROUND=open
```

Leave these empty until Hermes supplies chain/MACI/poll/policy/tally addresses,
dates, mode, and read-back evidence. The UI shows unconfigured or schedule
unavailable until then.

## France continuity poll

Original MACI poll 1 keeps France metadata when `VITE_POLL_PRESET` is unset.
See [continuity-french-poll-manifest.md](continuity-french-poll-manifest.md).
