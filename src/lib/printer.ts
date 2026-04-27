/**
 * High-level print functions.
 *
 * Builds structured JSON payloads and dispatches them to Supabase `print_jobs`.
 * The local agent receives these jobs, renders ESC/POS bytes, and sends to the printer.
 *
 * No ESC/POS bytes are produced here anymore — the agent owns that responsibility.
 */

import { enqueuePrintJob, buildFingerprint, routeItemsByPrinter } from './print-manager';
import { OrderItem, Payment, ReceiptSettings, PrinterSettings, DEFAULT_RECEIPT_SETTINGS, DEFAULT_PRINTER_SETTINGS } from '@/types/pos';

// ─── Helpers ───────────────────────────────────

function fmtTL(amount: number): string {
  return amount.toLocaleString('tr-TR') + ' TL';
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function itemTotal(item: OrderItem): number {
  const modExtra = item.modifiers.reduce((s, m) => s + m.extraPrice, 0);
  return (item.menuItem.price + modExtra) * item.quantity;
}

// ─── Kitchen Ticket ────────────────────────────

export interface KitchenPrintData {
  restaurantId: string;
  tableName:    string;
  tableId:      string;
  staffName?:   string;
  orderId:      string;
  orderNumber?: string;
  items:        OrderItem[];
  orderNote?:   string;
}

/**
 * Print kitchen ticket — routes items by category to prep printers.
 * Uses DB-backed `categoryRouting` (categoryId → printerId).
 */
export async function printKitchenTicket(data: KitchenPrintData, config?: PrinterSettings): Promise<void> {
  const cfg = config || DEFAULT_PRINTER_SETTINGS;
  const defaultPrepId = cfg.defaultPrepStationId
    || cfg.stations.find(s => s.purpose === 'prep' && s.isDefault)?.id
    || 'kitchen';

  const routed = routeItemsByPrinter(data.items, defaultPrepId, cfg.categoryRouting || {});

  for (const [printerId, items] of Object.entries(routed)) {
    if (items.length === 0) continue;

    const fp = buildFingerprint('kitchen', `${data.orderId}:${printerId}`);

    const payload = {
      orderNumber: data.orderNumber || data.orderId.slice(0, 8),
      tableName:   data.tableName,
      tableId:     data.tableId,
      staffName:   data.staffName,
      items: items.map(item => ({
        name:     item.menuItem.name,
        quantity: item.quantity,
        note:     item.note,
        modifiers: item.modifiers.map(m => ({
          group:      m.groupName,
          option:     m.optionName,
          extraPrice: m.extraPrice,
        })),
      })),
      timestamp: new Date().toISOString(),
    };

    await enqueuePrintJob({
      restaurantId: data.restaurantId,
      printerId,
      jobType:     'kitchen',
      payload,
      fingerprint: fp,
      orderId:     data.orderId,
    });
  }
}

// ─── Payment Receipt ───────────────────────────

export interface ReceiptPrintData {
  restaurantId:   string;
  restaurantName: string;
  tableName:      string;
  staffName?:     string;
  items:          OrderItem[];
  total:          number;
  payments:       Payment[];
  change?:        number;
  discountAmount?:  number;
  discountReason?:  string;
  orderIds:       string[];
  logoText?:      string;
  headerText?:    string;
}

export async function printPaymentReceipt(data: ReceiptPrintData, config?: PrinterSettings): Promise<void> {
  const cfg = config || DEFAULT_PRINTER_SETTINGS;
  const s: ReceiptSettings = cfg.receiptSettings || DEFAULT_RECEIPT_SETTINGS;
  const receiptPrinterId = cfg.stations.find(st => st.purpose === 'receipt')?.id || 'receipt';

  const fp = buildFingerprint('receipt', data.orderIds.join('-'));

  const payload = {
    orderNumber:  data.orderIds[0]?.slice(0, 8) ?? '?',
    tableName:    data.tableName,
    items: data.items.map(item => ({
      name:      item.menuItem.name,
      quantity:  item.quantity,
      unitPrice: item.menuItem.price,
      modifiers: item.modifiers.map(m => ({
        group:      m.groupName,
        option:     m.optionName,
        extraPrice: m.extraPrice,
      })),
    })),
    subtotal:     data.items.reduce((sum, i) => sum + itemTotal(i), 0),
    discount:     data.discountAmount ?? 0,
    discountNote: data.discountReason,
    total:        data.total,
    payments: data.payments.map(p => ({
      method: p.method,
      amount: p.amount,
    })),
    staffName:  data.staffName,
    logoText:   s.logoText || data.restaurantName,
    headerText: s.headerText,
    footerText: s.footerText || 'Teşekkür ederiz!',
    paperWidth: s.paperWidth,
    openDrawer: s.openDrawer,
    timestamp:  new Date().toISOString(),
  };

  const copies = s.copies || 1;
  for (let i = 0; i < copies; i++) {
    await enqueuePrintJob({
      restaurantId: data.restaurantId,
      printerId:    receiptPrinterId,
      jobType:      'receipt',
      payload,
      fingerprint:  i === 0 ? fp : `${fp}:copy${i}`,
      orderId:      data.orderIds[0],
    });
  }
}

// ─── Adisyon Print ─────────────────────────────

export interface AdisyonPrintData {
  restaurantId:   string;
  restaurantName: string;
  tableName:      string;
  staffName:      string;
  items: { name: string; qty: number; unitPrice: number }[];
  total:          number;
  paymentMethod?: string;
  paidAmount?:    number;
  remainingAmount?: number;
}

export async function printAdisyon(data: AdisyonPrintData, config?: PrinterSettings): Promise<void> {
  const cfg = config || DEFAULT_PRINTER_SETTINGS;
  const s: ReceiptSettings = cfg.receiptSettings || DEFAULT_RECEIPT_SETTINGS;
  const receiptPrinterId = cfg.stations.find(st => st.purpose === 'receipt')?.id || 'receipt';

  const fp = buildFingerprint('adisyon', `${data.tableName}_${Date.now()}`);

  const payload = {
    orderNumber:  fp.slice(-8),
    tableName:    data.tableName,
    items: data.items.map(item => ({
      name:      item.name,
      quantity:  item.qty,
      unitPrice: item.unitPrice,
      modifiers: [],
    })),
    subtotal:     data.total,
    total:        data.total,
    payments: data.paymentMethod ? [{ method: data.paymentMethod, amount: data.paidAmount ?? data.total }] : [],
    staffName:    data.staffName,
    logoText:     data.restaurantName,
    footerText:   s.footerText || 'Teşekkür ederiz!',
    paperWidth:   s.paperWidth,
    openDrawer:   false,
    timestamp:    new Date().toISOString(),
  };

  await enqueuePrintJob({
    restaurantId: data.restaurantId,
    printerId:    receiptPrinterId,
    jobType:      'receipt',
    payload,
    fingerprint:  fp,
  });
}

// ─── Test Print ────────────────────────────────

export async function testPrint(printerId: string, restaurantId: string): Promise<void> {
  const fp = buildFingerprint('test', `${printerId}_${Date.now()}`);
  await enqueuePrintJob({
    restaurantId,
    printerId,
    jobType:     'test',
    payload:     { timestamp: new Date().toISOString() },
    fingerprint: fp,
  });
}

// ─── End of Day Report ─────────────────────────

export interface EndOfDayPrintData {
  restaurantId:   string;
  restaurantName: string;
  date:           Date;
  closedBy:       string;
  totalRevenue:   number;
  cashTotal:      number;
  cardTotal:      number;
  totalOrders:    number;
  topProducts:    { name: string; count: number }[];
}

export async function printEndOfDayReport(data: EndOfDayPrintData, config?: PrinterSettings): Promise<void> {
  const cfg = config || DEFAULT_PRINTER_SETTINGS;
  const s: ReceiptSettings = cfg.receiptSettings || DEFAULT_RECEIPT_SETTINGS;
  const receiptPrinterId = cfg.stations.find(st => st.purpose === 'receipt')?.id || 'receipt';

  const fp = buildFingerprint('eod', fmtDate(data.date));

  const payload = {
    orderNumber:  'EOD',
    tableName:    'Gün Sonu Raporu',
    items: [
      { name: 'Toplam Satış',   quantity: 1, unitPrice: data.totalRevenue, modifiers: [] },
      { name: 'Nakit',          quantity: 1, unitPrice: data.cashTotal,    modifiers: [] },
      { name: 'Kredi Kartı',    quantity: 1, unitPrice: data.cardTotal,    modifiers: [] },
      { name: 'Toplam Sipariş', quantity: data.totalOrders, unitPrice: 0,  modifiers: [] },
    ],
    subtotal:   data.totalRevenue,
    total:      data.totalRevenue,
    payments:   [],
    staffName:  data.closedBy,
    logoText:   data.restaurantName,
    footerText: '*** GÜN SONU KAPANDI ***',
    paperWidth: s.paperWidth,
    openDrawer: false,
    timestamp:  data.date.toISOString(),
  };

  await enqueuePrintJob({
    restaurantId: data.restaurantId,
    printerId:    receiptPrinterId,
    jobType:      'receipt',
    payload,
    fingerprint:  fp,
  });
}
