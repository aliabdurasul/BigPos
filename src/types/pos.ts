export type UserRole = 'super_admin' | 'restoran_admin' | 'garson' | 'mutfak' | 'manager' | 'cashier';

export type TableStatus = 'available' | 'occupied' | 'waiting_payment';

export type LicensePlan = 'free' | 'starter' | 'pro' | 'enterprise';

export type OrderStatus = 'active' | 'ready' | 'paid';

export type PaymentMethod = 'nakit' | 'kredi_karti' | 'bolunmus' | 'discount';

export type PaymentType = 'payment' | 'prepayment' | 'refund';

export type OrderItemPaymentStatus = 'unpaid' | 'paid';

export type ItemStatus = 'active' | 'cancelled' | 'returned';

export type OrderSource = 'pos' | 'qr';

// ─── Platform Auth Types ───────────────────────

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'restoran_admin';
  restaurantId: string | null;
  active: boolean;
}

export type AuthSession =
  | { type: 'admin'; userId: string; email: string; name: string; role: 'super_admin' | 'restoran_admin'; restaurantId: string | null; slug?: string }
  | { type: 'staff'; staffId: string; name: string; role: 'garson' | 'mutfak' | 'manager' | 'cashier'; restaurantId: string; slug: string };

// ─── Menu Types ────────────────────────────────

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  image?: string;
  portionInfo?: string;
  allergenInfo?: string;
  spiceLevel?: number;
  ingredients?: string[];
  kitchenNote?: string;
  restaurantId?: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  restaurantId?: string;
}

// ─── Table Types ───────────────────────────────

export interface Table {
  id: string;
  name: string;
  status: TableStatus;
  floor: string;
  currentTotal?: number;
  openedAt?: Date;
  restaurantId?: string;
}

// ─── Modifier Types ────────────────────────────

export interface ModifierGroup {
  id: string;
  name: string;
  type: 'checkbox' | 'radio';
  options: ModifierOption[];
  restaurantId?: string;
}

export interface ModifierOption {
  id: string;
  name: string;
  extraPrice: number;
}

export interface OrderItemModifier {
  groupName: string;
  optionName: string;
  extraPrice: number;
}

// ─── Order Types ───────────────────────────────

export interface OrderItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  modifiers: OrderItemModifier[];
  note?: string;
  paymentStatus?: OrderItemPaymentStatus;
  itemStatus?: ItemStatus;
  discountAmount?: number;
  discountReason?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  type: PaymentType;
  createdAt: Date;
  staffId?: string;
  discountAmount?: number;
  discountReason?: string;
}

export interface Order {
  id: string;
  tableId: string;
  tableName: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: Date;
  total: number;
  payments?: Payment[];
  prepayment?: number;
  restaurantId?: string;
  staffId?: string;
  source?: OrderSource;
}

// ─── Staff Types ───────────────────────────────

export interface Staff {
  id: string;
  restaurantId: string;
  name: string;
  role: UserRole;
  pin: string;
  active: boolean;
}

// ─── Report Types ──────────────────────────────

export interface DailyClosure {
  id: string;
  restaurantId: string;
  closedBy?: string;
  closedAt: Date;
  date: string;
  totalRevenue: number;
  totalOrders: number;
  cashTotal: number;
  cardTotal: number;
  topProducts: { name: string; count: number }[];
  notes?: string;
}

// ─── Restaurant Types ──────────────────────────

export interface Restaurant {
  id: string;
  name: string;
  slug?: string;
  ownerName?: string;
  ownerEmail?: string;
  phone?: string;
  address?: string;
  licensePlan: LicensePlan;
  active: boolean;
  settings?: Record<string, unknown>;
  createdAt?: Date;
}

export interface ProductModifierGroup {
  menuItemId: string;
  modifierGroupId: string;
}

// ─── Kitchen Log Types ─────────────────────────

export type KitchenLogReason = 'wrong_order' | 'staff_meal' | 'waste' | 'test' | 'cancelled';

export interface KitchenLog {
  id: string;
  restaurantId: string;
  orderId?: string;
  productId?: string;
  productName?: string;
  quantity: number;
  reason: KitchenLogReason;
  staffId?: string;
  notes?: string;
  createdAt: Date;
}

// ─── Printer / Receipt Types ───────────────────

export type PrintStationPurpose = 'receipt' | 'prep';

export interface PrintStation {
  id: string;
  name: string;
  purpose: PrintStationPurpose;
  isDefault: boolean;
  active: boolean;
}

