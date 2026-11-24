// scripts/inspect-identity.cjs
// Verifies an existing encrypted FLOP keystore offline without exposing the password.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const defaultBase = fs.existsSync(path.join(os.homedir(), 'workspace'))
  ? path.join(os.homedir(), 'workspace', 'flop-agent')
  : path.join(os.homedir(), '.flop-agent');

const AGENT_DIR = process.env.FLOP_AGENT_DIR || defaultBase;
const KEYSTORE_PATH = path.join(AGENT_DIR, 'keystore', 'agent.json');
const PASS_PATH = path.join(AGENT_DIR, 'keystore', '.password');
const CLI_PKG = process.env.FLOP_CLI_PKG || '@flop-labs/cli@0.7.0';

if (!fs.existsSync(KEYSTORE_PATH) || !fs.existsSync(PASS_PATH)) {
  console.error('Keystore or local .password file not found in:', path.join(AGENT_DIR, 'keystore'));
  console.error('Run `node scripts/setup-identity.cjs` first.');
  process.exit(1);
}

const password = fs.readFileSync(PASS_PATH, 'utf8').trim();
const out = execFileSync(
  'npx',
  ['--yes', '--package', CLI_PKG, 'flop', '--offline', 'keys', 'inspect', KEYSTORE_PATH, '--password-env', 'FLOP_KEY_PASSWORD', '--json'],
  {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FLOP_KEY_PASSWORD: password },
  }
);

const parsed = JSON.parse(out.trim());
console.log(JSON.stringify({
  verified: true,
  keystore: KEYSTORE_PATH,
  name: parsed.name || null,
  type: parsed.type || 'sr25519',
  address: parsed.address || parsed.ss58Address || parsed.ss58 || null,
}, null, 2));
