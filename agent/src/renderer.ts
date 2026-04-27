import { ESCPOSBuilder } from './escpos.js';
import type { KitchenTicketPayload, ReceiptPayload } from './types.js';

// ─── Kitchen Ticket ─────────────────────────────────────────────────────────

export function renderKitchenTicket(data: KitchenTicketPayload, paperWidth: 58 | 80 = 80): Buffer {
  const b = new ESCPOSBuilder(paperWidth);
  const time = new Date(data.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  b.centerOn()
   .bold(true)
   .doubleHeight(true)
   .text('MUTFAK')
   .doubleHeight(false)
   .bold(false)
   .separator()
   .text(`Masa: ${data.tableName}`)
   .text(`Sip: #${data.orderNumber}`)
   .text(`Saat: ${time}`);

  if (data.staffName) {
    b.text(`Garson: ${data.staffName}`);
  }

  b.separator().leftAlign();

  for (const item of data.items) {
    b.bold(true);
    b.text(`${item.quantity}x  ${item.name}`);
    b.bold(false);

    if (item.modifiers && item.modifiers.length > 0) {
      for (const m of item.modifiers) {
        b.text(`   + ${m.option}`);
      }
    }
    if (item.note) {
      b.text(`   NOT: ${item.note}`);
    }
  }

  b.separator().feed(2).cut();
  return b.build();
}

// ─── Payment Receipt ─────────────────────────────────────────────────────────

export function renderReceipt(data: ReceiptPayload): Buffer {
  const b = new ESCPOSBuilder(data.paperWidth);
  const time = new Date(data.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const date = new Date(data.timestamp).toLocaleDateString('tr-TR');

  b.centerOn().bold(true);
  if (data.logoText) b.doubleHeight(true).text(data.logoText).doubleHeight(false);
  if (data.headerText) b.text(data.headerText);
  b.bold(false)
   .text(`${date}  ${time}`)
   .text(`Masa: ${data.tableName}  #${data.orderNumber}`);
  if (data.staffName) b.text(`Garson: ${data.staffName}`);
  b.separator().leftAlign();

  for (const item of data.items) {
    const total = (item.unitPrice * item.quantity).toFixed(2);
    b.row(`${item.quantity}x ${item.name.substring(0, 22)}`, `${total} TL`);
    if (item.modifiers && item.modifiers.length > 0) {
      for (const m of item.modifiers) {
        if (m.extraPrice > 0) {
          b.row(`   + ${m.option}`, `+${m.extraPrice.toFixed(2)} TL`);
        } else {
          b.text(`   + ${m.option}`);
        }
      }
    }
  }

  b.separator();
  b.row('Ara toplam:', `${data.subtotal.toFixed(2)} TL`);

  if (data.discount && data.discount > 0) {
    b.row(`İndirim${data.discountNote ? ' (' + data.discountNote + ')' : ''}:`, `-${data.discount.toFixed(2)} TL`);
  }

  b.bold(true).row('TOPLAM:', `${data.total.toFixed(2)} TL`).bold(false);

  b.separator();
  const methodNames: Record<string, string> = {
    nakit: 'Nakit',
    kredi_karti: 'Kart',
    bolunmus: 'Bölünmüş',
  };
  for (const p of data.payments) {
    b.row(methodNames[p.method] ?? p.method, `${p.amount.toFixed(2)} TL`);
  }

  if (data.openDrawer) b.openDrawer();

  b.separator().centerOn().text(data.footerText).feed(2).cut();
  return b.build();
}

// ─── Test Page ───────────────────────────────────────────────────────────────

export function renderTestPage(printerName: string, paperWidth: 58 | 80 = 80): Buffer {
  const b = new ESCPOSBuilder(paperWidth);
  b.centerOn()
   .bold(true)
   .text('TEST YAZIMI')
   .bold(false)
   .separator()
   .text(printerName)
   .text(new Date().toLocaleString('tr-TR'))
   .separator()
   .text('Yazici basariyla calisiyor.')
   .feed(2)
   .cut();
  return b.build();
}
