// scripts/scheduler.cjs
// Tracks per-agent 24h faucet cooldown with a light randomized 1-10 minute jitter
// (prevents hitting the 24h cooldown too early without drifting hours late),
// and generates separate randomized spend windows for Testnet inference.
//
// Usage:
//   node scripts/scheduler.cjs status         -> Show next eligible claim time & spend plan
//   node scripts/scheduler.cjs record-claim   -> Record a successful faucet claim & compute next window
//   node scripts/scheduler.cjs plan-spend     -> Generate a randomized multi-wave inference schedule

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const defaultBase = fs.existsSync(path.join(os.homedir(), 'workspace'))
  ? path.join(os.homedir(), 'workspace', 'flop-agent')
  : path.join(os.homedir(), '.flop-agent');

const AGENT_DIR = process.env.FLOP_AGENT_DIR || defaultBase;
const STATE_PATH = path.join(AGENT_DIR, 'state.json');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MIN_CLAIM_JITTER_MIN = 1;
const MAX_CLAIM_JITTER_MIN = 10;

function readState() {
  if (!fs.existsSync(STATE_PATH)) {
    return { lastClaimAt: null, nextClaimAt: null, lastJitterMinutes: null, spendPlan: [] };
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

function writeState(state) {
  fs.mkdirSync(AGENT_DIR, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

function toWib(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }) + ' WIB';
}

function buildRandomSpendWaves(baseTimeMs = Date.now(), waves = 3) {
  const plan = [];
  let cursor = baseTimeMs;
  for (let i = 1; i <= waves; i++) {
    // Spread waves across the day with 45 to 180 minutes random gaps
    const gapMin = crypto.randomInt(45, 181);
    cursor += gapMin * 60 * 1000;
    plan.push({
      wave: i,
      scheduledAtUtc: new Date(cursor).toISOString(),
      scheduledAtWib: toWib(cursor),
      delayMinutesFromPrev: gapMin,
    });
  }
  return plan;
}

const cmd = process.argv[2] || 'status';
const state = readState();
const now = Date.now();

if (cmd === 'record-claim') {
  const jitterMin = crypto.randomInt(MIN_CLAIM_JITTER_MIN, MAX_CLAIM_JITTER_MIN + 1);
  const nextClaimMs = now + ONE_DAY_MS + jitterMin * 60 * 1000;
  const spendPlan = buildRandomSpendWaves(now, 3);

  const updated = {
    lastClaimAt: new Date(now).toISOString(),
    lastClaimAtWib: toWib(now),
    lastJitterMinutes: jitterMin,
    nextClaimAt: new Date(nextClaimMs).toISOString(),
    nextClaimAtWib: toWib(nextClaimMs),
    spendPlan,
  };
  writeState(updated);
  console.log(JSON.stringify({ ok: true, action: 'record-claim', state: updated }, null, 2));
  process.exit(0);
}

if (cmd === 'plan-spend') {
  const waves = Number(process.argv[3] || 3);
  const spendPlan = buildRandomSpendWaves(now, Math.max(1, Math.min(waves, 6)));
  state.spendPlan = spendPlan;
  writeState(state);
  console.log(JSON.stringify({ ok: true, action: 'plan-spend', spendPlan }, null, 2));
  process.exit(0);
}

// Default: status
const nextMs = state.nextClaimAt ? Date.parse(state.nextClaimAt) : 0;
const eligibleNow = !state.nextClaimAt || now >= nextMs;
const remainingMinutes = eligibleNow ? 0 : Math.ceil((nextMs - now) / 60000);

console.log(JSON.stringify({
  stateFile: STATE_PATH,
  nowUtc: new Date(now).toISOString(),
  nowWib: toWib(now),
  eligibleToClaimNow: eligibleNow,
  remainingMinutes,
  lastClaimAtWib: state.lastClaimAt ? toWib(Date.parse(state.lastClaimAt)) : null,
  nextClaimAtWib: state.nextClaimAt ? toWib(nextMs) : null,
  lastJitterMinutes: state.lastJitterMinutes,
  spendPlan: state.spendPlan || [],
}, null, 2));
