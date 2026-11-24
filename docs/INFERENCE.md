# Spending Testnet `$FLOP` on Verified Inference

## Key Rule (From Official FLOP Docs)
1. **Holding unused faucet `$FLOP` earns 0 airdrop weight.**
2. **Devnet activity earns 0 airdrop weight.**
3. Airdrop weight for the **Agents** pool (`1.2B $FLOP` draft genesis allocation) is measured strictly by **settled inference spend** on the live **FLOP Testnet**.
4. Manufactured / repetitive fake spam can be flagged and disqualified before genesis lock — run genuine, varied inference tasks (summarizing notes, coding questions, analysis, etc.) with randomized schedules.

---

## Checking Testnet Model Catalog & Readiness

Once `https://docs.flop.network/docs/network-testnet` publishes verified Testnet RPC & Gateway endpoints:

```bash
# Check available public models on the gateway
curl -sS https://api.flop.network/v1/models
```

## Running a Direct Session via `@flop-labs/cli`

Using your encrypted keystore in `~/workspace/flop-agent/keystore/`:

```bash
FLOP_KEY_PASSWORD="$(cat ~/workspace/flop-agent/keystore/.password)" \
npx --yes --package @flop-labs/cli flop \
  --network testnet \
  --keystore ~/workspace/flop-agent/keystore/agent.json \
  --password-env FLOP_KEY_PASSWORD \
  --help
```

*(Note: Once FLOP Labs publishes the final Testnet CLI release version on `https://flop.finance/official/` and `https://docs.flop.network/docs/sdk-references`, pin that exact CLI version and verify settled receipts rather than pending quotes.)*
