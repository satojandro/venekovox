# `maci-contracts`

[![NPM Package][contracts-npm-badge]][contracts-npm-link]
[![Actions Status][contracts-actions-badge]][contracts-actions-link]

This submodule contains all the Ethereum contracts and tests for MACI.

For more information please refer to the [documentation for Contracts](https://maci.pse.dev/docs/category/smart-contracts).

[contracts-npm-badge]: https://img.shields.io/npm/v/maci-contracts.svg
[contracts-npm-link]: https://www.npmjs.com/package/maci-contracts
[contracts-actions-badge]: https://github.com/privacy-scaling-explorations/maci/actions/workflows/contracts-build.yml/badge.svg
[contracts-actions-link]: https://github.com/privacy-scaling-explorations/maci/actions?query=workflow%3Acontracts

## VenekoVox deployment guidance

Use the [project runbook](../../docs/runbook.md) and [current-state record](../../docs/current-state.md) to select and verify a deployment. Local generated deployment output is not an independently verified registry.

The [2025 deployment JSON](deployed/sepolia-deployment.json) is archival and contains malformed address strings. Do not copy it into live configuration. The previously repeated “latest deployment” address table has been removed to prevent accidental use.

The configured 2026 revival Poll-0 was reported to have zero start/end timestamps; verify the chosen poll and deploy explicit future windows for a new demo after eligibility policy decisions are settled.