export interface ReceiptSettings {
  paperWidth: 58 | 80;
  showLogo: boolean;
  logoText?: string;
  headerText?: string;
  footerText: string;
  showPaymentBreakdown: boolean;
  showModifiers: boolean;
  showStaffName: boolean;
  fontSize: 'normal' | 'large';
  openDrawer: boolean;
  copies: number;
}

export interface PrinterSettings {
  stations: PrintStation[];
  receiptSettings: ReceiptSettings;
  categoryRouting: Record<string, string>; // categoryId → stationId
  defaultPrepStationId?: string;
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  paperWidth: 80,
  showLogo: true,
  footerText: 'Tesekkur ederiz!',
  showPaymentBreakdown: true,
  showModifiers: true,
  showStaffName: true,
  fontSize: 'normal',
  openDrawer: true,
  copies: 1,
};

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  stations: [
    { id: 'receipt', name: 'Kasa', purpose: 'receipt', isDefault: true, active: true },
    { id: 'kitchen', name: 'Mutfak', purpose: 'prep', isDefault: true, active: true },
  ],
  receiptSettings: { ...DEFAULT_RECEIPT_SETTINGS },
  categoryRouting: {},
};

// ─── Discount Types ────────────────────────────

export type DiscountType = 'percentage' | 'fixed';

export interface Discount {
  id: string;
  restaurantId: string;
  name: string;
  type: DiscountType;
  value: number;
  active: boolean;
  createdAt?: Date;
}

// ─── Status Helpers ────────────────────────────

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  available: 'Boş',
  occupied: 'Dolu',
  waiting_payment: 'Ödeme Bekliyor',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  active: 'Aktif',
  ready: 'Hazır',
  paid: 'Ödendi',
};

export const TABLE_STATUS_COLORS: Record<TableStatus, string> = {
  available: 'bg-gray-100 text-gray-400',
  occupied: 'bg-red-50 text-red-700',
  waiting_payment: 'bg-amber-50 text-amber-700',
};

export const TABLE_STATUS_BORDER_COLORS: Record<TableStatus, string> = {
  available: 'border-gray-200',
  occupied: 'border-red-200',
  waiting_payment: 'border-amber-200',
};

// ─── DB-backed Printer / Agent / Print Job Types ───────────────────

export type PrinterStationType = 'kitchen' | 'bar' | 'cashier' | 'label';
export type PrinterStatus      = 'online' | 'offline' | 'error' | 'unknown';
export type PrintJobStatus     = 'pending' | 'dispatched' | 'printing' | 'done' | 'failed' | 'cancelled';
export type PrintJobType       = 'kitchen' | 'receipt' | 'label' | 'test';
export type AgentStatus        = 'active' | 'revoked' | 'pending';
export type PrintStatus        = 'unprinted' | 'queued' | 'partial' | 'printed';

/** A physical printer registered in the DB and managed by a local agent */
export interface DbPrinter {
  id:             string;
  restaurantId:   string;
  agentId:        string | null;
  name:           string;
  stationType:    PrinterStationType;
  ipAddress:      string;
  port:           number;
  paperWidth:     58 | 80;
  status:         PrinterStatus;
  lastPingOkAt:   string | null;
  errorMessage:   string | null;
  active:         boolean;
  createdAt:      string;
  updatedAt:      string;
}

/** Category → printer routing rule */
export interface PrinterCategoryRoute {
  id:           string;
  restaurantId: string;
  categoryId:   string;
  printerId:    string;
  createdAt:    string;
}

/** A print job record in Supabase — claimed and executed by the local agent */
export interface DbPrintJob {
  id:           string;
  restaurantId: string;
  printerId:    string;
  jobType:      PrintJobType;
  payload:      Record<string, unknown>;
  status:       PrintJobStatus;
  attempts:     number;
  maxAttempts:  number;
  nextRetryAt:  string;
  fingerprint:  string | null;
  orderId:      string | null;
  errorLog:     Array<{ attempt: number; error: string; ts: string }>;
  createdAt:    string;
  completedAt:  string | null;
}

/** Local BigPOS agent registered for a restaurant */
export interface RestaurantAgent {
  id:           string;
  restaurantId: string;
  tokenHint:    string;
  hostname:     string | null;
  localIp:      string | null;
  agentVersion: string | null;
  lastSeenAt:   string | null;
  status:       AgentStatus;
  createdAt:    string;
}

/** One-time install token for provisioning a new agent */
export interface AgentInstallToken {
  id:           string;
  restaurantId: string;
  tokenHint:    string;
  status:       'pending' | 'used' | 'expired';
  expiresAt:    string;
  createdAt:    string;
}
