/**
 * Print Manager — production-grade print queue with:
 * - Sequential processing (prevents garbled concurrent prints)
 * - Retry with exponential backoff (3 attempts)
 * - Fingerprint-based deduplication (10s TTL)
 * - Print job status tracking with listener pattern
 * - Category-based item routing to kitchen/bar printers
 */

import { printRaw, PrinterRole, getCategoryRouting } from './qz-tray';

// ─── Types ─────────────────────────────────────

export type PrintJobStatus = 'pending' | 'printing' | 'success' | 'failed';

export interface PrintJob {
  id: string;
  role: PrinterRole;
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

// ─── State ─────────────────────────────────────

const _queue: PrintJob[] = [];
let _processing = false;
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

// ─── Queue processing ──────────────────────────

async function processQueue() {
  if (_processing) return;
  _processing = true;

  while (_queue.length > 0) {
    const job = _queue[0];
    job.status = 'printing';
    pushLog(job);

    let success = false;
    for (let attempt = 1; attempt <= job.maxAttempts; attempt++) {
      job.attempts = attempt;
      try {
        await printRaw(job.role, job.data);
        success = true;
        break;
      } catch (err) {
        job.error = err instanceof Error ? err.message : String(err);
        if (attempt < job.maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
        }
      }
    }

    job.completedAt = new Date();
    job.status = success ? 'success' : 'failed';
    pushLog(job);

    // Record fingerprint on success to prevent immediate re-print
    if (success) {
      recordFingerprint(job.fingerprint);
    }

    _queue.shift();
  }

  _processing = false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Public API ────────────────────────────────

/**
 * Enqueue a print job. Returns false if deduplicated (skipped).
 */
export function enqueue(
  role: PrinterRole,
  data: number[],
  fingerprint: string,
): boolean {
  // Dedup check
  if (isDuplicate(fingerprint)) {
    console.log(`[PrintManager] Dedup skip: ${fingerprint}`);
    return false;
  }

  const job: PrintJob = {
    id: `pj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role,
    data,
    fingerprint,
    status: 'pending',
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    createdAt: new Date(),
  };

  _queue.push(job);
  pushLog(job);
  processQueue(); // fire-and-forget, sequential processing guaranteed

  return true;
}

// ─── Category routing helper ───────────────────

export interface RoutedItems<T> {
  kitchen: T[];
  bar: T[];
  unrouted: T[];
}

/**
 * Split items by category → printer role using the routing config.
 * Items whose category has no routing go to `unrouted` (defaults to kitchen).
 */
export function routeItemsByCategory<T extends { menuItem: { categoryId: string } }>(
  items: T[],
): RoutedItems<T> {
  const routing = getCategoryRouting();
  const result: RoutedItems<T> = { kitchen: [], bar: [], unrouted: [] };

  for (const item of items) {
    const role = routing[item.menuItem.categoryId];
    if (role === 'bar') {
      result.bar.push(item);
    } else if (role === 'kitchen') {
      result.kitchen.push(item);
    } else {
      result.unrouted.push(item);
    }
  }

  return result;
}
