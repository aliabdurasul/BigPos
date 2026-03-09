import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Category, MenuItem, Table, Order, OrderItem, OrderStatus,
  ModifierGroup, TableStatus, Payment, ModifierOption,
  Staff, DailyClosure,
} from '@/types/pos';

// ─── Context Type ──────────────────────────────────

interface POSContextType {
  loading: boolean;
  restaurantId: string;
  staffId: string | null;
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
  // Staff management (admin CRUD)
  staff: Staff[];
  addStaff: (s: Omit<Staff, 'id'>) => void;
  removeStaff: (id: string) => void;
  updateStaff: (id: string, updates: Partial<Staff>) => void;
  // Admin CRUD
  addCategory: (cat: Omit<Category, 'id'>) => void;
  removeCategory: (id: string) => void;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  removeMenuItem: (id: string) => void;
  addTable: (table: Omit<Table, 'id'>) => void;
  removeTable: (id: string) => void;
  // Floor CRUD
  addFloor: (name: string) => void;
  removeFloor: (name: string) => void;
  // Daily closure
  closeDailyReport: (data: Omit<DailyClosure, 'id'>) => Promise<void>;
  // Product-modifier mapping
  productModifierMap: Map<string, string[]>;
  setProductModifiers: (menuItemId: string, groupIds: string[]) => void;
}

const POSContext = createContext<POSContextType | null>(null);

// ─── Supabase Row → TS Type Mappers ───────────────

function mapCategory(row: Record<string, unknown>): Category {
  return { id: row.id as string, name: row.name as string, icon: (row.icon as string) || undefined, restaurantId: (row.restaurant_id as string) || undefined };
}

function mapMenuItem(row: Record<string, unknown>): MenuItem {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || undefined,
    price: Number(row.price),
    categoryId: (row.category_id as string) || '',
    hasModifiers: (row.has_modifiers as boolean) || false,
    image: (row.image as string) || undefined,
    portionInfo: (row.portion_info as string) || undefined,
    allergenInfo: (row.allergen_info as string) || undefined,
    spiceLevel: row.spice_level != null ? Number(row.spice_level) : undefined,
    ingredients: (row.ingredients as string[]) || undefined,
    kitchenNote: (row.kitchen_note as string) || undefined,
    restaurantId: (row.restaurant_id as string) || undefined,
  };
}

function mapTable(row: Record<string, unknown>, floorMap: Map<string, string>): Table {
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as TableStatus,
    floor: floorMap.get(row.floor_id as string) || '',
    currentTotal: row.current_total ? Number(row.current_total) : undefined,
    openedAt: row.opened_at ? new Date(row.opened_at as string) : undefined,
  };
}

function mapOrderItem(row: Record<string, unknown>): OrderItem {
  return {
    id: row.id as string,
    menuItem: {
      id: (row.menu_item_id as string) || '',
      name: row.menu_item_name as string,
      price: Number(row.menu_item_price),
      categoryId: '',
    },
    quantity: Number(row.quantity),
    modifiers: (row.modifiers as OrderItem['modifiers']) || [],
    note: (row.note as string) || undefined,
    sentToKitchen: (row.sent_to_kitchen as boolean) ?? true,
  };
}

function mapPayment(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    amount: Number(row.amount),
    method: row.method as Payment['method'],
    createdAt: new Date(row.created_at as string),
  };
}

function mapModifierGroup(row: Record<string, unknown>): ModifierGroup {
  const opts = (row.modifier_options as Record<string, unknown>[]) || [];
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as 'checkbox' | 'radio',
    restaurantId: (row.restaurant_id as string) || undefined,
    options: opts
      .sort((a, b) => ((a.sort_order as number) || 0) - ((b.sort_order as number) || 0))
      .map((o): ModifierOption => ({
        id: o.id as string,
        name: o.name as string,
        extraPrice: Number(o.extra_price),
      })),
  };
}

