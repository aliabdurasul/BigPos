export type UserRole = 'super_admin' | 'restoran_admin' | 'garson' | 'mutfak';

export type TableStatus = 'bos' | 'dolu' | 'odeme_bekliyor';

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  hasModifiers?: boolean;
  image?: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export interface Table {
  id: string;
  name: string;
  status: TableStatus;
  floor: string;
  currentTotal?: number;
  openedAt?: Date;
}

export interface ModifierGroup {
  id: string;
  name: string;
  type: 'checkbox' | 'radio';
  options: ModifierOption[];
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
}

export interface Restaurant {
  id: string;
  name: string;
  active: boolean;
}
