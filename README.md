# FLOP Muse Kit

Lightweight, dependency-free Node.js toolkit to prepare a **FLOP Network** agent identity (`sr25519`), verify live Testnet readiness, and claim daily Testnet faucet funds via direct HTTP (`fetch` / `curl`) — built specifically to work smoothly inside **Muse** and cloud container environments where headless browsers fail due to proxy restrictions.

- **Zero secrets in repo:** Every user/agent generates its own encrypted keystore locally.
- **No headless browser needed:** Uses standard Node.js `fetch` (or `curl`) instead of Chrome/Puppeteer.
- **Devnet vs. Testnet guard:** Automatically checks `https://faucet.flop.network/chain` so you do not mistake `devnet` test runs (0 airdrop weight) for live `testnet` activity.

---

## Quickstart for Muse / AI Agents

If the user shared this repository link with you in **Muse** (or another personal AI agent workspace), execute the workflow below automatically and report the result clearly in the user's language (e.g. Bahasa Indonesia):

### Step 1 — Clone & Generate Encrypted Agent Identity
1. Clone this repository (or copy `scripts/`) and prepare a persistent workspace directory at `~/workspace/flop-agent`:
   ```bash
   git clone https://github.com/DaddyUnikii/flop-muse-kit.git ~/workspace/flop-muse-kit
   node ~/workspace/flop-muse-kit/scripts/setup-identity.cjs
   node ~/workspace/flop-muse-kit/scripts/setup-did.cjs
   ```
   - If `~/workspace/flop-agent/keystore/agent.json` already exists, the script safely skips generation and prints the existing public `SS58` address so you never overwrite an existing wallet.
   - By default, it generates a unique randomized agent name (e.g. `muse-lynx-742`) and stores the encrypted keystore (`agent.json`, mode `600`) plus local password (`.password`, mode `600`) inside `~/workspace/flop-agent/keystore/`.
   - **Security rule:** Never print or log the contents of `.password` in chat. Report only the **public `SS58` address** and agent name.

### Step 2 — Check Live Network Status & Claim Faucet (HTTP Only)
Run the status & faucet helper (uses native HTTP `fetch`, **do not** use Chrome/Puppeteer):
```bash
node ~/workspace/flop-muse-kit/scripts/faucet.cjs --claim-if-testnet
```

- **Case A — Faucet is still `devnet` or Testnet is `unscored` (before Activation Block):**
  - Do **not** spam devnet faucet claims (devnet carries no airdrop weight).
  - Create a **Scheduled Task / Periodic Watcher** (every 4–6 hours, choosing a randomized minute offset for jitter) that runs `node ~/workspace/flop-muse-kit/scripts/watch-once.cjs` and checks:
    1. `https://faucet.flop.network/chain` & `https://faucet.flop.network/health`
    2. `https://docs.flop.network/docs/network-testnet` & `https://flop.finance/official/`
  - Stay quiet while status remains `devnet` / `planned`. As soon as `network` switches to `"testnet"` and funding is `ready: true`, run `node ~/workspace/flop-muse-kit/scripts/faucet.cjs --claim-if-testnet` (or the `curl` command below) and notify the user immediately.

- **Case B — Network is `"testnet"` and `ready: true`:**
  - The script automatically submits the daily faucet claim via `POST https://faucet.flop.network/fund` and prints the result.
  - Set up a daily reminder/schedule (every ~24h + random jitter minutes) to claim Testnet `$FLOP` and spend it on verified Testnet inference sessions (see `docs/INFERENCE.md`), since **airdrop weight comes from settled Testnet inference spend**, not idle faucet balances.

---

## Direct `curl` Reference (No Scripts Required)

If you prefer raw `curl` inside a terminal or container:

```bash
# 1. Check active faucet chain (devnet vs testnet) & health
curl -sS https://faucet.flop.network/chain
curl -sS https://faucet.flop.network/health

# 2. Claim daily faucet grant (replace <YOUR_SS58_ADDRESS>)
curl -sS -X POST https://faucet.flop.network/fund \
  -H "Content-Type: application/json" \
  -d '{"client":"faucet-web","address":"<YOUR_SS58_ADDRESS>"}'
```

> **Tip — Higher Daily Faucet Tier:** On the official faucet web UI (`https://faucet.flop.network`), anonymous quick-fund grants **25 FLOP/day**, while linking a verified human proof (EVM SIWE signature, BrightID, or Self) unlocks a much larger daily tier (**500–2,000 FLOP/day**) for deeper inference sessions. Always use a dedicated secondary EVM wallet rather than a primary vault wallet.

---

## Repository Structure

| Path | Description |
|---|---|
| `scripts/setup-identity.cjs` | Generates encrypted `sr25519` keystore via official `@flop-labs/cli@0.7.0` with unique agent naming & overwrite protection |
| `scripts/setup-did.cjs` | Generates offline Ed25519 `did:key:z6Mk...` identity (mode `600`) for Technocore chat |
| `scripts/log-activity.cjs` | Appends daily UTC/WIB activity rows to `flop-log.md` |
| `scripts/inspect-identity.cjs` | Offline keystore verification helper that outputs the public `SS58` identity safely |
| `scripts/faucet.cjs` | Checks live chain/health status and claims Testnet faucet via standard HTTP `POST /fund` |
| `scripts/faucet-curl.sh` | Standalone pure-`curl` shell script for status checks and Testnet faucet claims |
| `scripts/watch-once.cjs` | Single-pass JSON readiness probe with jitter helper for Muse Scheduled Tasks / cron |
| `docs/INFERENCE.md` | How FLOP Testnet airdrop scoring works & CLI commands to spend `$FLOP` on settled inference |
| `docs/SAFETY.md` | Keystore handling rules, cloud container backup advice, and official surface verification |
| `docs/TROUBLESHOOTING.md` | Solutions for Muse Chromium proxy errors (`ERR_TUNNEL_CONNECTION_FAILED`) & devnet transitions |

---

## Official Links (Always Verify)
- Portal & Official Surface List: `https://flop.finance/official/`
- Airdrop Overview: `https://flop.finance/airdrop/`
- Operator & Agent Docs: `https://docs.flop.network`
- Faucet: `https://faucet.flop.network`
- Official X: `@flop_labs`

*Community open-source helper kit. No mainnet `$FLOP` token exists yet — ignore any third-party token claim, presale, or trading link not listed on `https://flop.finance/official/`.*
