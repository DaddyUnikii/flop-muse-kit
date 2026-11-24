// scripts/scheduler.cjs
// Tracks per-agent 24h + 1-10m faucet cooldown and builds randomized daily
// 3-wave inference spend schedules in Asia/Jakarta (WIB, UTC+7):
//   G1: start 09:00-10:00 WIB, duration 40-80m, 30% allocation (paced across duration)
//   G2: start 11:00-12:00 WIB, duration 50-100m, 40% allocation (paced across duration)
//   G3: start 13:00-15:00 WIB, duration 45-85m, 30% allocation (paced across duration)
// Works identically on local PC, Muse, and VPS regardless of server timezone.

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
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MIN_CLAIM_JITTER_MIN = 1;
const MAX_CLAIM_JITTER_MIN = 10;

const WAVE_SPECS = [
  { wave: 1, sharePct: 30, startHourWib: 9, endHourWib: 10, minDurMin: 40, maxDurMin: 80, minSteps: 5, maxSteps: 9 },
  { wave: 2, sharePct: 40, startHourWib: 11, endHourWib: 12, minDurMin: 50, maxDurMin: 100, minSteps: 6, maxSteps: 12 },
  { wave: 3, sharePct: 30, startHourWib: 13, endHourWib: 15, minDurMin: 45, maxDurMin: 85, minSteps: 5, maxSteps: 9 },
];

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

function getWibMidnightUtcMs(referenceMs) {
  const wibDate = new Date(referenceMs + WIB_OFFSET_MS);
  return Date.UTC(wibDate.getUTCFullYear(), wibDate.getUTCMonth(), wibDate.getUTCDate(), 0, 0, 0) - WIB_OFFSET_MS;
}

// Spreads each wave's allocation across randomized micro-intervals spanning startMs -> endMs
function buildWaveSteps(startMs, endMs, waveSharePct, minSteps, maxSteps) {
  const count = crypto.randomInt(minSteps, maxSteps + 1);
  const durMs = Math.max(60000, endMs - startMs);

  // Pick randomized sorted timestamps inside [startMs, endMs]
  const offsets = [0];
  for (let i = 1; i < count - 1; i++) {
    offsets.push(crypto.randomInt(Math.floor(durMs * 0.05), Math.floor(durMs * 0.95) + 1));
  }
  if (count > 1) offsets.push(durMs);
  offsets.sort((a, b) => a - b);

  // Randomize weight per step while summing cleanly to waveSharePct
  const rawWeights = Array.from({ length: count }, () => crypto.randomInt(50, 151));
  const totalWeight = rawWeights.reduce((a, b) => a + b, 0);
  let remainingPct = waveSharePct;

  return offsets.map((offsetMs, idx) => {
    const stepMs = startMs + offsetMs;
    let pct;
    if (idx === count - 1) {
      pct = Number(remainingPct.toFixed(2));
    } else {
      pct = Number(((rawWeights[idx] / totalWeight) * waveSharePct).toFixed(2));
      remainingPct -= pct;
    }
    return {
      step: idx + 1,
      atWib: toWib(stepMs),
      atUtc: new Date(stepMs).toISOString(),
      pctOfDailyBudget: pct,
    };
  });
}

function buildDailySpendWaves(referenceMs = Date.now()) {
  let targetDayStartUtcMs = getWibMidnightUtcMs(referenceMs);
  const wibHourNow = new Date(referenceMs + WIB_OFFSET_MS).getUTCHours();

  if (wibHourNow >= 15) {
    targetDayStartUtcMs += ONE_DAY_MS;
  }

  const plan = [];
  let minAllowedStartMs = Math.max(referenceMs + 60 * 1000, targetDayStartUtcMs);

  for (const spec of WAVE_SPECS) {
    const windowStartMs = targetDayStartUtcMs + spec.startHourWib * 3600 * 1000;
    const windowEndMs = targetDayStartUtcMs + spec.endHourWib * 3600 * 1000;

    const effectiveStartMs = Math.max(windowStartMs, minAllowedStartMs);
    const effectiveEndMs = Math.max(effectiveStartMs, windowEndMs);

    const spanSec = Math.max(1, Math.floor((effectiveEndMs - effectiveStartMs) / 1000));
    const startMs = effectiveStartMs + crypto.randomInt(0, spanSec + 1) * 1000;
    const durationMin = crypto.randomInt(spec.minDurMin, spec.maxDurMin + 1);
    const endMs = startMs + durationMin * 60 * 1000;

    const steps = buildWaveSteps(startMs, endMs, spec.sharePct, spec.minSteps, spec.maxSteps);

    plan.push({
      wave: spec.wave,
      sharePct: spec.sharePct,
      startWib: toWib(startMs),
      endWib: toWib(endMs),
      durationMinutes: durationMin,
      stepCount: steps.length,
      steps,
    });

    minAllowedStartMs = endMs + 5 * 60 * 1000;
  }

  return plan;
}

const cmd = process.argv[2] || 'status';
const state = readState();
const now = Date.now();

if (cmd === 'record-claim') {
  const jitterMin = crypto.randomInt(MIN_CLAIM_JITTER_MIN, MAX_CLAIM_JITTER_MIN + 1);
  const nextClaimMs = now + ONE_DAY_MS + jitterMin * 60 * 1000;
  const spendPlan = buildDailySpendWaves(now);

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
  const spendPlan = buildDailySpendWaves(now);
  state.spendPlan = spendPlan;
  writeState(state);
  console.log(JSON.stringify({ ok: true, action: 'plan-spend', spendPlan }, null, 2));
  process.exit(0);
}

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
