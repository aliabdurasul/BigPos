/**
 * QZ Tray connection manager.
 * Handles websocket connection, printer enumeration, role-based config,
 * category routing, and raw ESC/POS dispatch.
 */

/* global qz */
declare const qz: any;

// ─── Types ─────────────────────────────────────

export type PrinterRole = 'receipt' | 'kitchen' | 'bar';
export type QZConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface PrinterConfig {
  receipt?: string;
  kitchen?: string;
  bar?: string;
}

// ─── Storage keys ──────────────────────────────

const PRINTER_KEY = 'bigpos_printers';
const ROUTING_KEY = 'bigpos_category_routing';

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

// ─── Printer role config (localStorage) ────────

function loadConfig(): PrinterConfig {
  try {
    return JSON.parse(localStorage.getItem(PRINTER_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveConfig(cfg: PrinterConfig) {
  localStorage.setItem(PRINTER_KEY, JSON.stringify(cfg));
}

export function getPrinterForRole(role: PrinterRole): string | null {
  return loadConfig()[role] || null;
}

export function setPrinter(role: PrinterRole, name: string) {
  const cfg = loadConfig();
  cfg[role] = name;
  saveConfig(cfg);
}

export function getAllPrinterAssignments(): PrinterConfig {
  return loadConfig();
}

// ─── Category routing config ───────────────────

export function getCategoryRouting(): Record<string, PrinterRole> {
  try {
    return JSON.parse(localStorage.getItem(ROUTING_KEY) || '{}');
  } catch {
    return {};
  }
}

export function setCategoryRoute(categoryId: string, role: PrinterRole) {
  const map = getCategoryRouting();
  map[categoryId] = role;
  localStorage.setItem(ROUTING_KEY, JSON.stringify(map));
}

export function removeCategoryRoute(categoryId: string) {
  const map = getCategoryRouting();
  delete map[categoryId];
  localStorage.setItem(ROUTING_KEY, JSON.stringify(map));
}

// ─── Raw print dispatch ────────────────────────

export async function printRaw(role: PrinterRole, data: number[]): Promise<void> {
  if (!isQZAvailable() || !qz.websocket.isActive()) {
    throw new Error('QZ Tray not connected');
  }
  const printerName = getPrinterForRole(role);
  if (!printerName) {
    throw new Error(`No printer assigned for role: ${role}`);
  }
  const config = qz.configs.create(printerName);
  const printData = [{ type: 'raw', format: 'command', data, options: { language: 'ESCPOS' } }];
  await qz.print(config, printData);
}
