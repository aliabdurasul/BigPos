import * as net from 'net';

const DEFAULT_PORT = 9100;
const CONNECT_TIMEOUT_MS = 3000;
const WRITE_TIMEOUT_MS   = 5000;

// ─── TCP Print ───────────────────────────────────────────────────────────────

/**
 * Opens a TCP connection to ip:port, sends raw bytes, then closes the socket.
 * Resolves on successful write+flush, rejects on any error or timeout.
 */
export function tcpPrint(ip: string, data: Buffer, port = DEFAULT_PORT): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(err);
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve();
    };

    const connectTimer = setTimeout(
      () => fail(new Error(`Connect timeout to ${ip}:${port}`)),
      CONNECT_TIMEOUT_MS,
    );

    socket.once('connect', () => {
      clearTimeout(connectTimer);

      const writeTimer = setTimeout(
        () => fail(new Error(`Write timeout to ${ip}:${port}`)),
        WRITE_TIMEOUT_MS,
      );

      socket.write(data, (err) => {
        clearTimeout(writeTimer);
        if (err) {
          fail(err);
        } else {
          // Flush: end the socket and wait for it to close
          socket.end();
        }
      });
    });

    socket.once('close',   succeed);
    socket.once('error',   fail);
    socket.once('timeout', () => fail(new Error(`Socket timeout ${ip}:${port}`)));
    socket.setTimeout(WRITE_TIMEOUT_MS);

    socket.connect(port, ip);
  });
}

// ─── TCP Probe (for LAN scanner) ─────────────────────────────────────────────

/**
 * Probe whether TCP port 9100 is open at ip.
 * Resolves true/false; never rejects.
 */
export function tcpProbe(ip: string, port = DEFAULT_PORT, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('error',   () => finish(false));
    socket.once('timeout', () => finish(false));
    socket.connect(port, ip);
  });
}
