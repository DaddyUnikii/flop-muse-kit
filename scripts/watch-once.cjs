// scripts/watch-once.cjs
// Lightweight single-pass readiness probe designed for Muse / VPS / Cron watchers.
// Verifies BOTH the official Testnet RPC genesis hash AND whether faucet.flop.network
// has switched from devnet to the live Testnet genesis hash.
// Uses native fetch() with automatic curl fallback for strict container proxies.

const { execFileSync } = require('child_process');

const FAUCET_BASE = (process.env.FAUCET_URL || 'https://faucet.flop.network').replace(/\/+$/, '');
const API_BASE = (process.env.FLOP_API_URL || 'https://api.flop.network').replace(/\/+$/, '');
const TESTNET_RPC = (process.env.FLOP_TESTNET_RPC || 'https://testnet.flop.network').replace(/\/+$/, '');
const EXPECTED_TESTNET_GENESIS =
  '0x918abd58fb16306b30ef3886514cfaebffecb4de43e82b6f8ec4795c43cfd800';

function curlJson(url, options = {}) {
  const args = ['-fsSL', '--max-time', '12'];
  if (options.method) args.push('-X', options.method);
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      args.push('-H', `${k}: ${v}`);
    }
  }
  if (options.body) args.push('-d', options.body);
  args.push(url);
  const raw = execFileSync('curl', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return { ok: true, status: 200, via: 'curl', data: JSON.parse(raw) };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function probeJson(url, options = {}, attempt = 1) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    if (res.status === 429 && attempt < 2) {
      await sleep(1500);
      return probeJson(url, options, attempt + 1);
    }
    const data = await res.json();
    return { ok: res.ok, status: res.status, via: 'fetch', data };
  } catch (err) {
    try {
      return curlJson(url, options);
    } catch (curlErr) {
      if (attempt < 2) {
        await sleep(1500);
        return probeJson(url, options, attempt + 1);
      }
      return { ok: false, error: `${err.message} | curl: ${curlErr.message}` };
    }
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  const [chain, health, models, rpcGenesis] = await Promise.all([
    probeJson(`${FAUCET_BASE}/chain`),
    probeJson(`${FAUCET_BASE}/health`),
    probeJson(`${API_BASE}/v1/models`),
    probeJson(`${TESTNET_RPC}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'chain_getBlockHash', params: [0] }),
    }),
  ]);

  const faucetNetwork = chain?.data?.network || 'unknown';
  const faucetGenesis = chain?.data?.genesisHash || null;
  const faucetReady = Boolean(health?.data?.ready);
  const faucetFundingStatus = health?.data?.dependencies?.funding?.faucet?.status || null;
  const faucetOpen = faucetFundingStatus === 'open';
  const testnetRpcGenesis = rpcGenesis?.data?.result || null;
  const testnetRpcOnline = testnetRpcGenesis === EXPECTED_TESTNET_GENESIS;
  const faucetMatchesTestnet =
    faucetNetwork === 'testnet' && faucetGenesis === EXPECTED_TESTNET_GENESIS;
  const modelCount = Array.isArray(models?.data?.data) ? models.data.data.length : 0;

  const summary = {
    checkedAtUtc: new Date().toISOString(),
    checkedAtWib: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }) + ' WIB',
    testnetRpcOnline,
    testnetRpcGenesis,
    faucetNetwork,
    faucetGenesis,
    faucetMatchesTestnet,
    faucetStatus: health?.data?.status || null,
    faucetReady,
    faucetFundingStatus,
    gatewayModelsCount: modelCount,
    readyForTestnetClaim: testnetRpcOnline && faucetMatchesTestnet && (faucetReady || faucetOpen),
    recommendedNextMinuteJitter: Math.floor(Math.random() * 45) + 5,
  };

  console.log(JSON.stringify(summary, null, 2));
})().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
