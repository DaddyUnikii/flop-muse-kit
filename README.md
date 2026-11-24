# FLOP Muse Kit

Lightweight, dependency-free Node.js toolkit to prepare a **FLOP Network** agent identity (`sr25519` + `Ed25519 did:key`), verify live Testnet readiness, claim daily Testnet faucet funds via direct HTTP (`fetch` / `curl`), and pace daily inference spending across randomized WIB waves — built specifically to work smoothly inside **Muse**, **VPS (Hermes)**, and **local PCs** without headless browsers.

- **Zero secrets in repo:** Every user/agent generates its own encrypted keystore & DID locally (`0600`).
- **No headless browser needed:** Uses standard Node.js `fetch` (or `curl`) instead of Chrome/Puppeteer.
- **Devnet & Unscored guard:** Verifies `https://testnet.flop.network/` genesis hash (`0x918abd...cfd800`) and `https://faucet.flop.network/chain` before claiming.
- **Anti-Sybil Pacing:** `24h + 1–10m` randomized faucet cooldown plus 3 daily WIB inference waves (`G1`/`G2`/`G3`) paced across each wave's duration.

---

## Autopilot Instructions for Muse / AI Agents (1-Paste Setup)

If the user pasted this repository URL to you (**Muse**, **Hermes**, or any coding agent), follow all 4 steps below automatically and report back in the user's language (e.g. Bahasa Indonesia):

### Step 1 — Clone & Generate Dual Agent Identity (`sr25519` + `did:key`)
```bash
git clone https://github.com/DaddyUnikii/flop-muse-kit.git ~/workspace/flop-muse-kit
node ~/workspace/flop-muse-kit/scripts/setup-identity.cjs
node ~/workspace/flop-muse-kit/scripts/setup-did.cjs
```
- Existing wallets/DIDs are **never overwritten**; re-running safely prints existing public info.
- Generates a randomized unique agent name (anti-sybil) and stores `agent.json`, `.password`, and `did.key.json` with mode `0600` in `~/workspace/flop-agent/keystore/`.
- **Security rule:** Never print `.password`, private keys, or seeds in chat. Report only the public `SS58` address (`5...`) and `did:key:z6Mk...`.

### Step 2 — Check Live Testnet & Faucet Status (HTTP Only)
Run the readiness probe (**do not** use Chrome/Puppeteer):
```bash
node ~/workspace/flop-muse-kit/scripts/watch-once.cjs
```
- **If `readyForTestnetClaim` is `false`** (e.g., `faucetNetwork === "devnet"` or Testnet is still `unscored` before the official Activation Block):
  - **Do not claim devnet** (devnet carries 0 airdrop weight).
  - Create a **Scheduled Watcher** every 4–6 hours (using a randomized minute offset) running `node ~/workspace/flop-muse-kit/scripts/watch-once.cjs`. Stay quiet while `false`; notify the user immediately when `readyForTestnetClaim` flips to `true`.
- **If `readyForTestnetClaim` is `true`** (or when Testnet Activation Block is live):
  - Check cooldown first: `node ~/workspace/flop-muse-kit/scripts/scheduler.cjs status`
  - If `eligibleToClaimNow === true`, claim via HTTP:
    ```bash
    node ~/workspace/flop-muse-kit/scripts/faucet.cjs --claim-if-testnet
    node ~/workspace/flop-muse-kit/scripts/scheduler.cjs record-claim
    ```

### Step 3 — Daily Paced Inference Schedule (WIB / UTC+7)
Running `record-claim` (or `plan-spend`) automatically sets:
1. **Next Faucet Claim:** `24 hours + random(1–10 minutes)` saved in `~/workspace/flop-agent/state.json`.
2. **3 Daily Inference Waves (`spendPlan`)** in `Asia/Jakarta` (WIB), paced across micro-steps until the end of each wave (never spend everything in a single burst):
   - **G1:** Start random `09:00–10:00 WIB`, duration random `40–80 min`, budget `30%` (paced across randomized steps).
   - **G2:** Start random `11:00–12:00 WIB`, duration random `50–100 min`, budget `40%` (paced across randomized steps).
   - **G3:** Start random `13:00–15:00 WIB`, duration random `45–85 min`, budget `30%` (paced across randomized steps).
- Spend Testnet `$FLOP` using varied, genuine prompts and confirm settled receipts (not pending quotes) from the agent's own wallet.

### Step 4 — Log Every Daily Action
Record claims, inference spend, settled sessions, and tx hashes:
```bash
node ~/workspace/flop-muse-kit/scripts/log-activity.cjs <network> <address> <claimed> <spent> <settled> "<tx_or_note>"
```

---

## Direct `curl` Reference (No Scripts Required)

```bash
# 1. Check active faucet chain & health
curl -sS https://faucet.flop.network/chain
curl -sS https://faucet.flop.network/health

# 2. Verify Testnet RPC genesis hash
curl -sS https://testnet.flop.network/ -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"chain_getBlockHash","params":[0]}'

# 3. Claim daily faucet grant once Testnet is live (replace <YOUR_SS58_ADDRESS>)
curl -sS -X POST https://faucet.flop.network/fund \
  -H "Content-Type: application/json" \
  -d '{"client":"faucet-web","address":"<YOUR_SS58_ADDRESS>"}'
```

> **Tip — Higher Daily Faucet Tier:** Anonymous quick-fund grants **25 FLOP/day**, while linking a verified human proof (EVM SIWE signature, BrightID, or Self) on `https://faucet.flop.network` unlocks **500–2,000 FLOP/day**. Always use a dedicated secondary EVM wallet rather than a primary vault wallet.

---

## Repository Structure

| Path | Description |
|---|---|
| `scripts/setup-identity.cjs` | Generates encrypted `sr25519` keystore via `@flop-labs/cli@0.7.0` (`--offline`) with unique agent naming |
| `scripts/setup-did.cjs` | Generates offline Ed25519 `did:key:z6Mk...` identity (`0600`) for Technocore chat |
| `scripts/inspect-identity.cjs` | Offline keystore verification helper that outputs the public `SS58` identity safely |
| `scripts/faucet.cjs` | Checks live chain/health status and claims Testnet faucet via HTTP `POST /fund` |
| `scripts/faucet-curl.sh` | Standalone pure-`curl` shell script for status checks and Testnet-only claims |
| `scripts/watch-once.cjs` | Verifies official Testnet RPC genesis hash alongside faucet `/chain` & `/health` |
| `scripts/scheduler.cjs` | Tracks `24h + 1–10m` faucet cooldown & builds paced WIB `G1–G3` spend steps |
| `scripts/log-activity.cjs` | Appends daily UTC/WIB activity rows to `flop-log.md` |
| `scripts/self-test.cjs` | Offline Node.js syntax & `fetch` runtime validator |
| `docs/INFERENCE.md` | How FLOP Testnet airdrop scoring works & CLI commands to spend `$FLOP` |
| `docs/SAFETY.md` | Keystore handling rules, cloud container backup advice, and official links |
| `docs/TROUBLESHOOTING.md` | Solutions for Muse Chromium proxy errors (`ERR_TUNNEL_CONNECTION_FAILED`) & devnet transitions |

---

## Official Links (Always Verify)
- Portal & Official Surface List: `https://flop.finance/official/`
- Airdrop Overview: `https://flop.finance/airdrop/`
- Operator & Agent Docs: `https://docs.flop.network`
- Faucet: `https://faucet.flop.network`
- Official X: `@flop_labs`

*Community open-source helper kit. No mainnet `$FLOP` token exists yet — ignore any third-party token claim, presale, or trading link not listed on `https://flop.finance/official/`.*
