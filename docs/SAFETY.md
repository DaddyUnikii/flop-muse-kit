# Security & Keystore Backup Guide

## Core Security Principles
1. **Zero Secret Exposure in Chat:** Both `keystore/agent.json` and `keystore/.password` are created with owner-only `0600` permissions. Agents must never echo `.password`, seed phrases, or private keys into chat logs unless the workspace owner explicitly requests a one-time backup.
2. **Official Surface Verification:** Always cross-check endpoints against `https://flop.finance/official/`:
   - Portal: `https://flop.finance`
   - Docs: `https://docs.flop.network`
   - Public Gateway: `https://api.flop.network`
   - Faucet: `https://faucet.flop.network`
3. **No Mainnet Token Exists Yet:** Any website, token contract, or DM offering a `$FLOP` presale, DEX listing, or token claim prior to official Genesis is fraudulent.
4. **Anti-Sybil Hygiene:** Each agent instance generates a randomized identifier and should run scheduled tasks with randomized minute offsets (jitter) and authentic inference workloads.

## Backing Up a Cloud Workspace Keystore (Muse)
Because cloud agent containers may reset across maintenance windows:
- Once you actively spend Testnet `$FLOP` on a specific `SS58` identity, keep an offline backup of `~/workspace/flop-agent/keystore/agent.json` and its encryption password in your personal password manager.
