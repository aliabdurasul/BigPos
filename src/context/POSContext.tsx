import React, { createContext, useContext, useState, useCallback } from 'react';
import { Category, MenuItem, Table, Order, OrderItem, OrderStatus, UserRole, ModifierGroup, TableStatus, Payment } from '@/types/pos';

interface POSContextType {
  role: UserRole | null;
  setRole: (role: UserRole | null) => void;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  menuItems: MenuItem[];
  setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  removeOrder: (orderId: string) => void;
  getTableOrders: (tableId: string) => Order[];
  setTableStatus: (tableId: string, status: TableStatus) => void;
  setTableTotal: (tableId: string, total: number) => void;
  openTable: (tableId: string) => void;
  addPayment: (orderId: string, payment: Payment) => void;
  modifierGroups: ModifierGroup[];
  floors: string[];
}

const POSContext = createContext<POSContextType | null>(null);

const defaultFloors = ['Salon', 'Teras', 'Üst Kat'];

const defaultCategories: Category[] = [
  { id: '1', name: 'Kebaplar', icon: '🥩' },
  { id: '2', name: 'Dürümler', icon: '🌯' },
  { id: '3', name: 'İçecekler', icon: '🥤' },
  { id: '4', name: 'Tatlılar', icon: '🍮' },
  { id: '5', name: 'Başlangıçlar', icon: '🥗' },
  { id: '6', name: 'Izgara', icon: '🔥' },
];

const defaultMenuItems: MenuItem[] = [
  { id: '1', name: 'Adana Kebap', description: 'Odun ateşinde pişmiş acılı kebap', price: 280, categoryId: '1', hasModifiers: true },
  { id: '2', name: 'Urfa Kebap', description: 'Acısız el yapımı kebap', price: 280, categoryId: '1', hasModifiers: true },
  { id: '3', name: 'İskender', description: 'Tereyağlı İskender kebap', price: 320, categoryId: '1', hasModifiers: true },
  { id: '4', name: 'Patlıcan Kebap', description: 'Közlenmiş patlıcan ile', price: 300, categoryId: '1', hasModifiers: true },
  { id: '5', name: 'Beyti Sarma', description: 'Lavaş içinde beyti kebabı', price: 340, categoryId: '1', hasModifiers: true },
  { id: '6', name: 'Adana Dürüm', description: 'Lavaş içinde Adana kebabı', price: 200, categoryId: '2', hasModifiers: true },
  { id: '7', name: 'Urfa Dürüm', description: 'Lavaş içinde Urfa kebabı', price: 200, categoryId: '2', hasModifiers: true },
  { id: '8', name: 'Tavuk Dürüm', description: 'Izgara tavuk dürüm', price: 180, categoryId: '2', hasModifiers: true },
  { id: '9', name: 'Lahmacun', description: 'İnce hamur lahmacun', price: 120, categoryId: '2', hasModifiers: true },
  { id: '10', name: 'Ayran', price: 40, categoryId: '3' },
  { id: '11', name: 'Kola', price: 60, categoryId: '3' },
  { id: '12', name: 'Su', price: 20, categoryId: '3' },
  { id: '13', name: 'Çay', price: 30, categoryId: '3' },
  { id: '14', name: 'Limonata', price: 50, categoryId: '3' },
  { id: '15', name: 'Künefe', description: 'Sıcak servis künefe', price: 150, categoryId: '4' },
  { id: '16', name: 'Baklava', description: 'Antep fıstıklı baklava', price: 180, categoryId: '4' },
  { id: '17', name: 'Sütlaç', price: 90, categoryId: '4' },
  { id: '18', name: 'Kazandibi', price: 90, categoryId: '4' },
  { id: '19', name: 'Mercimek Çorbası', description: 'Günlük taze çorba', price: 80, categoryId: '5' },
  { id: '20', name: 'Humus', price: 70, categoryId: '5' },
  { id: '21', name: 'Cacık', price: 60, categoryId: '5' },
  { id: '22', name: 'Ezme', price: 50, categoryId: '5' },
  { id: '23', name: 'Pide Karışık', description: 'Karışık malzemeli pide', price: 220, categoryId: '6' },
  { id: '24', name: 'Kuşbaşı', price: 260, categoryId: '6' },
  { id: '25', name: 'Tavuk Kanat', price: 180, categoryId: '6' },
];

