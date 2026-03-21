/**
 * Local Print Service client.
 * Sends print jobs to the local print service (localhost:3001).
 * Silent — no popups, no window.print().
 */

const PRINT_SERVICE_URL = 'http://localhost:3001';

export type PrintType = 'kitchen' | 'receipt';

interface PrintResult {
  success: boolean;
  error?: string;
}

/**
 * Send a print job to the local print service.
 * Fails silently with console warning if service is unreachable.
 */
export async function printToService(type: PrintType, content: string): Promise<PrintResult> {
  try {
    const response = await fetch(`${PRINT_SERVICE_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error(`[Print] ${type} print failed:`, data);
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    console.warn(`[Print] Print service unreachable — is it running on ${PRINT_SERVICE_URL}?`);
    return { success: false, error: 'Print service unreachable' };
  }
}

/**
 * Check if print service is running.
 */
export async function checkPrintService(): Promise<boolean> {
  try {
    const response = await fetch(`${PRINT_SERVICE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}
