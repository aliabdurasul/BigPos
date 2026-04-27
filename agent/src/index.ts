/**
 * BigPOS Local Print Agent
 *
 * Responsibilities:
 *  1. Poll Supabase `print_jobs` every 1s — claim pending jobs atomically
 *  2. Render ESC/POS bytes locally for each job type
 *  3. Send bytes to the target printer via TCP :9100
 *  4. Update job status back to Supabase (done / failed)
 *  5. Send heartbeat every 15s with printer reachability data
 *  6. Scan LAN for printers every 60s and sync to cloud
 *  7. Process pending AgentCommands (reload_config, ping, etc.)
 *  8. Buffer jobs locally to SQLite when Supabase is unreachable
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadKeystore }                    from './keystore.js';
import { renderKitchenTicket, renderReceipt, renderTestPage } from './renderer.js';
import { tcpPrint }                        from './tcp.js';
import { scanLanForPrinters, checkPrinterReachability, getHostname, getLocalIp } from './scanner.js';
import { bufferJob, getPendingBufferedJobs, markBufferedJobDone, markBufferedJobFailed, logPrintResult, purgeOldLogs } from './localdb.js';
import type { Printer, PrintJob, AgentCommand, KitchenTicketPayload, ReceiptPayload } from './types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS      = 1_000;   // 1s job poll
const HEARTBEAT_INTERVAL_MS = 15_000;  // 15s heartbeat
const SCAN_INTERVAL_MS      = 60_000;  // 60s LAN scan
const LOG_PURGE_INTERVAL_MS = 24 * 60 * 60_000; // 24h log purge
const JOBS_PER_POLL         = 10;

// ─── State ────────────────────────────────────────────────────────────────────

let _supabase:      SupabaseClient;
let _agentId:       string | null = null;
let _restaurantId:  string;
let _printers:      Map<string, Printer> = new Map();
let _processingIds: Set<string>          = new Set();
let _cloudReachable = true;
const AGENT_VERSION = '1.0.0';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  const ks = loadKeystore();
  _restaurantId = ks.restaurantId;

  _supabase = createClient(ks.supabaseUrl, ks.supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Verify agent token and get our agent id
  const tokenHash = (await import('crypto')).createHash('sha256').update(ks.agentToken).digest('hex');
  const { data: agent, error } = await _supabase
    .from('restaurant_agents')
    .select('id, status')
    .eq('agent_token_hash', tokenHash)
    .eq('restaurant_id', _restaurantId)
    .single();

  if (error || !agent) {
    throw new Error(`Agent token verification failed: ${error?.message ?? 'not found'}`);
  }
  if (agent.status === 'revoked') {
    throw new Error('This agent token has been revoked. Re-provision the agent.');
  }

  _agentId = agent.id;
  console.log(`[agent] Authenticated. ID=${_agentId} Restaurant=${_restaurantId}`);

  await loadPrinters();
}

// ─── Printer Config ───────────────────────────────────────────────────────────

async function loadPrinters(): Promise<void> {
  const { data, error } = await _supabase
    .from('printers')
    .select('*')
    .eq('restaurant_id', _restaurantId)
    .eq('active', true);

  if (error) {
    console.error('[agent] Failed to load printers:', error.message);
    return;
  }

  _printers = new Map((data as Printer[]).map(p => [p.id, p]));
  console.log(`[agent] Loaded ${_printers.size} printer(s)`);
}

// ─── Job Poll Loop ────────────────────────────────────────────────────────────

async function pollJobs(): Promise<void> {
  if (!_cloudReachable) return;

  try {
    // Use the DB function to get pending jobs atomically
    const { data: jobs, error } = await _supabase
      .rpc('get_pending_print_jobs', {
        p_restaurant_id: _restaurantId,
        p_limit: JOBS_PER_POLL,
      });

    if (error) throw error;
    if (!jobs || jobs.length === 0) return;

    // Filter out jobs we're already processing
    const newJobs = (jobs as PrintJob[]).filter(j => !_processingIds.has(j.id));
    if (newJobs.length === 0) return;

    // Claim them atomically
    const ids = newJobs.map(j => j.id);
    const { data: claimed, error: claimErr } = await _supabase
      .rpc('claim_print_jobs', { p_job_ids: ids });

    if (claimErr) throw claimErr;
    if (!claimed || claimed.length === 0) return;

    // Process each claimed job concurrently (but cap per-printer to 1 at a time)
    for (const job of claimed as PrintJob[]) {
      _processingIds.add(job.id);
      // Fire and forget — each job manages its own lifecycle
      processJob(job).finally(() => _processingIds.delete(job.id));
    }
  } catch (err) {
    console.error('[poll] Error:', (err as Error).message);
    _cloudReachable = false;
    setTimeout(() => { _cloudReachable = true; }, 10_000);
  }
}

// ─── Job Processing ───────────────────────────────────────────────────────────

async function processJob(job: PrintJob): Promise<void> {
  const printer = _printers.get(job.printer_id);
  if (!printer) {
    console.warn(`[job:${job.id}] Printer ${job.printer_id} not found locally — reloading config`);
    await loadPrinters();
    const p2 = _printers.get(job.printer_id);
    if (!p2) {
      await reportJobResult(job.id, 'failed', `Printer ID ${job.printer_id} not found in config`);
      return;
    }
  }

  const p = _printers.get(job.printer_id)!;

  try {
    const bytes = renderJob(job, p.paper_width as 58 | 80);
    await tcpPrint(p.ip_address, bytes, p.port);
    await reportJobResult(job.id, 'done');
    logPrintResult({ id: crypto.randomUUID(), printer_id: p.id, job_type: job.job_type, job_cloud_id: job.id, status: 'done' });
    console.log(`[job:${job.id}] Done — ${p.name} (${p.ip_address})`);
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[job:${job.id}] Failed:`, msg);
    await reportJobResult(job.id, 'failed', msg);
    logPrintResult({ id: crypto.randomUUID(), printer_id: p.id, job_type: job.job_type, job_cloud_id: job.id, status: 'failed', error: msg });
  }
}

function renderJob(job: PrintJob, paperWidth: 58 | 80): Buffer {
  switch (job.job_type) {
    case 'kitchen': return renderKitchenTicket(job.payload as KitchenTicketPayload, paperWidth);
    case 'receipt': return renderReceipt(job.payload as ReceiptPayload);
    case 'test':    return renderTestPage('BigPOS Printer', paperWidth);
    default:        throw new Error(`Unknown job type: ${job.job_type}`);
  }
}

async function reportJobResult(jobId: string, status: 'done' | 'failed', error?: string): Promise<void> {
  try {
    await _supabase.rpc('complete_print_job', {
      p_job_id: jobId,
      p_status: status,
      p_error:  error ?? null,
    });
  } catch (err) {
    console.error('[agent] Failed to report job result to cloud:', (err as Error).message);
    // Swallow — the pg_cron orphan recovery will handle stuck dispatched jobs
  }
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

async function sendHeartbeat(): Promise<void> {
  if (!_agentId) return;

  try {
    // Check printer reachability
    const printerList = [..._printers.values()];
    const reachability = await checkPrinterReachability(printerList);

    // Update printer statuses in bulk
    for (const { id, reachable } of reachability) {
      const printer = _printers.get(id);
      if (!printer) continue;

      const newStatus = reachable ? 'online' : 'offline';
      if (printer.status !== newStatus) {
        // Only update if status changed to reduce DB writes
        await _supabase
          .from('printers')
          .update({
            status:         newStatus,
            last_ping_ok_at: reachable ? new Date().toISOString() : printer.last_ping_ok_at,
            updated_at:     new Date().toISOString(),
          })
          .eq('id', id);

        // Update local cache
        _printers.set(id, { ...printer, status: newStatus });
      }
    }

    // Update agent last_seen_at + network info
    await _supabase
      .from('restaurant_agents')
      .update({
        last_seen_at:  new Date().toISOString(),
        hostname:      getHostname(),
        local_ip:      getLocalIp(),
        agent_version: AGENT_VERSION,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', _agentId);

    // Poll agent commands
    await processAgentCommands();
  } catch (err) {
    console.warn('[heartbeat] Error:', (err as Error).message);
  }
}

// ─── Agent Command Processing ─────────────────────────────────────────────────

async function processAgentCommands(): Promise<void> {
  const { data: commands, error } = await _supabase
    .from('agent_commands')
    .select('*')
    .eq('agent_id', _agentId)
    .eq('status', 'pending');

  if (error || !commands || commands.length === 0) return;

  for (const cmd of commands as AgentCommand[]) {
    try {
      await executeCommand(cmd);
      await _supabase
        .from('agent_commands')
        .update({ status: 'acked', acked_at: new Date().toISOString() })
        .eq('id', cmd.id);
    } catch (err) {
      console.error(`[cmd:${cmd.command}] Error:`, (err as Error).message);
      await _supabase
        .from('agent_commands')
        .update({ status: 'failed' })
        .eq('id', cmd.id);
    }
  }
}

async function executeCommand(cmd: AgentCommand): Promise<void> {
  console.log(`[cmd] ${cmd.command}`);
  switch (cmd.command) {
    case 'reload_config':
      await loadPrinters();
      break;
    case 'ping':
      // Ack is enough
      break;
    case 'scan_printers':
      await runLanScan();
      break;
    case 'revoke':
      console.error('[agent] Revoke command received — shutting down');
      process.exit(1);
  }
}

// ─── LAN Scanner ─────────────────────────────────────────────────────────────

async function runLanScan(): Promise<void> {
  console.log('[scanner] Starting LAN scan for printers...');
  try {
    const discoveredIps = await scanLanForPrinters();
    console.log(`[scanner] Found ${discoveredIps.length} device(s) on port 9100`);

    if (discoveredIps.length === 0) return;

    // Insert newly discovered IPs as 'unknown' printers if not already in DB
    const { data: existing } = await _supabase
      .from('printers')
      .select('ip_address')
      .eq('restaurant_id', _restaurantId);

    const existingIps = new Set((existing ?? []).map((p: { ip_address: string }) => p.ip_address));
    const newIps = discoveredIps.filter(ip => !existingIps.has(ip));

    for (const ip of newIps) {
      await _supabase.from('printers').insert({
        restaurant_id: _restaurantId,
        agent_id:      _agentId,
        name:          `Yazici ${ip}`,
        station_type:  'kitchen',
        ip_address:    ip,
        port:          9100,
        paper_width:   80,
        status:        'unknown',
        active:        false,  // Admin must activate
      });
      console.log(`[scanner] New printer candidate added: ${ip}`);
    }
  } catch (err) {
    console.error('[scanner] Scan failed:', (err as Error).message);
  }
}

// ─── Offline Buffer Flush ─────────────────────────────────────────────────────

async function flushOfflineBuffer(): Promise<void> {
  const jobs = getPendingBufferedJobs();
  if (jobs.length === 0) return;

  for (const job of jobs) {
    const printer = _printers.get(job.printer_id);
    if (!printer) continue;

    try {
      // Re-insert to cloud print_jobs (will dedup via fingerprint if already there)
      await _supabase.from('print_jobs').insert({
        id:            job.id,
        restaurant_id: _restaurantId,
        printer_id:    job.printer_id,
        job_type:      job.job_type,
        payload:       job.payload,
      });
      markBufferedJobDone(job.id);
    } catch {
      const backoff = Math.min(300, 10 * Math.pow(2, job.attempts));
      markBufferedJobFailed(job.id, backoff);
    }
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

let _shuttingDown = false;

function setupShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    if (_shuttingDown) return;
    _shuttingDown = true;
    console.log(`[agent] ${signal} received — shutting down gracefully`);

    // Mark agent as offline
    if (_agentId) {
      await _supabase
        .from('restaurant_agents')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', _agentId)
        .catch(() => { /* ignore */ });
    }

    process.exit(0);
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`[agent] BigPOS Agent v${AGENT_VERSION} starting...`);
  setupShutdownHandlers();

  await bootstrap();

  // Start job polling loop
  setInterval(pollJobs, POLL_INTERVAL_MS);

  // Start heartbeat loop
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

  // Periodic LAN scan
  setInterval(runLanScan, SCAN_INTERVAL_MS);
  // Initial scan on startup
  setTimeout(runLanScan, 5_000);

  // Periodic log purge
  setInterval(() => purgeOldLogs(30), LOG_PURGE_INTERVAL_MS);

  // Flush any offline-buffered jobs once cloud is reachable
  setInterval(flushOfflineBuffer, 30_000);

  // Send initial heartbeat
  await sendHeartbeat();

  console.log('[agent] Running. Press Ctrl+C to stop.');
}

main().catch((err) => {
  console.error('[agent] Fatal error:', err);
  process.exit(1);
});

// Need to import crypto for UUID generation in process job
import * as crypto from 'crypto';