function mapStaff(row: Record<string, unknown>): Staff {
  return {
    id: row.id as string,
    restaurantId: row.restaurant_id as string,
    name: row.name as string,
    role: row.role as UserRole,
    pin: row.pin as string,
    active: row.active as boolean,
  };
}

// ─── Provider ─────────────────────────────────────

interface POSProviderProps {
  restaurantId: string;
  staffId: string | null;
  children: React.ReactNode;
}

export function POSProvider({ restaurantId, staffId, children }: POSProviderProps) {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [floors, setFloors] = useState<string[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [productModifierMap, setProductModifierMap] = useState<Map<string, string[]>>(new Map());

  const floorMapRef = useRef(new Map<string, string>());
  const reverseFloorMapRef = useRef(new Map<string, string>());
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  // ─── Initial Data Fetch ────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        const rid = restaurantId;
        const [
          { data: floorsData },
          { data: catData },
          { data: itemData },
          { data: tableData },
          { data: modData },
          { data: ordersData },
          { data: orderItemsData },
          { data: paymentsData },
          { data: staffData },
          { data: pmgData },
        ] = await Promise.all([
          supabase.from('floors').select('*').eq('restaurant_id', rid).order('sort_order'),
          supabase.from('categories').select('*').eq('restaurant_id', rid).order('sort_order'),
          supabase.from('menu_items').select('*').eq('restaurant_id', rid).eq('active', true),
          supabase.from('tables').select('*').eq('restaurant_id', rid),
          supabase.from('modifier_groups').select('*, modifier_options(*)').eq('restaurant_id', rid).order('sort_order'),
          supabase.from('orders').select('*').eq('restaurant_id', rid).neq('status', 'tamamlandi'),
          supabase.from('order_items').select('*'),
          supabase.from('payments').select('*'),
          supabase.from('staff').select('*').eq('restaurant_id', rid).eq('active', true),
          supabase.from('product_modifier_groups').select('*'),
        ]);

        if (cancelled) return;

        // Floors
        const fMap = new Map<string, string>();
        const rMap = new Map<string, string>();
        (floorsData || []).forEach((f: Record<string, unknown>) => {
          fMap.set(f.id as string, f.name as string);
          rMap.set(f.name as string, f.id as string);
        });
        floorMapRef.current = fMap;
        reverseFloorMapRef.current = rMap;
        setFloors((floorsData || []).map((f: Record<string, unknown>) => f.name as string));

        setCategories((catData || []).map(mapCategory));
        setMenuItems((itemData || []).map(mapMenuItem));
        setTables((tableData || []).map((t: Record<string, unknown>) => mapTable(t, fMap)));
        setModifierGroups((modData || []).map(mapModifierGroup));

        // Group order items & payments by order
        const itemsByOrder = new Map<string, OrderItem[]>();
        (orderItemsData || []).forEach((oi: Record<string, unknown>) => {
          const orderId = oi.order_id as string;
          const items = itemsByOrder.get(orderId) || [];
          items.push(mapOrderItem(oi));
          itemsByOrder.set(orderId, items);
        });

        const paymentsByOrder = new Map<string, Payment[]>();
        (paymentsData || []).forEach((p: Record<string, unknown>) => {
          const orderId = p.order_id as string;
          const payments = paymentsByOrder.get(orderId) || [];
          payments.push(mapPayment(p));
          paymentsByOrder.set(orderId, payments);
        });

        setOrders((ordersData || []).map((o: Record<string, unknown>): Order => ({
          id: o.id as string,
          tableId: o.table_id as string,
          tableName: o.table_name as string,
          items: itemsByOrder.get(o.id as string) || [],
          status: o.status as OrderStatus,
          createdAt: new Date(o.created_at as string),
          total: Number(o.total),
          payments: paymentsByOrder.get(o.id as string),
          prepayment: o.prepayment ? Number(o.prepayment) : undefined,
          restaurantId: (o.restaurant_id as string) || undefined,
          staffId: (o.staff_id as string) || undefined,
        })));

        // Staff
        setStaff((staffData || []).map(mapStaff));

        // Product-modifier group mapping
        const pmMap = new Map<string, string[]>();
        (pmgData || []).forEach((row: Record<string, unknown>) => {
          const itemId = row.menu_item_id as string;
          const groupId = row.modifier_group_id as string;
          const existing = pmMap.get(itemId) || [];
          existing.push(groupId);
          pmMap.set(itemId, existing);
        });
        setProductModifierMap(pmMap);
      } catch (err) {
        console.error('Failed to load POS data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [restaurantId]);

  // ─── Realtime Subscriptions ────────────────────

  useEffect(() => {
    const channel = supabase
      .channel('pos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCategories(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, mapCategory(payload.new)]);
        } else if (payload.eventType === 'UPDATE') {
          setCategories(prev => prev.map(c => c.id === payload.new.id ? mapCategory(payload.new) : c));
        } else if (payload.eventType === 'DELETE') {
          setCategories(prev => prev.filter(c => c.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMenuItems(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, mapMenuItem(payload.new)]);
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.active === false) {
            setMenuItems(prev => prev.filter(m => m.id !== payload.new.id));
          } else {
            setMenuItems(prev => prev.map(m => m.id === payload.new.id ? mapMenuItem(payload.new) : m));
          }
        } else if (payload.eventType === 'DELETE') {
          setMenuItems(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, (payload) => {
        const fMap = floorMapRef.current;
        if (payload.eventType === 'INSERT') {
          setTables(prev => prev.some(t => t.id === payload.new.id) ? prev : [...prev, mapTable(payload.new, fMap)]);
        } else if (payload.eventType === 'UPDATE') {
          setTables(prev => prev.map(t => t.id === payload.new.id ? mapTable(payload.new, fMap) : t));
        } else if (payload.eventType === 'DELETE') {
          setTables(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setOrders(prev => {
            if (prev.some(o => o.id === payload.new.id)) return prev;
            return [...prev, {
              id: payload.new.id,
              tableId: payload.new.table_id,
              tableName: payload.new.table_name,
              items: [],
              status: payload.new.status as OrderStatus,
              createdAt: new Date(payload.new.created_at),
              total: Number(payload.new.total),
              prepayment: payload.new.prepayment ? Number(payload.new.prepayment) : undefined,
            }];
          });
        } else if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => {
            if (o.id !== payload.new.id) return o;
            return {
              ...o,
              status: payload.new.status as OrderStatus,
              total: Number(payload.new.total),
              prepayment: payload.new.prepayment ? Number(payload.new.prepayment) : undefined,
            };
          }));
        } else if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, (payload) => {
        const newItem = mapOrderItem(payload.new);
        setOrders(prev => prev.map(o => {
          if (o.id !== payload.new.order_id) return o;
          if (o.items.some(i => i.id === newItem.id)) return o;
          return { ...o, items: [...o.items, newItem] };
        }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, (payload) => {
        const newPayment = mapPayment(payload.new);
        setOrders(prev => prev.map(o => {
          if (o.id !== payload.new.order_id) return o;
          const existing = o.payments || [];
          if (existing.some(p => p.id === newPayment.id)) return o;
          return { ...o, payments: [...existing, newPayment] };
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ─── Order Functions ───────────────────────────

  const addOrder = useCallback((order: Order) => {
    const orderId = crypto.randomUUID();
    const itemsWithIds = order.items.map(item => ({ ...item, id: crypto.randomUUID() }));
    const newOrder: Order = { ...order, id: orderId, items: itemsWithIds };

    setOrders(prev => [...prev, newOrder]);

    (async () => {
      const { error } = await supabase.from('orders').insert({
        id: orderId,
        table_id: order.tableId,
        table_name: order.tableName,
        status: order.status,
        total: order.total,
        prepayment: order.prepayment || 0,
        restaurant_id: restaurantId,
        staff_id: staffId || null,
      });
      if (error) { console.error('addOrder error:', error); return; }

      if (itemsWithIds.length > 0) {
        const { error: itemsErr } = await supabase.from('order_items').insert(
          itemsWithIds.map(item => ({
            id: item.id,
            order_id: orderId,
            menu_item_id: item.menuItem.id || null,
            menu_item_name: item.menuItem.name,
            menu_item_price: item.menuItem.price,
            quantity: item.quantity,
            modifiers: item.modifiers,
            note: item.note || null,
            sent_to_kitchen: true,
          }))
        );
        if (itemsErr) console.error('addOrder items error:', itemsErr);
      }
    })();
  }, [restaurantId, staffId]);

  const updateOrder = useCallback((orderId: string, updates: Partial<Order>) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));

    const dbUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.total !== undefined) dbUpdates.total = updates.total;
    if (updates.prepayment !== undefined) dbUpdates.prepayment = updates.prepayment;
    if (Object.keys(dbUpdates).length > 0) {
      supabase.from('orders').update(dbUpdates).eq('id', orderId).then(({ error }) => {
        if (error) console.error('updateOrder error:', error);
      });
    }
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    supabase.from('orders').update({ status }).eq('id', orderId).then(({ error }) => {
      if (error) console.error('updateOrderStatus error:', error);
    });
  }, []);

  const removeOrder = useCallback((orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    supabase.from('orders').delete().eq('id', orderId).then(({ error }) => {
      if (error) console.error('removeOrder error:', error);
    });
  }, []);

  const getTableOrders = useCallback((tableId: string) => {
    return ordersRef.current.filter(o => o.tableId === tableId);
  }, []);

  // ─── Table Functions ───────────────────────────

  const setTableStatus = useCallback((tableId: string, status: TableStatus) => {
    setTables(prev => prev.map(t => {
      if (t.id !== tableId) return t;
      if (status === 'bos') return { ...t, status, openedAt: undefined, currentTotal: 0 };
      return { ...t, status };
    }));
    const dbUpdates: Record<string, unknown> = { status };
    if (status === 'bos') { dbUpdates.opened_at = null; dbUpdates.current_total = 0; }
    supabase.from('tables').update(dbUpdates).eq('id', tableId).then(({ error }) => {
      if (error) console.error('setTableStatus error:', error);
    });
  }, []);

  const setTableTotal = useCallback((tableId: string, total: number) => {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, currentTotal: total } : t));
    supabase.from('tables').update({ current_total: total }).eq('id', tableId).then(({ error }) => {
      if (error) console.error('setTableTotal error:', error);
    });
  }, []);

  const openTable = useCallback((tableId: string) => {
    setTables(prev => prev.map(t => {
      if (t.id !== tableId || t.status !== 'bos') return t;
      return { ...t, status: 'dolu' as TableStatus, openedAt: new Date() };
    }));
    supabase.from('tables')
      .update({ status: 'dolu', opened_at: new Date().toISOString() })
      .eq('id', tableId).eq('status', 'bos')
      .then(({ error }) => { if (error) console.error('openTable error:', error); });
  }, []);

  // ─── Payment Function ─────────────────────────

  const addPayment = useCallback((orderId: string, payment: Payment) => {
    const paymentId = crypto.randomUUID();
    const newPayment = { ...payment, id: paymentId };
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, payments: [...(o.payments || []), newPayment] };
    }));
    supabase.from('payments').insert({
      id: paymentId, order_id: orderId, amount: payment.amount, method: payment.method,
    }).then(({ error }) => { if (error) console.error('addPayment error:', error); });
  }, []);

  // ─── Admin CRUD Helpers ────────────────────────

  const addCategory = useCallback((cat: Omit<Category, 'id'>) => {
    const id = crypto.randomUUID();
    setCategories(prev => [...prev, { ...cat, id }]);
    supabase.from('categories').insert({ id, name: cat.name, icon: cat.icon || null, restaurant_id: restaurantId })
      .then(({ error }) => { if (error) console.error('addCategory error:', error); });
  }, [restaurantId]);

  const removeCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    supabase.from('categories').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('removeCategory error:', error); });
  }, []);

  const addMenuItemFn = useCallback((item: Omit<MenuItem, 'id'>) => {
    const id = crypto.randomUUID();
    setMenuItems(prev => [...prev, { ...item, id }]);
    supabase.from('menu_items').insert({
      id, name: item.name, description: item.description || null, price: item.price,
      category_id: item.categoryId, has_modifiers: item.hasModifiers || false, image: item.image || null,
      portion_info: item.portionInfo || null, allergen_info: item.allergenInfo || null,
      spice_level: item.spiceLevel || 0, ingredients: item.ingredients || [],
      kitchen_note: item.kitchenNote || null, restaurant_id: restaurantId,
    }).then(({ error }) => { if (error) console.error('addMenuItem error:', error); });
  }, [restaurantId]);

  const updateMenuItemFn = useCallback((id: string, updates: Partial<MenuItem>) => {
    setMenuItems(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description || null;
    if (updates.price !== undefined) dbUpdates.price = updates.price;
    if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
    if (updates.hasModifiers !== undefined) dbUpdates.has_modifiers = updates.hasModifiers;
    if (updates.image !== undefined) dbUpdates.image = updates.image || null;
    if (updates.portionInfo !== undefined) dbUpdates.portion_info = updates.portionInfo || null;
    if (updates.allergenInfo !== undefined) dbUpdates.allergen_info = updates.allergenInfo || null;
    if (updates.spiceLevel !== undefined) dbUpdates.spice_level = updates.spiceLevel;
    if (updates.ingredients !== undefined) dbUpdates.ingredients = updates.ingredients;
    if (updates.kitchenNote !== undefined) dbUpdates.kitchen_note = updates.kitchenNote || null;
    if (Object.keys(dbUpdates).length > 0) {
      supabase.from('menu_items').update(dbUpdates).eq('id', id)
        .then(({ error }) => { if (error) console.error('updateMenuItem error:', error); });
    }
  }, []);

  const removeMenuItemFn = useCallback((id: string) => {
    setMenuItems(prev => prev.filter(m => m.id !== id));
    supabase.from('menu_items').update({ active: false }).eq('id', id)
      .then(({ error }) => { if (error) console.error('removeMenuItem error:', error); });
  }, []);

  const addTableFn = useCallback((table: Omit<Table, 'id'>) => {
    const id = crypto.randomUUID();
    setTables(prev => [...prev, { ...table, id }]);
    const floorId = reverseFloorMapRef.current.get(table.floor);
    supabase.from('tables').insert({ id, name: table.name, status: table.status, floor_id: floorId, restaurant_id: restaurantId })
      .then(({ error }) => { if (error) console.error('addTable error:', error); });
  }, [restaurantId]);

  const removeTableFn = useCallback((id: string) => {
    setTables(prev => prev.filter(t => t.id !== id));
    supabase.from('tables').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('removeTable error:', error); });
  }, []);

  // ─── Floor CRUD ────────────────────────────────

  const addFloor = useCallback((name: string) => {
    const id = crypto.randomUUID();
    floorMapRef.current.set(id, name);
    reverseFloorMapRef.current.set(name, id);
    setFloors(prev => [...prev, name]);
    supabase.from('floors').insert({ id, name, sort_order: floors.length + 1, restaurant_id: restaurantId })
      .then(({ error }) => { if (error) console.error('addFloor error:', error); });
  }, [floors.length, restaurantId]);

  const removeFloor = useCallback((name: string) => {
    const floorId = reverseFloorMapRef.current.get(name);
    if (floorId) {
      floorMapRef.current.delete(floorId);
      reverseFloorMapRef.current.delete(name);
    }
    setFloors(prev => prev.filter(f => f !== name));
    if (floorId) {
      supabase.from('floors').delete().eq('id', floorId)
        .then(({ error }) => { if (error) console.error('removeFloor error:', error); });
    }
  }, []);

  // ─── Staff CRUD (for admin panel) ──────────────

  const addStaff = useCallback((s: Omit<Staff, 'id'>) => {
    const id = crypto.randomUUID();
    setStaff(prev => [...prev, { ...s, id }]);
    supabase.from('staff').insert({
      id, restaurant_id: s.restaurantId, name: s.name, role: s.role, pin: s.pin, active: s.active,
    }).then(({ error }) => { if (error) console.error('addStaff error:', error); });
  }, []);

  const removeStaff = useCallback((id: string) => {
    setStaff(prev => prev.filter(s => s.id !== id));
    supabase.from('staff').update({ active: false }).eq('id', id)
      .then(({ error }) => { if (error) console.error('removeStaff error:', error); });
  }, []);

  const updateStaffFn = useCallback((id: string, updates: Partial<Staff>) => {
    setStaff(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.pin !== undefined) dbUpdates.pin = updates.pin;
    if (updates.active !== undefined) dbUpdates.active = updates.active;
    if (Object.keys(dbUpdates).length > 0) {
      supabase.from('staff').update(dbUpdates).eq('id', id)
        .then(({ error }) => { if (error) console.error('updateStaff error:', error); });
    }
  }, []);

  // ─── Daily Closure ─────────────────────────────

  const closeDailyReport = useCallback(async (data: Omit<DailyClosure, 'id'>) => {
    const id = crypto.randomUUID();
    await supabase.from('daily_closures').insert({
      id,
      restaurant_id: data.restaurantId,
      closed_by: data.closedBy || null,
      date: data.date,
      total_revenue: data.totalRevenue,
      total_orders: data.totalOrders,
      cash_total: data.cashTotal,
      card_total: data.cardTotal,
      top_products: data.topProducts,
      notes: data.notes || null,
    });
  }, []);

  // ─── Product-Modifier Group Mapping ────────────

  const setProductModifiers = useCallback((menuItemId: string, groupIds: string[]) => {
    setProductModifierMap(prev => {
      const next = new Map(prev);
      next.set(menuItemId, groupIds);
      return next;
    });
    // Sync to DB: delete old, insert new
    (async () => {
      await supabase.from('product_modifier_groups').delete().eq('menu_item_id', menuItemId);
      if (groupIds.length > 0) {
        await supabase.from('product_modifier_groups').insert(
          groupIds.map(gid => ({ menu_item_id: menuItemId, modifier_group_id: gid }))
        );
      }
    })();
  }, []);

  // ─── Render ────────────────────────────────────

  return (
    <POSContext.Provider value={{
      loading,
      restaurantId, staffId,
      categories, setCategories,
      menuItems, setMenuItems,
      tables, setTables,
      orders, addOrder, updateOrder, updateOrderStatus, removeOrder, getTableOrders,
      setTableStatus, setTableTotal, openTable, addPayment,
      modifierGroups, floors,
      staff, addStaff, removeStaff, updateStaff: updateStaffFn,
      addCategory, removeCategory,
      addMenuItem: addMenuItemFn, updateMenuItem: updateMenuItemFn, removeMenuItem: removeMenuItemFn,
      addTable: addTableFn, removeTable: removeTableFn,
      addFloor, removeFloor,
      closeDailyReport,
      productModifierMap, setProductModifiers,
    }}>
      {loading ? (
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <h1 className="text-2xl font-black mb-1">Lezzet-i Ala POS</h1>
            <p className="text-muted-foreground">Yukleniyor...</p>
          </div>
        </div>
      ) : children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  const ctx = useContext(POSContext);
  if (!ctx) throw new Error('usePOS must be used within POSProvider');
  return ctx;
}
