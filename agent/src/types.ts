// ─── Shared Types ──────────────────────────────────────────────────────────────
// Keep in sync with src/types/pos.ts in the main frontend.

export type PrinterStationType = 'kitchen' | 'bar' | 'cashier' | 'label';
export type PrinterStatus      = 'online' | 'offline' | 'error' | 'unknown';
export type PrintJobStatus     = 'pending' | 'dispatched' | 'printing' | 'done' | 'failed' | 'cancelled';
export type PrintJobType       = 'kitchen' | 'receipt' | 'label' | 'test';
export type AgentStatus        = 'active' | 'revoked' | 'pending';

export interface Printer {
  id:            string;
  restaurant_id: string;
  agent_id:      string | null;
  name:          string;
  station_type:  PrinterStationType;
  ip_address:    string;
  port:          number;
  paper_width:   58 | 80;
  status:        PrinterStatus;
  last_ping_ok_at: string | null;
  error_message:   string | null;
  active:        boolean;
  created_at:    string;
  updated_at:    string;
}

export interface PrintJob {
  id:            string;
  restaurant_id: string;
  printer_id:    string;
  job_type:      PrintJobType;
  payload:       PrintJobPayload;
  status:        PrintJobStatus;
  attempts:      number;
  max_attempts:  number;
  next_retry_at: string;
  fingerprint:   string | null;
  order_id:      string | null;
  error_log:     Array<{ attempt: number; error: string; ts: string }>;
  created_at:    string;
  completed_at:  string | null;
}

export interface AgentCommand {
  id:            string;
  restaurant_id: string;
  agent_id:      string | null;
  command:       'reload_config' | 'ping' | 'scan_printers' | 'revoke';
  payload:       Record<string, unknown>;
  status:        'pending' | 'acked' | 'failed';
  created_at:    string;
  acked_at:      string | null;
}

// ─── Print Job Payloads ────────────────────────────────────────────────────────

export interface OrderItemPayload {
  name:     string;
  quantity: number;
  note?:    string;
  modifiers?: Array<{ group: string; option: string; extraPrice: number }>;
}

export interface KitchenTicketPayload {
  orderNumber: string;
  tableName:   string;
  tableId:     string;
  staffName?:  string;
  items:       OrderItemPayload[];
  timestamp:   string;
}

export interface ReceiptPayload {
  orderNumber:  string;
  tableName:    string;
  items:        Array<OrderItemPayload & { unitPrice: number }>;
  subtotal:     number;
  discount?:    number;
  discountNote?:string;
  total:        number;
  payments:     Array<{ method: string; amount: number }>;
  staffName?:   string;
  logoText?:    string;
  headerText?:  string;
  footerText:   string;
  paperWidth:   58 | 80;
  openDrawer:   boolean;
  timestamp:    string;
}

export type PrintJobPayload = KitchenTicketPayload | ReceiptPayload | Record<string, unknown>;

// ─── Agent Config (keystore.json) ─────────────────────────────────────────────

export interface AgentKeystore {
  agentToken:   string;   // raw secret — NEVER log or transmit
  restaurantId: string;
  supabaseUrl:  string;
  supabaseServiceKey: string;  // service_role key for agent — bypasses RLS
}
