/**
 * High-level print functions.
 * Builds ESC/POS commands and dispatches via print-manager queue.
 */

import { ESCPOSBuilder } from './escpos';
import { PrinterRole } from './qz-tray';
import { enqueue, buildFingerprint, routeItemsByCategory } from './print-manager';
import { OrderItem, Payment } from '@/types/pos';

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
  tableName: string;
  staffName?: string;
  orderId: string;
  items: OrderItem[];
  orderNote?: string;
  restaurantName?: string;
}

function buildKitchenESCPOS(data: KitchenPrintData, items: OrderItem[]): number[] {
  const b = new ESCPOSBuilder(80);

  b.bold(true).doubleHeight(true);
  b.center(data.tableName);
  b.doubleHeight(false).bold(false);

  if (data.restaurantName) {
    b.centerOn().center(data.restaurantName.toUpperCase()).leftAlign();
  }

  b.row('', fmtTime(new Date()));
  if (data.staffName) b.row('Garson:', data.staffName);
  b.separator('=');

  for (const item of items) {
    b.bold(true).text(`${item.quantity}x  ${item.menuItem.name}`).bold(false);
    for (const mod of item.modifiers) {
      b.text(`    + ${mod.optionName}`);
    }
    if (item.note) {
      b.text(`    * ${item.note}`);
    }
  }

  if (data.orderNote) {
    b.separator();
    b.text(`Not: ${data.orderNote}`);
  }

  b.separator('=');
  b.cut();

  return b.build();
}

/**
 * Print kitchen ticket — routes items by category to kitchen/bar printers.
 * Filters out non-new items automatically.
 */
export function printKitchenTicket(data: KitchenPrintData): void {
  const fp = buildFingerprint('kitchen', data.orderId);
  const routed = routeItemsByCategory(data.items);

  // Kitchen items (routed + unrouted default to kitchen)
  const kitchenItems = [...routed.kitchen, ...routed.unrouted];
  if (kitchenItems.length > 0) {
    const escpos = buildKitchenESCPOS(data, kitchenItems);
    enqueue('kitchen', escpos, fp + ':kitchen');
  }

  // Bar items
  if (routed.bar.length > 0) {
    const escpos = buildKitchenESCPOS(data, routed.bar);
    enqueue('bar', escpos, fp + ':bar');
  }
}

// ─── Payment Receipt ───────────────────────────

export interface ReceiptPrintData {
  restaurantName: string;
  tableName: string;
  staffName?: string;
  items: OrderItem[];
  total: number;
  payments: Payment[];
  change?: number;
  discountAmount?: number;
  discountReason?: string;
  orderIds: string[];
}

function buildReceiptESCPOS(data: ReceiptPrintData): number[] {
  const b = new ESCPOSBuilder(80);

  b.centerOn();
  b.bold(true).text(data.restaurantName.toUpperCase()).bold(false);
  b.leftAlign();
  b.text('');

  b.separator();
  b.row('Tarih:', fmtDate(new Date()));
  b.row('Saat:', fmtTime(new Date()));
  b.row('Masa:', data.tableName);
  if (data.staffName) b.row('Kasiyer:', data.staffName);
  b.separator();

  // Items
  for (const item of data.items) {
    const total = itemTotal(item);
    b.row(`${item.quantity}x ${item.menuItem.name}`, fmtTL(total));
    for (const mod of item.modifiers) {
      if (mod.extraPrice > 0) {
        b.row(`    + ${mod.optionName}`, `+${fmtTL(mod.extraPrice)}`);
      }
    }
  }

  b.separator();

  // Discount
  if (data.discountAmount && data.discountAmount > 0) {
    const reason = data.discountReason || 'Indirim';
    b.row(reason, `-${fmtTL(data.discountAmount)}`);
  }

  b.bold(true).row('TOPLAM', fmtTL(data.total)).bold(false);

  // Payments breakdown
  if (data.payments.length > 0) {
    b.separator('-');
    for (const p of data.payments) {
      const label = p.method === 'nakit' ? 'Nakit' : p.method === 'kredi_karti' ? 'Kart' : p.method;
      b.row(label, fmtTL(p.amount));
    }
  }

  // Change
  if (data.change && data.change > 0) {
    b.row('Para Ustu', fmtTL(data.change));
  }

  b.text('');
  b.centerOn();
  b.text('Tesekkur ederiz!');
  b.leftAlign();
  b.text('');
  b.cut();
  b.openDrawer();

  return b.build();
}

export function printPaymentReceipt(data: ReceiptPrintData): void {
  const fp = buildFingerprint('receipt', data.orderIds.join('-'));
  const escpos = buildReceiptESCPOS(data);
  enqueue('receipt', escpos, fp);
}

// ─── Test Print ────────────────────────────────

export function testPrint(role: PrinterRole): void {
  const b = new ESCPOSBuilder(80);
  b.centerOn();
  b.bold(true).text('BigPOS TEST PRINT').bold(false);
  b.leftAlign();
  b.separator();
  b.row('Printer Role:', role);
  b.row('Time:', fmtTime(new Date()));
  b.row('Date:', fmtDate(new Date()));
  b.separator();
  b.text('1234567890 ABCDEFGHIJ');
  b.text('Turkish: cigsou CIGSOU');
  b.separator();
  b.centerOn().text('-- OK --').leftAlign();
  b.cut();

  const fp = buildFingerprint('test', `${role}_${Date.now()}`);
  enqueue(role, b.build(), fp);
}

// ─── End of Day Report ─────────────────────────

export interface EndOfDayPrintData {
  restaurantName: string;
  date: Date;
  closedBy: string;
  totalRevenue: number;
  cashTotal: number;
  cardTotal: number;
  totalOrders: number;
  topProducts: { name: string; count: number }[];
}

export function printEndOfDayReport(data: EndOfDayPrintData): void {
  const b = new ESCPOSBuilder(80);

  b.centerOn();
  b.bold(true).text(data.restaurantName.toUpperCase()).bold(false);
  b.text('GUN SONU RAPORU');
  b.leftAlign();
  b.separator('=');

  b.row('Tarih:', fmtDate(data.date));
  b.row('Saat:', fmtTime(data.date));
  b.row('Kapatan:', data.closedBy);
  b.separator();

  b.bold(true).text('TOPLAM CIRO').bold(false);
  b.row('Toplam Satis:', fmtTL(data.totalRevenue));
  b.separator();

  b.bold(true).text('ODEME DETAYI').bold(false);
  b.row('Nakit:', fmtTL(data.cashTotal));
  b.row('Kredi Karti:', fmtTL(data.cardTotal));
  b.separator();

  b.row('Toplam Siparis:', String(data.totalOrders));
  b.separator();

  if (data.topProducts.length > 0) {
    b.bold(true).text('EN COK SATILAN').bold(false);
    for (const p of data.topProducts) {
      b.row(p.name, `${p.count} ad.`);
    }
    b.separator();
  }

  b.text('');
  b.centerOn().bold(true).text('*** GUN SONU KAPANDI ***').bold(false).leftAlign();
  b.cut();

  const fp = buildFingerprint('eod', fmtDate(data.date));
  enqueue('receipt', b.build(), fp);
}
