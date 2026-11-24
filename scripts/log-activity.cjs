// scripts/log-activity.cjs
// Appends structured daily FLOP Testnet activity rows to flop-log.md.
// Usage: node scripts/log-activity.cjs <network> <address> <claimed> <spent> <settled> <tx_or_note>

const fs = require('fs');
const os = require('os');
const path = require('path');

const defaultBase = fs.existsSync(path.join(os.homedir(), 'workspace'))
  ? path.join(os.homedir(), 'workspace', 'flop-agent')
  : path.join(os.homedir(), '.flop-agent');

const AGENT_DIR = process.env.FLOP_AGENT_DIR || defaultBase;
const LOG_PATH = path.join(AGENT_DIR, 'flop-log.md');

const [
  network = 'testnet',
  address = '-',
  claimed = '0',
  spent = '0',
  settled = '0',
  note = '-',
] = process.argv.slice(2);

fs.mkdirSync(AGENT_DIR, { recursive: true });

if (!fs.existsSync(LOG_PATH)) {
  fs.writeFileSync(
    LOG_PATH,
    '# FLOP Agent Activity Log\n\n' +
    '| Time (WIB) | Time (UTC) | Network | Address | Claimed | Spent | Settled | Tx / Notes |\n' +
    '|---|---|---|---|---|---|---|---|\n'
  );
}

const now = new Date();
const wib = now.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }) + ' WIB';
const utc = now.toISOString();
const row = `| ${wib} | ${utc} | ${network} | \`${address}\` | ${claimed} | ${spent} | ${settled} | ${note} |\n`;

fs.appendFileSync(LOG_PATH, row);
console.log('Logged activity to:', LOG_PATH);
