// scripts/self-test.cjs
// Offline smoke test: validates syntax of all toolkit scripts and verifies Node 18+ fetch support.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const scriptsDir = __dirname;
const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.cjs'));

if (typeof fetch !== 'function') {
  console.error('FAIL: Global fetch() is unavailable. Please run Node.js 18 or newer.');
  process.exit(1);
}

for (const file of files) {
  const fullPath = path.join(scriptsDir, file);
  execFileSync(process.execPath, ['--check', fullPath], { stdio: 'pipe' });
  console.log(`PASS: ${file}`);
}

console.log(`All ${files.length} scripts passed syntax verification on Node ${process.version}.`);
