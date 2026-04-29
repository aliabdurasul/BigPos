const express = require('express');
const cors    = require('cors');
const net     = require('net');

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ─── ESC/POS constants ────────────────────────────────────────────────────────

const ESC = 0x1b;
const GS  = 0x1d;

const CMD = {
  INIT:         Buffer.from([ESC, 0x40]),
  ALIGN_LEFT:   Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  BOLD_ON:      Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:     Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_ON:    Buffer.from([ESC, 0x21, 0x30]),
  DOUBLE_OFF:   Buffer.from([ESC, 0x21, 0x00]),
  CUT:          Buffer.from([GS,  0x56, 0x00]),
  LF:           Buffer.from([0x0a]),
};

const COLS = 42;

// ─── Receipt formatting helpers ───────────────────────────────────────────────

function divider(char = '-') {
  return Buffer.from(char.repeat(COLS) + '\n');
}

function padRow(left, right) {
  const rightStr = String(right);
  const space    = Math.max(1, COLS - left.length - rightStr.length);
  return Buffer.from(left + ' '.repeat(space) + rightStr + '\n');
}

function buildReceipt(order) {
  const now = new Date().toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const parts = [
    // Header
    CMD.INIT,
    CMD.ALIGN_CENTER,
    CMD.BOLD_ON,
    CMD.DOUBLE_ON,
    Buffer.from('RESTORAN\n'),
    CMD.DOUBLE_OFF,
    CMD.BOLD_OFF,

    // Order info
    CMD.ALIGN_LEFT,
    divider(),
    Buffer.from(`Siparis No : #${order.id}\n`),
    Buffer.from(`Tarih      : ${now}\n`),
    divider(),
  ];

  // Items
  for (const item of order.items) {
    parts.push(Buffer.from(`${item.qty}x  ${item.name}\n`));
  }

  // Total + cut
  parts.push(
    divider(),
    CMD.BOLD_ON,
    padRow('TOPLAM', `${order.total} TL`),
    CMD.BOLD_OFF,
    CMD.LF,
    CMD.LF,
    CMD.CUT,
  );

  return Buffer.concat(parts);
}

// ─── TCP print ────────────────────────────────────────────────────────────────

function tcpPrint(ip, port, data) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled  = false;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err); else resolve();
    };

    socket.setTimeout(5000);
    socket.on('timeout', () => finish(new Error('Printer connection timed out')));
    socket.on('error',   (err) => finish(err));

    socket.connect(port, ip, () => {
      socket.write(data, (writeErr) => {
        if (writeErr) { finish(writeErr); return; }
        // Short delay so printer can read the buffer before we close
        setTimeout(() => finish(null), 300);
      });
    });
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.send('OK');
});

app.post('/print', async (req, res) => {
  const { ip, port = 9100, order } = req.body || {};

  console.log(`[print] → ip=${ip}:${port}  order=#${order?.id}`);

  if (!ip || !order) {
    return res.status(400).json({ success: false, error: 'ip and order are required' });
  }

  try {
    const receipt = buildReceipt(order);
    await tcpPrint(ip, Number(port), receipt);
    console.log(`[print] ✓ done   ip=${ip}:${port}  order=#${order.id}`);
    return res.json({ success: true });
  } catch (err) {
    console.error(`[print] ✗ failed ip=${ip}:${port}  error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  Local print bridge started`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  POST http://localhost:${PORT}/print\n`);
});
