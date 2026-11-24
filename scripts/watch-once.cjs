// scripts/watch-once.cjs
// Lightweight single-pass readiness probe designed for Muse Scheduled Tasks / cron jobs.
// Prints a compact JSON status line so an autonomous agent immediately knows whether
// FLOP Testnet has flipped from "devnet" / "planned" to live "testnet".

const FAUCET_BASE = (process.env.FAUCET_URL || 'https://faucet.flop.network').replace(/\/+$/, '');
const API_BASE = (process.env.FLOP_API_URL || 'https://api.flop.network').replace(/\/+$/, '');

async function probeJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  const [chain, health, models] = await Promise.all([
    probeJson(`${FAUCET_BASE}/chain`),
    probeJson(`${FAUCET_BASE}/health`),
    probeJson(`${API_BASE}/v1/models`),
  ]);

  const network = chain?.data?.network || 'unknown';
  const faucetReady = Boolean(health?.data?.ready);
  const modelCount = Array.isArray(models?.data?.data) ? models.data.data.length : 0;
  const testnetLive = network === 'testnet' && faucetReady;

  const summary = {
    checkedAt: new Date().toISOString(),
    network,
    chain: chain?.data?.chain || null,
    faucetStatus: health?.data?.status || null,
    faucetReady,
    gatewayModelsCount: modelCount,
    testnetLive,
    recommendedNextMinuteJitter: Math.floor(Math.random() * 45) + 5,
  };

  console.log(JSON.stringify(summary, null, 2));
})().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
});
