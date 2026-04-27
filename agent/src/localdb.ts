import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type { PrintJob } from './types.js';

const DB_DIR  = path.join(os.homedir(), '.bigpos-agent');
const DB_PATH = path.join(DB_DIR, 'buffer.sqlite3');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(DB_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS offline_jobs (
      id           TEXT PRIMARY KEY,
      printer_id   TEXT NOT NULL,
      job_type     TEXT NOT NULL,
      payload      TEXT NOT NULL,   -- JSON string
      status       TEXT NOT NULL DEFAULT 'pending',
      attempts     INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      next_retry_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_offline_jobs_status ON offline_jobs(status, next_retry_at);

    -- Permanent print log for audit (never purged, rotated by created_at)
    CREATE TABLE IF NOT EXISTS print_log (
      id           TEXT PRIMARY KEY,
      printer_id   TEXT NOT NULL,
      job_type     TEXT NOT NULL,
      job_cloud_id TEXT,
      status       TEXT NOT NULL,
      error        TEXT,
      completed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_print_log_completed ON print_log(completed_at);
  `);

  return _db;
}

// ─── Offline Buffer ───────────────────────────────────────────────────────────

/** Save a job locally when Supabase is unreachable */
export function bufferJob(job: Pick<PrintJob, 'id' | 'printer_id' | 'job_type' | 'payload'>): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO offline_jobs (id, printer_id, job_type, payload)
    VALUES (@id, @printer_id, @job_type, @payload)
  `).run({
    id:         job.id,
    printer_id: job.printer_id,
    job_type:   job.job_type,
    payload:    JSON.stringify(job.payload),
  });
}

export interface BufferedJob {
  id:         string;
  printer_id: string;
  job_type:   string;
  payload:    Record<string, unknown>;
  attempts:   number;
}

/** Retrieve pending offline jobs ready for retry */
export function getPendingBufferedJobs(limit = 20): BufferedJob[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM offline_jobs
    WHERE status = 'pending'
      AND next_retry_at <= datetime('now')
    ORDER BY created_at ASC
    LIMIT ?
  `).all(limit) as Array<Record<string, unknown>>;

  return rows.map(r => ({
    id:         r.id as string,
    printer_id: r.printer_id as string,
    job_type:   r.job_type as string,
    payload:    JSON.parse(r.payload as string) as Record<string, unknown>,
    attempts:   r.attempts as number,
  }));
}

export function markBufferedJobDone(id: string): void {
  getDb().prepare(`UPDATE offline_jobs SET status = 'done' WHERE id = ?`).run(id);
}

export function markBufferedJobFailed(id: string, nextRetrySeconds: number): void {
  getDb().prepare(`
    UPDATE offline_jobs
    SET attempts     = attempts + 1,
        next_retry_at = datetime('now', '+' || ? || ' seconds')
    WHERE id = ?
  `).run(nextRetrySeconds, id);
}

// ─── Print Log ────────────────────────────────────────────────────────────────

export function logPrintResult(entry: {
  id:          string;
  printer_id:  string;
  job_type:    string;
  job_cloud_id?: string;
  status:      'done' | 'failed';
  error?:      string;
}): void {
  getDb().prepare(`
    INSERT OR IGNORE INTO print_log (id, printer_id, job_type, job_cloud_id, status, error)
    VALUES (@id, @printer_id, @job_type, @job_cloud_id, @status, @error)
  `).run({
    id:           entry.id,
    printer_id:   entry.printer_id,
    job_type:     entry.job_type,
    job_cloud_id: entry.job_cloud_id ?? null,
    status:       entry.status,
    error:        entry.error ?? null,
  });
}

/** Purge completed log entries older than N days */
export function purgeOldLogs(olderThanDays = 30): void {
  getDb().prepare(`
    DELETE FROM print_log
    WHERE completed_at < datetime('now', '-' || ? || ' days')
  `).run(olderThanDays);
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
