// scripts/faucet.cjs
// Checks live FLOP Faucet network status (/chain, /health) and claims via HTTP API or Technocore signed room.
// Works inside cloud containers (such as Muse) without Chrome/Puppeteer.
//
// Usage:
//   node scripts/faucet.cjs                         -> Check status only
//   node scripts/faucet.cjs --claim-if-testnet      -> Claim automatically ONLY if network === 'testnet' & open
//   node scripts/faucet.cjs --claim --allow-devnet  -> Force claim even on devnet (for testing only)

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const claimIfTestnet = args.includes('--claim-if-testnet');
const forceClaim = args.includes('--claim');
const allowDevnet = args.includes('--allow-devnet');
const explicitAddr = args.find(a => !a.startsWith('--'));

const FAUCET_BASE = (process.env.FAUCET_URL || 'https://faucet.flop.network').replace(/\/+$/, '');
const TECHNOCORE_BASE = (process.env.TECHNOCORE_URL || 'https://technocore.chat').replace(/\/+$/, '');
const DEFAULT_TESTNET_GENESIS = '0x918abd58fb16306b30ef3886514cfaebffecb4de43e82b6f8ec4795c43cfd800';

function findExistingFile(relParts) {
  const candidates = [
    process.env.FLOP_AGENT_DIR && path.join(process.env.FLOP_AGENT_DIR, ...relParts),
    path.join(os.homedir(), 'workspace', 'flop-agent', ...relParts),
    path.join(os.homedir(), '.flop-agent', ...relParts),
    path.resolve(__dirname, '..', ...relParts),
  ].filter(Boolean);

  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function findSavedAddress() {
  const file = findExistingFile(['keystore', 'public-identity.json']);
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).address || null;
  } catch (_) {
    return null;
  }
}

function findDidKey() {
  const file = findExistingFile(['keystore', 'did.key.json']);
  if (!file) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data.did && data.privateKeyPem ? data : null;
  } catch (_) {
    return null;
  }
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

async function sendTechnocoreClaim(address, room) {
  const nonce = String(Date.now());
  const text = `!faucet request ${address} ${nonce}`;
  const url = `${TECHNOCORE_BASE}/r/${room}`;
  const didData = findDidKey();

  if (didData) {
    const payload = `${room}|${nonce}|${text}`;
    const sig = crypto
      .sign(null, Buffer.from(payload, 'utf8'), crypto.createPrivateKey(didData.privateKeyPem))
      .toString('base64url');
    console.log(`\nSubmitting did:key signed claim (${didData.did}) to ${url} ...`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ did: didData.did, sig, nonce, text }),
    });
    return { ok: res.ok, status: res.status, mode: 'did-signed', body: await res.text() };
  }

  const sayUrl = `${TECHNOCORE_BASE}/r/${room}/say/flopagent/${encodeURIComponent(text)}`;
  console.log(`\nSubmitting unsigned claim to ${sayUrl} ...`);
  const res = await fetch(sayUrl);
  return { ok: res.ok, status: res.status, mode: 'unsigned-say', body: await res.text() };
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
  const fundingStatus = healthRes?.body?.dependencies?.funding?.faucet?.status || null;
  const faucetOpen = ready || fundingStatus === 'open';

  console.log('\n--- Live Network Summary ---');
  console.log(`Chain   : ${chainName} (network="${network}")`);
  console.log(`Health  : status="${healthStatus}", ready=${ready}, faucet="${fundingStatus || 'unknown'}"`);

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

  if (!faucetOpen && !allowDevnet) {
    console.log(
      `\nDEFERRED CLAIM: Network is "${network}", but faucet funding is not open (${healthStatus}). ` +
      'Retry on the next scheduled check.'
    );
    process.exit(0);
  }

