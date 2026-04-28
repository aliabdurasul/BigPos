/**
 * BigPOS Agent Provisioner
 *
 * Usage:
 *   node dist/provision.js \
 *     --token  <INSTALL_TOKEN>       (from BigPOS admin → Settings → Printers → Agents)
 *     --url    <SUPABASE_PROJECT_URL> (e.g. https://xyzxyz.supabase.co)
 *     --service-key <SERVICE_ROLE_KEY> (from Supabase Dashboard → Settings → API)
 *
 * What it does:
 *   1. Calls POST <url>/functions/v1/register-agent with the one-time install token
 *   2. Receives a permanent agent_token (shown ONCE — never stored on the server)
 *   3. Saves ~/.bigpos-agent/keystore.json with all required credentials
 *
 * After this, run `npm start` (or install as a service) to start the agent.
 */

import * as https from 'https';
import * as http  from 'http';
import * as os    from 'os';
import { saveKeystore } from './keystore.js';
import type { AgentKeystore } from './types.js';

// ─── CLI Argument Parsing ──────────────────────────────────────────────────────

interface Args {
  token:      string;
  url:        string;
  serviceKey: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    if (idx === -1 || idx + 1 >= argv.length) return undefined;
    return argv[idx + 1];
  };

  const token      = get('--token');
  const url        = get('--url');
  const serviceKey = get('--service-key');

  if (!token || !url || !serviceKey) {
    console.error(`
Usage:
  node dist/provision.js \\
    --token      <INSTALL_TOKEN> \\
    --url        <SUPABASE_URL> \\
    --service-key <SERVICE_ROLE_KEY>

Example:
  node dist/provision.js \\
    --token      a1b2c3d4e5f6... \\
    --url        https://xyzxyz.supabase.co \\
    --service-key eyJhbGci...
`);
    process.exit(1);
  }

  // Trim trailing slash from URL
  return { token, url: url.replace(/\/+$/, ''), serviceKey };
}

// ─── HTTP Helper ───────────────────────────────────────────────────────────────

interface RegisterResponse {
  agent_id:      string;
  agent_token:   string;
  restaurant_id: string;
  error?:        string;
}

function postJson(url: string, body: unknown): Promise<RegisterResponse> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed  = new URL(url);
    const lib     = parsed.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 15_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            const parsed = JSON.parse(raw) as RegisterResponse;
            resolve(parsed);
          } catch {
            reject(new Error(`Non-JSON response (HTTP ${res.statusCode}): ${raw.slice(0, 300)}`));
          }
        });
      },
    );

    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out after 15s')); });
    req.write(payload);
    req.end();
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('BigPOS Agent Provisioner\n');

  const { token, url, serviceKey } = parseArgs();
  const fnUrl = `${url}/functions/v1/register-agent`;

  console.log(`Registering agent with Supabase...`);
  console.log(`  Endpoint:  ${fnUrl}`);
  console.log(`  Token:     ...${token.slice(-6)}\n`);

  let result: RegisterResponse;
  try {
    result = await postJson(fnUrl, {
      token,
      hostname:  os.hostname(),
      local_ip:  getLocalIp(),
      version:   '1.0.0',
    });
  } catch (err) {
    console.error(`\n❌ Network error: ${(err as Error).message}`);
    console.error('Check that the URL is correct and Edge Functions are deployed.');
    process.exit(1);
  }

  if (result.error) {
    console.error(`\n❌ Registration failed: ${result.error}`);
    if (result.error === 'invalid_or_expired_token') {
      console.error('The install token is invalid, already used, or expired (24h TTL).');
      console.error('Generate a new token from the BigPOS admin panel.');
    }
    process.exit(1);
  }

  // Validate the response has all required fields
  if (!result.agent_id || !result.agent_token || !result.restaurant_id) {
    console.error('\n❌ Unexpected response from server:', JSON.stringify(result));
    process.exit(1);
  }

  // Save the keystore
  const keystore: AgentKeystore = {
    agentToken:        result.agent_token,
    restaurantId:      result.restaurant_id,
    supabaseUrl:       url,
    supabaseServiceKey: serviceKey,
  };

  saveKeystore(keystore);

  console.log('✅ Agent provisioned successfully!\n');
  console.log(`  Agent ID:      ${result.agent_id}`);
  console.log(`  Restaurant ID: ${result.restaurant_id}`);
  console.log(`  Token hint:    ...${result.agent_token.slice(-6)}`);
  console.log('\n⚠️  The agent token above is shown ONCE and not stored on the server.');
  console.log('   If you lose it, generate a new install token and re-provision.\n');
  console.log('Next steps:');
  console.log('  • Start the agent:           npm start');
  console.log('  • Install as Windows service: node dist/service/windows.js install (run as Administrator)');
  console.log('  • Install as Linux service:   sudo bash install-linux.sh');
}

// ─── Network helpers ───────────────────────────────────────────────────────────

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return '127.0.0.1';
}

// ─── Entry point ──────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('\n❌ Unexpected error:', (err as Error).message);
  process.exit(1);
});
