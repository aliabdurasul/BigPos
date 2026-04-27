import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type { AgentKeystore } from './types.js';

const KEYSTORE_DIR  = path.join(os.homedir(), '.bigpos-agent');
const KEYSTORE_PATH = path.join(KEYSTORE_DIR, 'keystore.json');

/**
 * Load the agent keystore from disk.
 * Throws if the file does not exist — agent needs to be provisioned first.
 */
export function loadKeystore(): AgentKeystore {
  if (!fs.existsSync(KEYSTORE_PATH)) {
    throw new Error(
      `Agent not provisioned. Run with --provision flag or place keystore.json at:\n  ${KEYSTORE_PATH}`,
    );
  }

  let raw: string;
  try {
    raw = fs.readFileSync(KEYSTORE_PATH, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read keystore: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Keystore is not valid JSON. Re-provision the agent.');
  }

  const ks = parsed as Record<string, unknown>;
  const required = ['agentToken', 'restaurantId', 'supabaseUrl', 'supabaseServiceKey'];
  for (const key of required) {
    if (!ks[key]) {
      throw new Error(`Keystore missing required field: ${key}`);
    }
  }

  return parsed as AgentKeystore;
}

/**
 * Save keystore to disk with restricted permissions (owner read-only).
 * Used during first-time provisioning.
 */
export function saveKeystore(keystore: AgentKeystore): void {
  fs.mkdirSync(KEYSTORE_DIR, { recursive: true, mode: 0o700 });
  const data = JSON.stringify(keystore, null, 2);
  fs.writeFileSync(KEYSTORE_PATH, data, { mode: 0o600, encoding: 'utf8' });
  console.log(`[keystore] Saved to ${KEYSTORE_PATH}`);
}

/**
 * Hash a raw token with SHA-256.
 * Used when verifying the token matches what Supabase has stored.
 */
export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Generate a cryptographically random token (32 bytes = 64 hex chars).
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