function requirePolkadot(agentJsonPath) {
  const bases = [
    path.resolve(__dirname, '..'),
    path.dirname(path.dirname(agentJsonPath)),
    process.env.FLOP_AGENT_DIR,
  ].filter(Boolean);

  for (const modName of ['@polkadot/keyring', '@polkadot/util-crypto', '@polkadot/util']) {
    let loaded = false;
    for (const base of bases) {
      try {
        require.resolve(modName, { paths: [base] });
        loaded = true;
        break;
      } catch (_) {}
    }
    if (!loaded) {
      try {
        require.resolve(modName);
      } catch (_) {
        return null;
      }
    }
  }

  const resolveFrom = name => {
    for (const base of bases) {
      try {
        return require(require.resolve(name, { paths: [base] }));
      } catch (_) {}
    }
    return require(name);
  };

  return {
    Keyring: resolveFrom('@polkadot/keyring').Keyring,
    cryptoWaitReady: resolveFrom('@polkadot/util-crypto').cryptoWaitReady,
    stringToU8a: resolveFrom('@polkadot/util').stringToU8a,
    u8aToHex: resolveFrom('@polkadot/util').u8aToHex,
  };
}

async function buildD10ClaimPayload(targetAddress, genesisHash) {
  const agentJsonPath = findExistingFile(['keystore', 'agent.json']);
  const passPath = findExistingFile(['keystore', '.password']);
  if (!agentJsonPath || !passPath) return null;

  const polkadot = requirePolkadot(agentJsonPath);
  if (!polkadot) return null;

  await polkadot.cryptoWaitReady();
  const keyJson = JSON.parse(fs.readFileSync(agentJsonPath, 'utf8'));
  const pass = fs.readFileSync(passPath, 'utf8').trim();
  const keyring = new polkadot.Keyring({ type: 'sr25519' });
  const pair = keyring.addFromJson(keyJson);
  pair.decodePkcs8(pass);

  if (pair.address !== targetAddress) {
    throw new Error(`Keystore address (${pair.address}) does not match target (${targetAddress})`);
  }

  const nonce = String(Date.now());
  const challenge = `flop-faucet-agent/v1|${genesisHash}|${targetAddress}|${nonce}`;
  const signature = polkadot.u8aToHex(pair.sign(polkadot.stringToU8a(challenge)));
  return { address: targetAddress, nonce, signature };
}

  const isTestnet = network === 'testnet';
  const claimPath = isTestnet ? '/v1/testnet/agent-claims' : '/fund';
  const genesisHash = chainRes?.body?.genesisHash || DEFAULT_TESTNET_GENESIS;
  let bodyPayload = { client: 'faucet-web', address };

  if (isTestnet) {
    const signedPayload = await buildD10ClaimPayload(address, genesisHash);
    if (signedPayload) {
      bodyPayload = signedPayload;
      console.log(`\nSubmitting D10 signed claim to ${FAUCET_BASE}${claimPath} for ${address} ...`);
    } else {
      console.log(`\nTrying HTTP POST ${FAUCET_BASE}${claimPath} for ${address} (no local sr25519 keystore found)...`);
    }
  } else {
    console.log(`\nTrying HTTP POST ${FAUCET_BASE}${claimPath} for ${address} ...`);
  }

  let fundRes = await fetch(`${FAUCET_BASE}${claimPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });

  if (fundRes.status >= 502 && fundRes.status <= 504) {
    console.log(`HTTP ${fundRes.status} — retrying once after 2s...`);
    await new Promise(r => setTimeout(r, 2000));
    fundRes = await fetch(`${FAUCET_BASE}${claimPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    });
  }

  const rawText = await fundRes.text();
  if (fundRes.ok) {
    console.log(`HTTP ${fundRes.status}:`, rawText);
    return;
  }

  if (fundRes.status === 429 || fundRes.status >= 500) {
    console.error(`HTTP ${claimPath} failed (${fundRes.status}):`, rawText.slice(0, 300));
    process.exit(1);
  }

  console.log(`HTTP ${claimPath} returned ${fundRes.status}; falling back to Technocore room...`);
  const room = chainRes?.body?.technocoreBot?.room || (isTestnet ? 'flop-testnet-faucet' : 'flop-devnet-faucet');
  const tcRes = await sendTechnocoreClaim(address, room);
  console.log(`Technocore (${tcRes.mode}) HTTP ${tcRes.status}:`, tcRes.body.trim());
  if (!tcRes.ok) process.exit(1);
})().catch(err => {
  console.error('Faucet check/claim failed:', err.message);
  process.exit(1);
});
