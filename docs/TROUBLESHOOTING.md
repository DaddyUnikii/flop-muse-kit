# Troubleshooting Common Muse & Testnet Issues

## 1. `ERR_TUNNEL_CONNECTION_FAILED` in Chrome / Puppeteer
**Cause:** Cloud agent sandboxes (such as Muse) route outbound traffic through an HTTP proxy where headless Chromium tunnel requests often fail, even though standard HTTPS requests succeed.
**Fix:** Do **not** use Puppeteer or headless Chrome. Use `node scripts/faucet.cjs` (Node native `fetch`) or `bash scripts/faucet-curl.sh` (`curl`).

## 2. `FAUCET_UNAVAILABLE` or `wss://rpc.devnet.flop.network` Timeout
**Cause:** Legacy kits hardcoded `devnet` endpoints, or the devnet faucet health is `degraded` (`ready: false`) during Testnet transition. Furthermore, devnet activity carries **0 airdrop weight**.
**Fix:** Run `node scripts/watch-once.cjs` on a periodic schedule (every 4–6 hours) and wait until `network === "testnet"` and `faucetReady === true`.

## 3. Password Environment Variable Not Passed to CLI
**Cause:** Early community scripts passed `{ env: { ... } }` nested inside a wrapper already wrapping `env`, causing `FLOP_KEY_PASSWORD` to be undefined on first run.
**Fix:** Fixed in `scripts/setup-identity.cjs` — `FLOP_KEY_PASSWORD` is passed directly in the child process environment alongside `--offline` so key generation works reliably without external release-check timeouts.
