// scripts/faucet.cjs
// Checks live FLOP Faucet network status (/chain, /health) and claims via standard HTTP POST /fund.
// Works inside cloud containers (such as Muse) without Chrome/Puppeteer.
//
// Usage:
//   node scripts/faucet.cjs                         -> Check status only
//   node scripts/faucet.cjs --claim-if-testnet      -> Claim automatically ONLY if network === 'testnet' & ready
//   node scripts/faucet.cjs --claim --allow-devnet  -> Force claim even on devnet (for testing only)

const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const claimIfTestnet = args.includes('--claim-if-testnet');
const forceClaim = args.includes('--claim');
const allowDevnet = args.includes('--allow-devnet');
const explicitAddr = args.find(a => !a.startsWith('--'));

const FAUCET_BASE = (process.env.FAUCET_URL || 'https://faucet.flop.network').replace(/\/+$/, '');

function findSavedAddress() {
  const candidates = [
    process.env.FLOP_AGENT_DIR && path.join(process.env.FLOP_AGENT_DIR, 'keystore', 'public-identity.json'),
    path.join(os.homedir(), 'workspace', 'flop-agent', 'keystore', 'public-identity.json'),
    path.join(os.homedir(), '.flop-agent', 'keystore', 'public-identity.json'),
    path.resolve(__dirname, '..', 'keystore', 'public-identity.json'),
  ].filter(Boolean);

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (data.address) return data.address;
      } catch (_) {}
    }
  }
  return null;
}

async function getJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    try {
      return { ok: res.ok, status: res.status, body: JSON.parse(text) };
    } catch {
      return { ok: res.ok, status: res.status, raw: text.slice(0, 300) };
    }
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  const address = explicitAddr || findSavedAddress();
  console.log('Checking FLOP Faucet endpoints:', FAUCET_BASE);
  if (address) console.log('Detected Agent SS58 Address :', address);

  const [chainRes, healthRes] = await Promise.all([
    getJson(`${FAUCET_BASE}/chain`),
    getJson(`${FAUCET_BASE}/health`),
  ]);

  const network = chainRes?.body?.network || 'unknown';
  const chainName = chainRes?.body?.chain || 'unknown';
  const ready = Boolean(healthRes?.body?.ready);
  const healthStatus = healthRes?.body?.status || 'unknown';

  console.log('\n--- Live Network Summary ---');
  console.log(`Chain   : ${chainName} (network="${network}")`);
  console.log(`Health  : status="${healthStatus}", ready=${ready}`);

  if (!claimIfTestnet && !forceClaim) {
    if (network !== 'testnet') {
      console.log('\nNotice: Faucet is currently attached to DEVNET (0 airdrop weight).');
      console.log('Wait until network switches to "testnet" before claiming for airdrop activity.');
    }
    return;
  }

  if (!address) {
    console.error('\nCannot claim: no SS58 address provided or found in public-identity.json.');
    console.error('Run `node scripts/setup-identity.cjs` first or pass <SS58_ADDRESS>.');
    process.exit(1);
  }

  if (network !== 'testnet' && !allowDevnet) {
    console.log(
      `\nSKIPPED CLAIM: Faucet network is still "${network}" (not "testnet"). ` +
      'Devnet grants carry 0 airdrop weight. Schedule a periodic check and re-run once Testnet is live.'
    );
    process.exit(0);
  }

  if (!ready && !allowDevnet) {
    console.log(
      `\nDEFERRED CLAIM: Network is "${network}", but faucet health reports ready=false (${healthStatus}). ` +
      'Retry on the next scheduled check.'
    );
    process.exit(0);
  }

  console.log(`\nSubmitting HTTP POST ${FAUCET_BASE}/fund for ${address} ...`);
  const fundRes = await fetch(`${FAUCET_BASE}/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client: 'faucet-web', address }),
  });

  const rawText = await fundRes.text();
  console.log(`HTTP ${fundRes.status}:`, rawText);
  if (!fundRes.ok) process.exit(1);
})().catch(err => {
  console.error('Faucet check/claim failed:', err.message);
  process.exit(1);
});
