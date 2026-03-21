# LezzetPOS Print Service

Local thermal printer service for production POS operation.

## Setup

```bash
cd print-service
npm install
npm start
```

## Configuration

Edit `server.js` and set printer interfaces:

```js
// USB printer (direct USB connection)
const KITCHEN_PRINTER = { interface: 'usb' };

// Network printer (IP-based)
const RECEIPT_PRINTER = { interface: 'network', host: '192.168.1.101', port: 9100 };

// Console (testing - prints to terminal)
const KITCHEN_PRINTER = { interface: 'console' };
```

## API

**POST /print**
```json
{
  "type": "kitchen",
  "content": "*** MUTFAK ***\nMASA 5\n..."
}
```

**GET /health**
Returns printer status.

## Printer Types

| type | Printer | Purpose |
|------|---------|---------|
| `kitchen` | Mutfak Yazıcısı | Sipariş fişi |
| `receipt` | Kasa Yazıcısı | Ödeme fişi |
