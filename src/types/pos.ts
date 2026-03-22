export type UserRole = 'super_admin' | 'restoran_admin' | 'garson' | 'mutfak' | 'manager' | 'cashier';

export type TableStatus = 'available' | 'occupied' | 'waiting_payment';

export type LicensePlan = 'free' | 'starter' | 'pro' | 'enterprise';

export type OrderStatus = 'active' | 'ready' | 'paid';

export type PaymentMethod = 'nakit' | 'kredi_karti' | 'bolunmus' | 'discount';

export type PaymentType = 'payment' | 'prepayment';

export type OrderItemPaymentStatus = 'unpaid' | 'paid';

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
  hasModifiers?: boolean;
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
  available: 'bg-pos-success',
  occupied: 'bg-blue-500',
  waiting_payment: 'bg-pos-warning',
};

export const TABLE_STATUS_BORDER_COLORS: Record<TableStatus, string> = {
  available: 'border-pos-success/30',
  occupied: 'border-blue-500/30',
  waiting_payment: 'border-pos-warning/30',
};
