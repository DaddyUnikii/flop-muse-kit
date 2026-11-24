// scripts/setup-identity.cjs
// Creates an encrypted FLOP Network sr25519 keystore using the official @flop-labs/cli.
// Safe defaults:
// - Stores files in ~/workspace/flop-agent/keystore (or custom FLOP_AGENT_DIR) with mode 600.
// - Never overwrites an existing keystore (prints existing public identity instead).
// - Randomizes default agent name so multiple users/agents don't collide on identical names.
// - Passes password strictly via environment variable; never prints secret material.

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ADJECTIVES = [
  'amber', 'arctic', 'astral', 'brisk', 'cobalt', 'coral', 'crisp', 'dawn',
  'delta', 'ember', 'frost', 'lunar', 'maple', 'misty', 'noble', 'nova',
  'onyx', 'orbit', 'prism', 'pulse', 'quartz', 'rapid', 'river', 'solar',
  'sonic', 'spark', 'swift', 'terra', 'tidal', 'vivid', 'zephyr', 'zenith',
];
const NOUNS = [
  'atlas', 'beacon', 'cipher', 'comet', 'condor', 'falcon', 'forge', 'glider',
  'harbor', 'heron', 'lynx', 'matrix', 'nexus', 'nomad', 'otter', 'panda',
  'pilot', 'quasar', 'ranger', 'raven', 'relay', 'rover', 'scout', 'seeker',
  'sentry', 'signal', 'sparrow', 'stride', 'summit', 'vector', 'vertex', 'voyager',
];

function randomAgentName() {
  const adj = ADJECTIVES[crypto.randomInt(ADJECTIVES.length)];
  const noun = NOUNS[crypto.randomInt(NOUNS.length)];
  const num = crypto.randomInt(100, 999);
  return `${adj}-${noun}-${num}`;
}

function generatePassword(length = 32) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#%^&*';
  let out = '';
  while (out.length < length) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < Math.floor(256 / chars.length) * chars.length) {
      out += chars[byte % chars.length];
    }
  }
  return out;
}

const defaultBase = fs.existsSync(path.join(os.homedir(), 'workspace'))
  ? path.join(os.homedir(), 'workspace', 'flop-agent')
  : path.join(os.homedir(), '.flop-agent');

const AGENT_DIR = process.env.FLOP_AGENT_DIR || defaultBase;
const KEYSTORE_DIR = path.join(AGENT_DIR, 'keystore');
const KEYSTORE_PATH = path.join(KEYSTORE_DIR, 'agent.json');
const PASS_PATH = path.join(KEYSTORE_DIR, '.password');
const PUBLIC_PATH = path.join(KEYSTORE_DIR, 'public-identity.json');
const CLI_PKG = process.env.FLOP_CLI_PKG || '@flop-labs/cli@0.7.0';

// If identity already exists, report public info safely without overwriting
if (fs.existsSync(KEYSTORE_PATH)) {
  console.log('Existing keystore detected at:', KEYSTORE_PATH);
  if (fs.existsSync(PUBLIC_PATH)) {
    console.log('Public Identity:', fs.readFileSync(PUBLIC_PATH, 'utf8').trim());
    process.exit(0);
  }
  if (fs.existsSync(PASS_PATH)) {
    const existingPass = fs.readFileSync(PASS_PATH, 'utf8').trim();
    const inspected = execFileSync(
      'npx',
      ['--yes', '--package', CLI_PKG, 'flop', '--offline', 'keys', 'inspect', KEYSTORE_PATH, '--password-env', 'FLOP_KEY_PASSWORD', '--json'],
      {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FLOP_KEY_PASSWORD: existingPass },
      }
    );
    const parsed = JSON.parse(inspected.trim());
    const safePublic = {
      name: parsed.name || null,
      type: parsed.type || 'sr25519',
      address: parsed.address || parsed.ss58Address || parsed.ss58 || null,
    };
    fs.writeFileSync(PUBLIC_PATH, JSON.stringify(safePublic, null, 2) + '\n');
    console.log('Public Identity:', JSON.stringify(safePublic, null, 2));
    process.exit(0);
  }
  console.error('Keystore exists without public-identity.json or .password; leaving untouched.');
  process.exit(1);
}

const agentName = process.argv[2] || randomAgentName();
const password = generatePassword(32);

fs.mkdirSync(KEYSTORE_DIR, { recursive: true, mode: 0o700 });
fs.writeFileSync(PASS_PATH, password, { mode: 0o600 });

try {
  const rawOut = execFileSync(
    'npx',
    [
      '--yes', '--package', CLI_PKG,
      'flop', '--offline',
      'agent', 'keys', 'generate',
      '--name', agentName,
      '--type', 'sr25519',
      '--out', KEYSTORE_PATH,
      '--password-env', 'FLOP_KEY_PASSWORD',
      '--json',
    ],
    {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FLOP_KEY_PASSWORD: password },
    }
  );

  fs.chmodSync(KEYSTORE_PATH, 0o600);
  fs.chmodSync(PASS_PATH, 0o600);

  const parsed = JSON.parse(rawOut.trim());
  const safePublic = {
    name: parsed.name || agentName,
    type: parsed.type || 'sr25519',
    address: parsed.address || parsed.ss58Address || parsed.ss58 || null,
    did: parsed.did || null,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(PUBLIC_PATH, JSON.stringify(safePublic, null, 2) + '\n');

  console.log('Successfully created encrypted FLOP agent keystore.');
  console.log('Public Identity:', JSON.stringify(safePublic, null, 2));
  console.log('Keystore file :', KEYSTORE_PATH, '(mode 600)');
  console.log('Password file :', PASS_PATH, '(mode 600, stored locally)');
} catch (err) {
  if (fs.existsSync(PASS_PATH) && !fs.existsSync(KEYSTORE_PATH)) {
    fs.unlinkSync(PASS_PATH);
  }
  const detail = (err.stderr || err.message || '').toString().slice(0, 400);
  console.error('Failed to generate keystore:', detail);
  process.exit(1);
}
