#!/usr/bin/env bash
# scripts/faucet-curl.sh
# Minimal pure-curl helper for checking FLOP Faucet status and claiming Testnet grants.

set -euo pipefail

FAUCET_URL="${FAUCET_URL:-https://faucet.flop.network}"
ADDR="${1:-}"

echo "=== Checking ${FAUCET_URL}/chain ==="
CHAIN_JSON="$(curl -fsSL "${FAUCET_URL}/chain")"
echo "${CHAIN_JSON}"

echo ""
echo "=== Checking ${FAUCET_URL}/health ==="
HEALTH_JSON="$(curl -fsSL "${FAUCET_URL}/health")"
echo "${HEALTH_JSON}"

if [[ -z "${ADDR}" ]]; then
  echo ""
  echo "Usage to claim once Testnet is live: bash scripts/faucet-curl.sh <YOUR_SS58_ADDRESS>"
  exit 0
fi

if ! echo "${CHAIN_JSON}" | grep -q '"network":"testnet"'; then
  echo ""
  echo "SKIPPED: Faucet is not on 'testnet' yet (devnet grants carry 0 airdrop weight)."
  exit 0
fi

echo ""
echo "=== Submitting Testnet Faucet Claim for ${ADDR} ==="
curl -sS -X POST "${FAUCET_URL}/fund" \
  -H "Content-Type: application/json" \
  -d "{\"client\":\"faucet-web\",\"address\":\"${ADDR}\"}"
echo ""
