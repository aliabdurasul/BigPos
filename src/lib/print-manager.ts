/**
 * Print Manager — dispatches structured print jobs to Supabase `print_jobs` table.
 *
 * The local agent polls that table, renders ESC/POS bytes, and sends them to
 * the printer via TCP :9100. This module owns the cloud-side enqueue logic only.
 *
 * - Fingerprint-based deduplication (5 min TTL enforced by DB function)
 * - Optimistic local log for UI feedback (mirrors DB status via Realtime)
 * - Category → printer routing using DB-backed routes
 */

import { supabase } from './supabase';
import type { DbPrintJob } from '@/types/pos';

// ─── Types ─────────────────────────────────────

/** Lightweight job record kept for UI display only */
export interface PrintJob {
  id: string;
  printerId: string;
  jobType: string;
  fingerprint: string | null;
  status: 'pending' | 'dispatched' | 'printing' | 'done' | 'failed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

// ─── State ─────────────────────────────────────

const MAX_LOG_SIZE = 200;
const _log: PrintJob[] = [];
const _logListeners: Array<(log: PrintJob[]) => void> = [];

// ─── Log / listeners ───────────────────────────

function pushLog(job: PrintJob) {
  const existing = _log.findIndex(j => j.id === job.id);
  if (existing >= 0) {
    _log[existing] = { ..._log[existing], ...job };
  } else {
    _log.unshift({ ...job });
    if (_log.length > MAX_LOG_SIZE) _log.length = MAX_LOG_SIZE;
  }
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

// ─── Build fingerprint ─────────────────────────

/** Build a dedup fingerprint from type + context id */
export function buildFingerprint(type: string, id: string): string {
  return `${type}:${id}`;
}

// ─── Core enqueue ──────────────────────────────

/**
 * Enqueue a structured print job to Supabase.
 * The `payload` must be a serialisable object that the agent can render.
 *
 * Returns the new job id on success, null if an error occurs.
 * Deduplication is handled server-side via `enqueue_print_job()`.
 */
export async function enqueuePrintJob(params: {
  restaurantId: string;
  printerId:    string;
  jobType:      'kitchen' | 'receipt' | 'label' | 'test';
  payload:      Record<string, unknown>;
  fingerprint:  string;
  orderId?:     string;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc('enqueue_print_job', {
    p_restaurant_id: params.restaurantId,
    p_printer_id:    params.printerId,
    p_job_type:      params.jobType,
    p_payload:       params.payload,
    p_fingerprint:   params.fingerprint,
    p_order_id:      params.orderId ?? null,
  });

  if (error) {
    console.error('[PrintManager] enqueue error:', error.message);
    return null;
  }

  const jobId = data as string;

  const logEntry: PrintJob = {
    id:          jobId,
    printerId:   params.printerId,
    jobType:     params.jobType,
    fingerprint: params.fingerprint,
    status:      'pending',
    createdAt:   new Date(),
  };
  pushLog(logEntry);

  return jobId;
}

// ─── Realtime job status sync ──────────────────

/**
 * Subscribe to print_jobs realtime updates for a restaurant.
 * Updates the local log so the UI reflects live status changes.
 * Returns an unsubscribe function.
 */
export function subscribePrintJobUpdates(restaurantId: string): () => void {
  const channel = supabase
    .channel(`print_jobs:${restaurantId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'print_jobs',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      (payload) => {
        const row = payload.new as DbPrintJob | undefined;
        if (!row) return;

        const logEntry: PrintJob = {
          id:          row.id,
          printerId:   row.printerId,
          jobType:     row.jobType,
          fingerprint: row.fingerprint,
          status:      row.status as PrintJob['status'],
          createdAt:   new Date(row.createdAt),
          completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
          error:       row.errorLog?.at(-1)?.error,
        };
        pushLog(logEntry);
      },
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ─── Category routing helper ───────────────────

/**
 * Split items by category → printerId using the DB-backed routing map.
 * Items whose category has no routing go to `defaultPrinterId`.
 */
export function routeItemsByPrinter<T extends { menuItem: { categoryId: string } }>(
  items: T[],
  defaultPrinterId: string,
  categoryRouting: Record<string, string> = {},
): Record<string, T[]> {
  const result: Record<string, T[]> = {};

  for (const item of items) {
    const printerId = categoryRouting[item.menuItem.categoryId] || defaultPrinterId;
    if (!result[printerId]) result[printerId] = [];
    result[printerId].push(item);
  }

  return result;
}

/**
 * @deprecated Use `routeItemsByPrinter` with DB-backed routes instead.
 * Kept for backwards compatibility with legacy station-id routing.
 */
export function routeItemsByCategory<T extends { menuItem: { categoryId: string } }>(
  items: T[],
  defaultStationId: string,
  categoryRouting: Record<string, string> = {},
): Record<string, T[]> {
  return routeItemsByPrinter(items, defaultStationId, categoryRouting);
}
