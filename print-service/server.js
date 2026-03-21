/**
 * LezzetPOS Local Print Service
 *
 * Runs on localhost:3001
 * Accepts POST /print with { type: "kitchen" | "receipt", content: string }
 * Routes to the correct thermal printer.
 *
 * SETUP:
 * 1. npm install
 * 2. Configure KITCHEN_PRINTER and RECEIPT_PRINTER below
 * 3. npm start
 *
 * Printer config options:
 *   - USB:     { interface: "usb" }
 *   - Network: { interface: "network", host: "192.168.1.100", port: 9100 }
 *   - Console: { interface: "console" }  (for testing — prints to terminal)
 */

import http from 'node:http';

// ─── PRINTER CONFIGURATION ────────────────────────
// Change these to match your hardware setup.
// interface: "usb" | "network" | "console"

const KITCHEN_PRINTER = {
  interface: 'console',   // Change to 'usb' or 'network' for real printer
  host: '192.168.1.100',  // Only used for network interface
  port: 9100,             // Only used for network interface
};

const RECEIPT_PRINTER = {
  interface: 'console',   // Change to 'usb' or 'network' for real printer
  host: '192.168.1.101',  // Only used for network interface
  port: 9100,             // Only used for network interface
};

const PORT = 3001;

// ─── CORS Headers ─────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── Print via ESC/POS (USB or Network) ───────────

let escpos = null;
let escposUsb = null;
let escposNetwork = null;

try {
  escpos = await import('escpos');
  try { escposUsb = await import('escpos-usb'); } catch { /* USB not available */ }
  try { escposNetwork = await import('escpos-network'); } catch { /* Network not available */ }
} catch {
  console.warn('[PrintService] escpos not installed — running in console-only mode');
}

async function printToDevice(printerConfig, content) {
  return new Promise((resolve, reject) => {
    // Console mode — just log to terminal
    if (printerConfig.interface === 'console' || !escpos) {
      console.log('\n' + '═'.repeat(40));
      console.log(content);
      console.log('═'.repeat(40) + '\n');
      resolve({ success: true, mode: 'console' });
      return;
    }

    let device;
    try {
      if (printerConfig.interface === 'usb' && escposUsb) {
        device = new escposUsb.default();
      } else if (printerConfig.interface === 'network' && escposNetwork) {
        device = new escposNetwork.default(printerConfig.host, printerConfig.port);
      } else {
        // Fallback to console
        console.log('\n' + '═'.repeat(40));
        console.log(content);
        console.log('═'.repeat(40) + '\n');
        resolve({ success: true, mode: 'console-fallback' });
        return;
      }

      const printer = new escpos.default.Printer(device);
      device.open((err) => {
        if (err) {
          reject(new Error(`Printer open error: ${err.message}`));
          return;
        }

        // Print plain text content line by line
        const lines = content.split('\n');
        printer.font('a').align('lt').style('normal');

        for (const line of lines) {
          printer.text(line);
        }

        printer.cut().close((closeErr) => {
          if (closeErr) {
            reject(new Error(`Printer close error: ${closeErr.message}`));
          } else {
            resolve({ success: true, mode: printerConfig.interface });
          }
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ─── HTTP Server ──────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', printers: { kitchen: KITCHEN_PRINTER.interface, receipt: RECEIPT_PRINTER.interface } }));
    return;
  }

  // Print endpoint
  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { type, content } = JSON.parse(body);

        if (!type || !content) {
          res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing type or content' }));
          return;
        }

        if (type !== 'kitchen' && type !== 'receipt') {
          res.writeHead(400, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid type. Use "kitchen" or "receipt"' }));
          return;
        }

        const printerConfig = type === 'kitchen' ? KITCHEN_PRINTER : RECEIPT_PRINTER;
        const printerLabel = type === 'kitchen' ? 'MUTFAK' : 'KASA';

        console.log(`[${new Date().toLocaleTimeString('tr-TR')}] 🖨️ ${printerLabel} yazıcısına gönderiliyor...`);

        const result = await printToDevice(printerConfig, content);

        console.log(`[${new Date().toLocaleTimeString('tr-TR')}] ✅ ${printerLabel} yazdırma başarılı (${result.mode})`);

        res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, printer: type, mode: result.mode }));
      } catch (err) {
        console.error(`[${new Date().toLocaleTimeString('tr-TR')}] ❌ Yazdırma hatası:`, err.message);
        res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   LezzetPOS Print Service v1.0       ║');
  console.log(`║   http://localhost:${PORT}              ║`);
  console.log('╠══════════════════════════════════════╣');
  console.log(`║   Mutfak : ${KITCHEN_PRINTER.interface.padEnd(25)}║`);
  console.log(`║   Kasa   : ${RECEIPT_PRINTER.interface.padEnd(25)}║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');
});
