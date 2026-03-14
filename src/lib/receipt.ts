/**
 * Thermal receipt formatters for ESC/POS printers.
 * Width: 32 chars (58mm safe). Works on 80mm too.
 *
 * FUTURE: Add KDV OZETI section when VAT is implemented.
 * Each receipt type has a marked placeholder for it.
 */

const W = 32;
const SEP = '-'.repeat(W);

function center(text: string): string {
  const pad = Math.max(0, Math.floor((W - text.length) / 2));
  return ' '.repeat(pad) + text;
}

function row(label: string, value: string): string {
  const gap = W - label.length - value.length;
  if (gap < 1) return label + ' ' + value;
  return label + ' '.repeat(gap) + value;
}

function fmtTL(amount: number): string {
  return amount.toLocaleString('tr-TR') + ' TL';
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// ═══════════════════════════════════════
// 1. CUSTOMER ADISYON (Table Bill)
// ═══════════════════════════════════════

export interface AdisyonData {
  restaurantName: string;
  tableName: string;
  staffName: string;
  date: Date;
  items: { name: string; qty: number; unitPrice: number }[];
  total: number;
  // FUTURE: vatLines?: { rate: number; amount: number }[];
}

export function formatAdisyon(data: AdisyonData): string {
  const lines: string[] = [];

  lines.push(center(data.restaurantName.toUpperCase()));
  lines.push('');
  lines.push(SEP);
  lines.push(row('Tarih:', fmtDate(data.date)));
  lines.push(row('Saat:', fmtTime(data.date)));
  lines.push(row('Masa:', data.tableName));
  lines.push(row('Garson:', data.staffName));
  lines.push(SEP);

  for (const item of data.items) {
    const lineTotal = item.qty * item.unitPrice;
    const label = `${item.qty}x ${item.name}`;
    const val = fmtTL(lineTotal);
    if (label.length + val.length + 1 > W) {
      lines.push(label);
      lines.push(row('', val));
    } else {
      lines.push(row(label, val));
    }
  }

  lines.push(SEP);
  lines.push(row('TOPLAM', fmtTL(data.total)));
  lines.push('');
  lines.push(center('Tesekkur ederiz!'));
  lines.push('');

  return lines.join('\n');
}

// ═══════════════════════════════════════
// 2. KITCHEN ORDER TICKET
// ═══════════════════════════════════════

export interface KitchenTicketData {
  tableName: string;
  staffName?: string;
  orderNumber?: string;        // short ID shown as #XXXX
  date: Date;
  items: { name: string; qty: number; modifiers?: string[]; note?: string }[];
  orderNote?: string;
  restaurantName?: string;
}

export function formatKitchenTicket(data: KitchenTicketData): string {
  const lines: string[] = [];
  const THICK = '='.repeat(W);

  lines.push(THICK);
  if (data.restaurantName) {
    lines.push(center(data.restaurantName.toUpperCase()));
  }

  // Table name left, order # right on same line
  const orderTag = data.orderNumber ? `#${data.orderNumber}` : '';
  lines.push(row(data.tableName, orderTag));
  // Time right-aligned
  lines.push(row('', fmtTime(data.date)));

  lines.push(SEP);

  for (const item of data.items) {
    lines.push(`${item.qty}x  ${item.name}`);
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        lines.push(`    + ${mod}`);
      }
    }
  }

  // Aggregate all item notes + optional order note at the bottom
  const allNotes: string[] = [];
  if (data.orderNote) allNotes.push(data.orderNote);
  data.items.forEach(i => { if (i.note) allNotes.push(i.note); });
  if (allNotes.length > 0) {
    lines.push('');
    lines.push('Not: ' + allNotes.join(', '));
  }

  lines.push(SEP);
  lines.push('');
  return lines.join('\n');
}

// ═══════════════════════════════════════
// 3. END OF DAY REPORT (Gun Sonu Fisi)
// ═══════════════════════════════════════

export interface GunSonuData {
  restaurantName: string;
  date: Date;
  closedBy: string;
  totalRevenue: number;
  cashTotal: number;
  cardTotal: number;
  totalOrders: number;
  cashTransactions: number;
  cardTransactions: number;
  emptyTables: number;
  occupiedTables: number;
  waitingPaymentTables: number;
  topProducts: { name: string; count: number }[];
  // FUTURE: vatSummary?: { rate: number; amount: number }[];
}

export function formatGunSonu(data: GunSonuData): string {
  const lines: string[] = [];

  lines.push(center(data.restaurantName.toUpperCase()));
  lines.push(center('GUN SONU RAPORU'));
  lines.push('');
  lines.push(SEP);
  lines.push(row('Tarih :', fmtDate(data.date)));
  lines.push(row('Saat  :', fmtTime(data.date)));
  lines.push(row('Kapatan:', data.closedBy));
  lines.push(SEP);

  lines.push('');
  lines.push('TOPLAM CIRO');
  lines.push(row('Toplam Satis :', fmtTL(data.totalRevenue)));
  lines.push('');
  lines.push(SEP);

  lines.push('');
  lines.push('ODEME DETAYI');
  lines.push(row('Nakit        :', fmtTL(data.cashTotal)));
  lines.push(row('Kredi Karti  :', fmtTL(data.cardTotal)));
  lines.push('');
  lines.push(SEP);

  // FUTURE: KDV OZETI section here
  // lines.push('');
  // lines.push('KDV OZETI');
  // for (const v of data.vatSummary) {
  //   lines.push(row(`KDV %${v.rate} :`, fmtTL(v.amount)));
  // }
  // lines.push(SEP);

  lines.push('');
  lines.push('SATIS ISTATISTIK');
  lines.push(row('Toplam Siparis :', String(data.totalOrders)));
  lines.push(row('Nakit Islem    :', String(data.cashTransactions)));
  lines.push(row('Kart Islem     :', String(data.cardTransactions)));
  lines.push('');
  lines.push(SEP);

  if (data.topProducts.length > 0) {
    lines.push('');
    lines.push('EN COK SATILAN');
    for (const p of data.topProducts) {
      lines.push(row(p.name, `${p.count} ad.`));
    }
    lines.push('');
    lines.push(SEP);
  }

  lines.push('');
  lines.push('MASA DURUMU');
  lines.push(row('Bos Masalar    :', String(data.emptyTables)));
  lines.push(row('Dolu Masalar   :', String(data.occupiedTables)));
  if (data.waitingPaymentTables > 0) {
    lines.push(row('Odeme Bekliyor :', String(data.waitingPaymentTables)));
  }
  lines.push('');
  lines.push(SEP);

  lines.push('');
  lines.push(center('*** GUN SONU KAPANDI ***'));
  lines.push('');

  return lines.join('\n');
}

// ═══════════════════════════════════════
// Print helper — opens window and prints monospace text
// ═══════════════════════════════════════

export function printReceipt(text: string, title: string = 'Fis') {
  const printWindow = window.open('', '_blank', 'width=350,height=600');
  if (!printWindow) return;

  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  printWindow.document.write(`<!DOCTYPE html>
<html><head><title>${safeTitle}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.4;
    padding: 8px;
    width: 58mm;
    color: #000;
    white-space: pre;
  }
  @media print {
    body { width: 58mm; padding: 2mm; }
    @page { margin: 0; size: 58mm auto; }
  }
</style></head>
<body>${escaped}</body></html>`);
  printWindow.document.close();
  // Non-blocking: let the browser render before printing
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 0);
}
