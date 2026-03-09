export type UserRole = 'super_admin' | 'restoran_admin' | 'garson' | 'mutfak';

export type TableStatus = 'bos' | 'dolu' | 'odeme_bekliyor';

export type LicensePlan = 'free' | 'starter' | 'pro' | 'enterprise';

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

export interface Table {
  id: string;
  name: string;
  status: TableStatus;
  floor: string;
  currentTotal?: number;
  openedAt?: Date;
  restaurantId?: string;
}

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

export interface OrderItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  modifiers: OrderItemModifier[];
  note?: string;
  sentToKitchen?: boolean;
}

export type OrderStatus = 'yeni' | 'hazirlaniyor' | 'hazir';

export type PaymentMethod = 'nakit' | 'kredi_karti' | 'bolunmus';

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  createdAt: Date;
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
}

export interface Staff {
  id: string;
  restaurantId: string;
  name: string;
  role: UserRole;
  pin: string;
  active: boolean;
}

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

export interface Restaurant {
  id: string;
  name: string;
  slug?: string;
  ownerName?: string;
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
