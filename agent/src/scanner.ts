import * as os from 'os';
import * as net from 'net';
import { tcpProbe } from './tcp.js';
import type { Printer } from './types.js';

const SCAN_SUBNET_CIDR_LIMIT = 254;
const PROBE_CONCURRENCY = 30;

// ─── Network Interface Detection ──────────────────────────────────────────────

function getLocalSubnets(): string[] {
  const ifaces = os.networkInterfaces();
  const subnets: string[] = [];

  for (const iface of Object.values(ifaces)) {
    if (!iface) continue;
    for (const info of iface) {
      if (info.family !== 'IPv4' || info.internal) continue;
      // Extract subnet prefix (e.g. 192.168.1)
      const parts = info.address.split('.');
      if (parts.length === 4) {
        subnets.push(`${parts[0]}.${parts[1]}.${parts[2]}`);
      }
    }
  }

  // Deduplicate
  return [...new Set(subnets)];
}

// ─── LAN Scanner ──────────────────────────────────────────────────────────────

/**
 * Scans all local subnets for open TCP :9100 ports.
 * Returns list of discovered IPs.
 */
export async function scanLanForPrinters(port = 9100): Promise<string[]> {
  const subnets = getLocalSubnets();
  const found: string[] = [];

  for (const subnet of subnets) {
    const candidates: string[] = [];
    for (let i = 1; i <= SCAN_SUBNET_CIDR_LIMIT; i++) {
      candidates.push(`${subnet}.${i}`);
    }

    // Probe in batches to avoid exhausting file descriptors
    for (let i = 0; i < candidates.length; i += PROBE_CONCURRENCY) {
      const batch = candidates.slice(i, i + PROBE_CONCURRENCY);
      const results = await Promise.all(batch.map(ip => tcpProbe(ip, port)));
      for (let j = 0; j < batch.length; j++) {
        if (results[j]) found.push(batch[j]);
      }
    }
  }

  return found;
}

// ─── Printer Reachability Check ───────────────────────────────────────────────

export async function checkPrinterReachability(
  printers: Printer[],
): Promise<Array<{ id: string; reachable: boolean }>> {
  const results = await Promise.all(
    printers.map(async (p) => ({
      id:        p.id,
      reachable: await tcpProbe(p.ip_address, p.port),
    })),
  );
  return results;
}

// ─── Resolve Hostname ─────────────────────────────────────────────────────────

export function getHostname(): string {
  return os.hostname();
}

export function getLocalIp(): string | null {
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address;
      }
    }
  }
  return null;
}
