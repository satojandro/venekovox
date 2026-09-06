# VenekoVox contributor instructions

Start with [agent continuity](docs/agents.md), then the [as-built journey map](docs/journey-map.md), [current status](docs/status.md) and [roadmap and decisions](docs/roadmap.md). These replace the old 2025 task list and agent-specific persona instructions.

- Build the verified-human polling journey first. Read the relevant [integration specification](docs/build.md) before changing identity, wallet, tally or schema boundaries.
- Inspect the actual branch/worktree and preserve others' work. Do not assume a recorded baseline is latest main.
- Distinguish implemented, locally tested, reported and live-verified behavior. Mock data and cached receipts are not on-chain truth.
- Use Self Enterprise for new identity work (D02, user-approved 2026-09-05). Self Pass is legacy; do not extend its QR/verifier path or follow superseded Pass-only instructions; ENS is naming, not personhood. MACI voting keys are independent from wallet keys. Contract caller identity must work for the chosen smart-account model.
- Keep keys, document payloads and credentials out of chat, commits, logs and frontend configuration. Alejandro controls funded accounts; prepare commands without handling private keys.
- Use the repository Node/pnpm toolchain and meaningful tests. Record commands, results and remaining limitations.
- Update canonical status/decision docs in the same change. Leave the interruption record specified in the handoff guide.
- Attribute upstream and pre-event work honestly. Follow official prize requirements verified at submission time.
