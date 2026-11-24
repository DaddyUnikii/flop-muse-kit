// scripts/setup-did.cjs
// Generates a W3C Ed25519 did:key (did:key:z6Mk...) for Technocore chat & agent identity.
// Zero external dependencies (uses Node.js built-in crypto).
// Stores private key locally with mode 0600 and never overwrites an existing DID.

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(buffer) {
  let digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    let carry = buffer[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '';
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) out += '1';
  for (let i = digits.length - 1; i >= 0; i--) out += BASE58_ALPHABET[digits[i]];
  return out;
}

const defaultBase = fs.existsSync(path.join(os.homedir(), 'workspace'))
  ? path.join(os.homedir(), 'workspace', 'flop-agent')
  : path.join(os.homedir(), '.flop-agent');

const AGENT_DIR = process.env.FLOP_AGENT_DIR || defaultBase;
const KEYSTORE_DIR = path.join(AGENT_DIR, 'keystore');
const DID_KEY_PATH = path.join(KEYSTORE_DIR, 'did.key.json');
const DID_PUB_PATH = path.join(KEYSTORE_DIR, 'did-public.json');

if (fs.existsSync(DID_KEY_PATH)) {
  console.log('Existing Ed25519 DID key detected at:', DID_KEY_PATH);
  if (fs.existsSync(DID_PUB_PATH)) {
    console.log('Public DID:', fs.readFileSync(DID_PUB_PATH, 'utf8').trim());
  }
  process.exit(0);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
// Ed25519 SPKI DER is 44 bytes: 12-byte header + 32-byte raw public key
const rawPub = spkiDer.subarray(spkiDer.length - 32);
const multicodecPub = Buffer.concat([Buffer.from([0xed, 0x01]), rawPub]);
const did = `did:key:z${base58Encode(multicodecPub)}`;

const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });

fs.mkdirSync(KEYSTORE_DIR, { recursive: true, mode: 0o700 });
fs.writeFileSync(
  DID_KEY_PATH,
  JSON.stringify({ did, algorithm: 'Ed25519', privateKeyPem: privatePem, createdAt: new Date().toISOString() }, null, 2) + '\n',
  { mode: 0o600 }
);
try { fs.chmodSync(DID_KEY_PATH, 0o600); } catch (_) {}

const publicInfo = {
  did,
  algorithm: 'Ed25519',
  publicKeyHex: '0x' + rawPub.toString('hex'),
  createdAt: new Date().toISOString(),
};
fs.writeFileSync(DID_PUB_PATH, JSON.stringify(publicInfo, null, 2) + '\n');

console.log('Successfully generated Ed25519 DID identity.');
console.log('Public DID:', JSON.stringify(publicInfo, null, 2));
console.log('Private DID key saved locally at:', DID_KEY_PATH, '(mode 600, never printed)');