const defaultModifierGroups: ModifierGroup[] = [
  {
    id: 'm1',
    name: 'İçindekiler',
    type: 'checkbox',
    options: [
      { id: 'mo1', name: 'Soğansız', extraPrice: 0 },
      { id: 'mo2', name: 'Maydanozsuz', extraPrice: 0 },
      { id: 'mo3', name: 'Domatessiz', extraPrice: 0 },
    ],
  },
  {
    id: 'm2',
    name: 'Acı Seviyesi',
    type: 'radio',
    options: [
      { id: 'mo4', name: 'Acısız', extraPrice: 0 },
      { id: 'mo5', name: 'Az Acılı', extraPrice: 0 },
      { id: 'mo6', name: 'Normal', extraPrice: 0 },
      { id: 'mo7', name: 'Çok Acılı', extraPrice: 0 },
    ],
  },
  {
    id: 'm3',
    name: 'Ekstralar',
    type: 'checkbox',
    options: [
      { id: 'mo8', name: 'Extra Kaşar', extraPrice: 20 },
      { id: 'mo9', name: 'Double Et', extraPrice: 50 },
      { id: 'mo10', name: 'Extra Sos', extraPrice: 10 },
    ],
  },
];

const defaultTables: Table[] = [
  { id: '1', name: 'Masa 1', status: 'bos', floor: 'Salon' },
  { id: '2', name: 'Masa 2', status: 'dolu', floor: 'Salon', openedAt: new Date(Date.now() - 3600000) },
  { id: '3', name: 'Masa 3', status: 'bos', floor: 'Salon' },
  { id: '4', name: 'Masa 4', status: 'odeme_bekliyor', floor: 'Salon', currentTotal: 680, openedAt: new Date(Date.now() - 4320000) },
  { id: '5', name: 'Masa 5', status: 'bos', floor: 'Salon' },
  { id: '6', name: 'Masa 6', status: 'bos', floor: 'Salon' },
  { id: '7', name: 'Masa 7', status: 'dolu', floor: 'Teras', currentTotal: 440, openedAt: new Date(Date.now() - 2700000) },
  { id: '8', name: 'Masa 8', status: 'bos', floor: 'Teras' },
  { id: '9', name: 'Masa 9', status: 'bos', floor: 'Teras' },
  { id: '10', name: 'Masa 10', status: 'bos', floor: 'Teras' },
  { id: '11', name: 'Masa 11', status: 'bos', floor: 'Üst Kat' },
  { id: '12', name: 'Masa 12', status: 'bos', floor: 'Üst Kat' },
];

export function POSProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(defaultMenuItems);
  const [tables, setTables] = useState<Table[]>(defaultTables);
  const [orders, setOrders] = useState<Order[]>([]);

  const addOrder = useCallback((order: Order) => {
    setOrders(prev => [...prev, order]);
  }, []);

  const updateOrder = useCallback((orderId: string, updates: Partial<Order>) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  }, []);

  const removeOrder = useCallback((orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
  }, []);

  const getTableOrders = useCallback((tableId: string) => {
    return orders.filter(o => o.tableId === tableId && o.status !== 'hazir');
  }, [orders]);

  const setTableStatus = useCallback((tableId: string, status: TableStatus) => {
    setTables(prev => prev.map(t => {
      if (t.id !== tableId) return t;
      if (status === 'bos') return { ...t, status, openedAt: undefined, currentTotal: 0 };
      return { ...t, status };
    }));
  }, []);

  const setTableTotal = useCallback((tableId: string, total: number) => {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, currentTotal: total } : t));
  }, []);

  const openTable = useCallback((tableId: string) => {
    setTables(prev => prev.map(t => {
      if (t.id !== tableId) return t;
      if (t.status === 'bos') return { ...t, status: 'dolu' as TableStatus, openedAt: new Date() };
      return t;
    }));
  }, []);

  const addPayment = useCallback((orderId: string, payment: Payment) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      const payments = [...(o.payments || []), payment];
      return { ...o, payments };
    }));
  }, []);

  return (
    <POSContext.Provider value={{
      role, setRole,
      categories, setCategories,
      menuItems, setMenuItems,
      tables, setTables,
      orders, addOrder, updateOrder, updateOrderStatus, removeOrder, getTableOrders,
      setTableStatus, setTableTotal, openTable, addPayment,
      modifierGroups: defaultModifierGroups,
      floors: defaultFloors,
    }}>
      {children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  const ctx = useContext(POSContext);
  if (!ctx) throw new Error('usePOS must be used within POSProvider');
  return ctx;
}
