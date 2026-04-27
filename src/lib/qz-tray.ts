/**
 * QZ Tray connection manager (optional fallback path).
 *
 * QZ Tray is no longer the primary print path — the local BigPOS agent handles
 * printing via Supabase `print_jobs`. This module is kept as an optional
 * browser→printer bridge for environments that still need it (e.g., legacy setups).
 *
 * Printer config is now stored in Supabase (`printers` + `printer_category_routes`),
 * not in localStorage. The localStorage-based functions have been removed.
 */

/* global qz */
declare const qz: any;

import { supabase } from './supabase';
import type { DbPrinter, PrinterCategoryRoute } from '@/types/pos';

// ─── Types ─────────────────────────────────────

export type QZConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ─── State ─────────────────────────────────────

let _status: QZConnectionStatus = 'disconnected';
let _lastError: string | null = null;
const _listeners: Array<(s: QZConnectionStatus) => void> = [];

function setStatus(s: QZConnectionStatus) {
  _status = s;
  _listeners.forEach(fn => fn(s));
}

export function getQZStatus(): QZConnectionStatus {
  return _status;
}

export function getQZError(): string | null {
  return _lastError;
}

export function isQZLoaded(): boolean {
  return typeof qz !== 'undefined' && !!qz?.websocket;
}

export function onQZStatusChange(fn: (s: QZConnectionStatus) => void): () => void {
  _listeners.push(fn);
  return () => {
    const idx = _listeners.indexOf(fn);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

// ─── Connection ────────────────────────────────

const CONNECT_TIMEOUT_MS = 10_000;

function isQZAvailable(): boolean {
  return typeof qz !== 'undefined' && !!qz?.websocket;
}

export async function connectQZ(): Promise<void> {
  _lastError = null;

  if (!isQZAvailable()) {
    _lastError = 'QZ Tray kutuphanesi yuklenemedi. Sayfayi yenileyin.';
    console.warn('[QZ] qz-tray.js not loaded');
    setStatus('error');
    return;
  }
  if (qz.websocket.isActive()) {
    setStatus('connected');
    return;
  }
  setStatus('connecting');
  try {
    // Enable verbose QZ websocket logging in browser console
    if (qz.api?.showDebug) qz.api.showDebug(true);

    // Certificate: empty = unsigned. QZ Tray will show a trust dialog on non-localhost origins.
    qz.security.setCertificatePromise(() =>
      Promise.resolve('')
    );
    qz.security.setSignatureAlgorithm('SHA512');
    qz.security.setSignaturePromise(() => (resolve: (v: string) => void) => resolve(''));

    // Race connection against timeout
    const connectPromise = qz.websocket.connect({ retries: 3, delay: 1 });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('__TIMEOUT__')), CONNECT_TIMEOUT_MS)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    _lastError = null;
    setStatus('connected');

    qz.websocket.setClosedCallbacks(() => {
      setStatus('disconnected');
      // Auto-reconnect after 5s
      setTimeout(() => {
        if (_status === 'disconnected') connectQZ();
      }, 5000);
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[QZ] Connection failed:', msg);

    if (msg === '__TIMEOUT__') {
      _lastError = 'Baglanti zaman asimina ugradi. QZ Tray programinin arka planda calistigindan emin olun.';
    } else if (msg.includes('Unable to establish')) {
      _lastError = 'QZ Tray programi bulunamadi. Programin bilgisayarda kurulu ve acik oldugunu kontrol edin.';
    } else {
      _lastError = `Baglanti basarisiz: ${msg}`;
    }
    setStatus('error');
  }
}

export async function disconnectQZ(): Promise<void> {
  if (!isQZAvailable() || !qz.websocket.isActive()) return;
  try {
    await qz.websocket.disconnect();
  } catch {
    // ignore
  }
  setStatus('disconnected');
}

// ─── Printer discovery ─────────────────────────

export async function getPrinters(): Promise<string[]> {
  if (!isQZAvailable() || !qz.websocket.isActive()) return [];
  try {
    return await qz.printers.find();
  } catch {
    return [];
  }
}

// ─── DB-backed printer config ──────────────────

/**
 * Fetch all active printers for a restaurant from Supabase.
 * Used by the admin UI — not by the print path (that goes via print_jobs).
 */
export async function fetchPrinters(restaurantId: string): Promise<DbPrinter[]> {
  const { data, error } = await supabase
    .from('printers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[qz-tray] fetchPrinters error:', error.message);
    return [];
  }
  return (data ?? []).map(row => ({
    id:             row.id,
    restaurantId:   row.restaurant_id,
    agentId:        row.agent_id,
    name:           row.name,
    stationType:    row.station_type,
    ipAddress:      row.ip_address,
    port:           row.port,
    paperWidth:     row.paper_width,
    status:         row.status,
    lastPingOkAt:   row.last_ping_ok_at,
    errorMessage:   row.error_message,
    active:         row.active,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  })) as DbPrinter[];
}

/**
 * Fetch category → printer routing rules for a restaurant.
 * Returns a map of categoryId → printerId.
 */
export async function fetchCategoryRouting(restaurantId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('printer_category_routes')
    .select('category_id, printer_id')
    .eq('restaurant_id', restaurantId);

  if (error) {
    console.error('[qz-tray] fetchCategoryRouting error:', error.message);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.category_id] = row.printer_id;
  }
  return map;
}

/**
 * Save a category → printer routing rule to the DB.
 * Upserts: one rule per (restaurant_id, category_id).
 */
export async function setCategoryRoute(restaurantId: string, categoryId: string, printerId: string): Promise<void> {
  const { error } = await supabase
    .from('printer_category_routes')
    .upsert(
      { restaurant_id: restaurantId, category_id: categoryId, printer_id: printerId },
      { onConflict: 'restaurant_id,category_id' },
    );
  if (error) console.error('[qz-tray] setCategoryRoute error:', error.message);
}

/**
 * Remove a category routing rule.
 */
export async function removeCategoryRoute(restaurantId: string, categoryId: string): Promise<void> {
  const { error } = await supabase
    .from('printer_category_routes')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('category_id', categoryId);
  if (error) console.error('[qz-tray] removeCategoryRoute error:', error.message);
}

// ─── Raw print dispatch (legacy/fallback) ─────

/**
 * @deprecated The primary print path now uses Supabase print_jobs + the local agent.
 * This function remains for legacy environments that still use QZ Tray directly.
 * To use, the caller must pass the QZ Tray printer name explicitly.
 */
export async function printRaw(printerName: string, data: number[]): Promise<void> {
  if (!isQZAvailable() || !qz.websocket.isActive()) {
    throw new Error('QZ Tray not connected');
  }
  if (!printerName) {
    throw new Error('No printer name provided for printRaw');
  }
  const config = qz.configs.create(printerName);
  const printData = [{ type: 'raw', format: 'command', data, options: { language: 'ESCPOS' } }];
  await qz.print(config, printData);
}
