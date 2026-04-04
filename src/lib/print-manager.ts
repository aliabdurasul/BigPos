/**
 * Print Manager — production-grade print queue with:
 * - Per-station parallel queues (different printers don't block each other)
 * - Sequential processing within each station (prevents garbled prints)
 * - Retry with exponential backoff (3 attempts)
 * - Fingerprint-based deduplication (10s TTL)
 * - Print job status tracking with listener pattern
 * - Category-based item routing to kitchen/bar printers
 */

import { printRaw } from './qz-tray';

// ─── Types ─────────────────────────────────────

export type PrintJobStatus = 'pending' | 'printing' | 'success' | 'failed';

export interface PrintJob {
  id: string;
  stationId: string;
  data: number[];
  fingerprint: string;
  status: PrintJobStatus;
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// ─── Configuration ─────────────────────────────

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential
const DEDUP_TTL_MS = 10_000;
const MAX_LOG_SIZE = 200;

// ─── State (per-station queues) ────────────────

const _queues = new Map<string, PrintJob[]>();
const _processing = new Set<string>(); // stations currently processing
const _log: PrintJob[] = [];
const _logListeners: Array<(log: PrintJob[]) => void> = [];
const _recentFingerprints = new Map<string, number>(); // fingerprint → timestamp

// ─── Dedup ─────────────────────────────────────

function cleanExpiredFingerprints() {
  const now = Date.now();
  for (const [fp, ts] of _recentFingerprints) {
    if (now - ts > DEDUP_TTL_MS) _recentFingerprints.delete(fp);
  }
}

function isDuplicate(fingerprint: string): boolean {
  cleanExpiredFingerprints();
  return _recentFingerprints.has(fingerprint);
}

function recordFingerprint(fingerprint: string) {
  _recentFingerprints.set(fingerprint, Date.now());
}

/** Build a dedup fingerprint from type + context */
export function buildFingerprint(type: string, id: string): string {
  return `${type}:${id}`;
}

// ─── Log / listeners ───────────────────────────

function pushLog(job: PrintJob) {
  _log.unshift({ ...job });
  if (_log.length > MAX_LOG_SIZE) _log.length = MAX_LOG_SIZE;
  _logListeners.forEach(fn => fn([..._log]));
}

export function getPrintLog(): PrintJob[] {
  return [..._log];
}

export function onPrintLogChange(fn: (log: PrintJob[]) => void): () => void {
  _logListeners.push(fn);
  return () => {
    const idx = _logListeners.indexOf(fn);
    if (idx >= 0) _logListeners.splice(idx, 1);
  };
}

// ─── Queue processing (per-station) ────────────

async function processStationQueue(stationId: string) {
  if (_processing.has(stationId)) return;
  _processing.add(stationId);

  const queue = _queues.get(stationId);
  if (!queue) { _processing.delete(stationId); return; }

  while (queue.length > 0) {
    const job = queue[0];
    job.status = 'printing';
    pushLog(job);

    let success = false;
    for (let attempt = 1; attempt <= job.maxAttempts; attempt++) {
      job.attempts = attempt;
      try {
        await printRaw(job.stationId, job.data);
        success = true;
        break;
      } catch (err) {
        job.error = err instanceof Error ? err.message : String(err);
        if (attempt < job.maxAttempts) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
        }
      }
    }

    job.completedAt = new Date();
    job.status = success ? 'success' : 'failed';
    pushLog(job);

    if (success) {
      recordFingerprint(job.fingerprint);
    }

    queue.shift();
  }

  _queues.delete(stationId);
  _processing.delete(stationId);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Public API ────────────────────────────────

/**
 * Enqueue a print job. Returns false if deduplicated (skipped).
 * Each station has its own queue — different printers process in parallel.
 */
export function enqueue(
  stationId: string,
  data: number[],
  fingerprint: string,
): boolean {
  if (isDuplicate(fingerprint)) {
    console.log(`[PrintManager] Dedup skip: ${fingerprint}`);
    return false;
  }

  const job: PrintJob = {
    id: `pj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    stationId,
    data,
    fingerprint,
    status: 'pending',
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    createdAt: new Date(),
  };

  if (!_queues.has(stationId)) _queues.set(stationId, []);
  _queues.get(stationId)!.push(job);
  pushLog(job);
  processStationQueue(stationId); // fire-and-forget, sequential within station

  return true;
}

// ─── Category routing helper ───────────────────

/**
 * Split items by category → stationId using the provided routing config.
 * Items whose category has no routing go to `defaultStationId`.
 */
export function routeItemsByCategory<T extends { menuItem: { categoryId: string } }>(
  items: T[],
  defaultStationId: string,
  categoryRouting: Record<string, string> = {},
): Record<string, T[]> {
  const result: Record<string, T[]> = {};

  for (const item of items) {
    const stationId = categoryRouting[item.menuItem.categoryId] || defaultStationId;
    if (!result[stationId]) result[stationId] = [];
    result[stationId].push(item);
  }

  return result;
}
