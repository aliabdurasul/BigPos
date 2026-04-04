import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { OrderItem, Table, MenuItem, OrderItemModifier } from '@/types/pos';
import { ArrowLeft, LogOut, Clock, AlertTriangle, ShoppingCart, Banknote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { playSuccess } from '@/lib/sound';
import { printKitchenTicket, printPaymentReceipt, printAdisyon } from '@/lib/printer';
import { getQZStatus } from '@/lib/qz-tray';
import { useIsMobile } from '@/hooks/use-mobile';

import TableGrid from '@/components/waiter/TableGrid';
import ProductGrid from '@/components/waiter/ProductGrid';
import CategorySidebar from '@/components/waiter/CategorySidebar';
import { BottomSheetModifiers } from '@/components/waiter/ModifierModal';
import CashierOrderPanel from '@/components/cashier/CashierOrderPanel';
import CashierPaymentPanel, { ActionLogEntry } from '@/components/cashier/CashierPaymentPanel';

function formatDuration(openedAt?: Date) {
  if (!openedAt) return '';
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
  if (mins < 1) return 'Az önce';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

type MobileTab = 'tables' | 'menu' | 'order';

export default function CashierPOS() {
  const {
    tables, categories, menuItems, addOrder, getTableOrders,
    setTableTotal, openTable, modifierGroups, floors,
    orders, restaurantName, productModifierMap, markOrderReady,
    completePayment, recordPrepayment, payOrderItems, staffId,
    voidItem, returnItem, refundPayment, applyItemDiscount,
    printerConfig,
  } = usePOS();
  const { session, logout } = useAuth();
  const staffName = session?.name || null;
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // ─── State ──────────────────────────────────
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id || '');
  const [selectedFloor, setSelectedFloor] = useState(floors[0]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const draftItemsRef = useRef<Map<string, OrderItem[]>>(new Map());
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [mobileModifierItem, setMobileModifierItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [showSentWarning, setShowSentWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('tables');
  const [, setTick] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [ikramItems, setIkramItems] = useState<Set<string>>(new Set());
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  // ─── Auto-deselect on payment completion ────
  const currentTableInContext = selectedTable ? tables.find(t => t.id === selectedTable.id) : undefined;
  const prevTableStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const curr = currentTableInContext?.status;
    const prev = prevTableStatusRef.current;
    prevTableStatusRef.current = curr;
    if (selectedTable && curr === 'available' && prev !== undefined && prev !== 'available') {
      draftItemsRef.current.delete(selectedTable.id);
      setSelectedTable(null);
      setOrderItems([]);
      if (isMobile) setMobileTab('tables');
      toast.success(`${selectedTable.name} ödeme tamamlandı`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTableInContext?.status]);

  // Reset per-table state on table change
  useEffect(() => {
    setSelectedItemId(null);
    setIkramItems(new Set());
    setActionLog([]);
  }, [selectedTable?.id]);

  // Clear stale drafts when tables become available
  useEffect(() => {
    for (const [tableId] of draftItemsRef.current) {
      const t = tables.find(tb => tb.id === tableId);
      if (!t || t.status === 'available') {
        draftItemsRef.current.delete(tableId);
      }
    }
  }, [tables]);

  // ─── Draft management ──────────────────────
  const saveDrafts = useCallback((tableId: string, items: OrderItem[]) => {
    const unsent = items.filter(i => !(i as any)._fromDB);
    if (unsent.length > 0) {
      draftItemsRef.current.set(tableId, unsent);
    } else {
      draftItemsRef.current.delete(tableId);
    }
  }, []);

  const leaveTable = useCallback(() => {
    if (selectedTable) {
      saveDrafts(selectedTable.id, orderItems);
    }
    setSelectedTable(null);
    setOrderItems([]);
    setExpandedItemId(null);
    if (isMobile) setMobileTab('tables');
  }, [selectedTable, orderItems, saveDrafts, isMobile]);

  // ─── Table selection ───────────────────────
  const handleSelectTable = useCallback((t: Table) => {
    if (selectedTable) {
      saveDrafts(selectedTable.id, orderItems);
    }
    setSelectedTable(t);
    const existingOrders = getTableOrders(t.id);
    const sentItems = existingOrders.length > 0
      ? existingOrders.flatMap(o => o.items.map(i => ({ ...i, _fromDB: true } as any)))
      : [];
    const drafts = draftItemsRef.current.get(t.id) || [];
    setOrderItems([...sentItems, ...drafts]);
    if (isMobile) setMobileTab('menu');
  }, [getTableOrders, isMobile, selectedTable, orderItems, saveDrafts]);

  // ─── Computed values ───────────────────────
  const total = useMemo(
    () => orderItems.reduce((sum, i) => {
      const modExtra = i.modifiers.reduce((s, m) => s + m.extraPrice, 0);
      return sum + (i.menuItem.price + modExtra) * i.quantity;
    }, 0),
    [orderItems]
  );

  const tableOrders = selectedTable ? orders.filter(o => o.tableId === selectedTable.id && o.status !== 'paid') : [];
  const totalPaid = tableOrders.reduce((sum, o) => sum + (o.payments || []).reduce((s, p) => s + p.amount, 0), 0);
  const totalPrepayment = tableOrders.reduce((sum, o) => (o.payments || []).filter(p => p.type === 'prepayment').reduce((s, p) => s + p.amount, sum), 0);
  const ikramDeduction = useMemo(
    () => orderItems.filter(i => ikramItems.has(i.id)).reduce((sum, i) => {
      const ext = i.modifiers.reduce((s, m) => s + m.extraPrice, 0);
      return sum + (i.menuItem.price + ext) * i.quantity;
    }, 0),
    [orderItems, ikramItems]
  );
  const effectiveTotal = total - ikramDeduction;
  const remainingAmount = Math.max(0, effectiveTotal - totalPaid);
  const newItemCount = orderItems.filter(i => !(i as any)._fromDB).length;
  const hasActiveOrders = selectedTable ? orders.some(o => o.tableId === selectedTable.id && o.status === 'active') : false;

  // ─── Item management ───────────────────────
  const handleItemTap = useCallback((item: MenuItem) => {
    if (!selectedTable) {
      toast.warning('Önce bir masa seçin');
      return;
    }
    const linked = productModifierMap.get(item.id) || [];
    if (linked.length > 0) {
      if (isMobile) {
        setMobileModifierItem(item);
      } else {
        setExpandedItemId(prev => prev === item.id ? null : item.id);
      }
    } else {
      addItemDirect(item, [], '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, productModifierMap, isMobile]);

  const addItemDirect = (item: MenuItem, modifiers: OrderItemModifier[], note: string) => {
    setOrderItems(prev => {
      if (modifiers.length === 0 && !note) {
        const existing = prev.find(i => i.menuItem.id === item.id && i.modifiers.length === 0 && !i.note && !(i as any)._fromDB);
        if (existing) return prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: Date.now().toString(), menuItem: item, quantity: 1, modifiers, note: note || undefined }];
    });
  };

  const handleConfirmModifiers = (item: MenuItem, modifiers: OrderItemModifier[], note: string, quantity: number) => {
    for (let i = 0; i < quantity; i++) {
      addItemDirect(item, modifiers, note);
    }
    setExpandedItemId(null);
    setMobileModifierItem(null);
  };

  const handleRemoveItem = (itemId: string) => {
    const item = orderItems.find(i => i.id === itemId);
    if ((item as any)?._fromDB) {
      setShowSentWarning(itemId);
    } else {
      setOrderItems(prev => prev.filter(i => i.id !== itemId));
    }
  };

  const confirmSentEdit = () => {
    if (showSentWarning) {
      setOrderItems(prev => prev.filter(i => i.id !== showSentWarning));
      setShowSentWarning(null);
      toast.info('Mutfağa bildirildi: Ürün değiştirildi');
    }
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    const item = orderItems.find(i => i.id === itemId);
    if ((item as any)?._fromDB && delta < 0) {
      setShowSentWarning(itemId);
      return;
    }
    setOrderItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? null! : { ...i, quantity: newQty };
    }).filter(Boolean));
  };

  const handleEditNote = (itemId: string) => {
    const item = orderItems.find(i => i.id === itemId);
    setEditNoteId(editNoteId === itemId ? null : itemId);
    setEditNoteText(item?.note || '');
  };

  const handleSaveNote = (itemId: string) => {
    setOrderItems(prev => prev.map(i => i.id === itemId ? { ...i, note: editNoteText || undefined } : i));
    setEditNoteId(null);
    setEditNoteText('');
  };

  // ─── Kitchen & order actions ───────────────
  const sendToKitchen = async () => {
    if (!selectedTable || orderItems.length === 0) return;
    const newItems = orderItems.filter(i => !(i as any)._fromDB);
    if (newItems.length === 0) {
      toast.info('Tüm ürünler zaten mutfağa gönderildi');
      return;
    }
    const newItemsTotal = newItems.reduce((sum, i) => {
      const modExtra = i.modifiers.reduce((s, m) => s + m.extraPrice, 0);
      return sum + (i.menuItem.price + modExtra) * i.quantity;
    }, 0);
    const result = await addOrder({
      id: Date.now().toString(),
      tableId: selectedTable.id,
      tableName: selectedTable.name,
      items: newItems,
      status: 'active',
      createdAt: new Date(),
      total: newItemsTotal,
    });
    if (!result.success) {
      toast.error(`Sipariş gönderilemedi: ${result.error || 'Veritabanı hatası. Lütfen tekrar deneyin.'}`);
      return;
    }
    openTable(selectedTable.id);
    setTableTotal(selectedTable.id, total);
    toast.success('Sipariş mutfağa gönderildi!');
    playSuccess();

    // Auto-print kitchen ticket if QZ Tray is connected
    if (getQZStatus() === 'connected') {
      printKitchenTicket({
        tableName: selectedTable.name,
        staffName: staffName || undefined,
        orderId: Date.now().toString(),
        items: newItems,
        restaurantName: restaurantName || 'RESTORAN',
      }, printerConfig);
    }

    draftItemsRef.current.delete(selectedTable.id);
    // Reload sent items from DB
    const existingOrders = getTableOrders(selectedTable.id);
    const sentItems = existingOrders.flatMap(o => o.items.map(i => ({ ...i, _fromDB: true } as any)));
    setOrderItems(sentItems);
  };

  const clearOrder = () => {
    const hasKitchenItems = orderItems.some(i => (i as any)._fromDB);
    if (hasKitchenItems) {
      setOrderItems(prev => prev.filter(i => (i as any)._fromDB));
      toast.info('Gönderilmemiş ürünler temizlendi');
    } else {
      setOrderItems([]);
    }
    if (selectedTable) draftItemsRef.current.delete(selectedTable.id);
  };

  const printAdisyonHandler = () => {
    if (!selectedTable || orderItems.length === 0) return;
    const items = orderItems.map(i => ({
      name: i.menuItem.name,
      qty: i.quantity,
      unitPrice: i.menuItem.price + i.modifiers.reduce((s, m) => s + m.extraPrice, 0),
    }));
    printAdisyon({
      restaurantName: restaurantName || 'RESTORAN',
      tableName: selectedTable.name,
      staffName: staffName || '',
      items,
      total,
    }, printerConfig);
  };

  const handleMarkReady = async () => {
    if (!selectedTable) return;
    const activeOrders = orders.filter(o => o.tableId === selectedTable.id && o.status === 'active');
    if (activeOrders.length === 0) {
      toast.info('Hazır işaretlenecek aktif sipariş yok');
      return;
    }
    for (const o of activeOrders) {
      await markOrderReady(o.id);
    }
    toast.success('Sipariş hazır — ödeme bekleniyor');
  };

  // ─── Action log ────────────────────────────
  const appendLog = useCallback((message: string, type: ActionLogEntry['type']) => {
    setActionLog(prev => [...prev, { id: crypto.randomUUID(), ts: new Date(), message, type }]);
  }, []);

  // ─── Payment handlers ─────────────────────
  const handleCompletePayment = async (amount: number, method: string, discountAmount?: number, discountReason?: string) => {
    const targetOrder = tableOrders.find(o => o.status === 'ready') || tableOrders[0];
    if (!targetOrder || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await completePayment(targetOrder.id, amount, method, staffId || undefined, discountAmount, discountReason);
      const remaining = tableOrders.filter(o => o.id !== targetOrder.id);
      appendLog(`${amount} ₺ ${method === 'nakit' ? 'nakit' : 'kart'} ödeme alındı`, 'payment');
      toast.success(remaining.length > 0
        ? `${amount} ₺ ödeme alındı — ${remaining.length} sipariş kaldı`
        : `${amount} ₺ ödeme tamamlandı — ${selectedTable?.name} kapatıldı`
      );
      playSuccess();

      // Auto-print payment receipt if table fully paid and QZ connected
      if (remaining.length === 0 && getQZStatus() === 'connected') {
        const allItems = tableOrders.flatMap(o => o.items);
        const allPayments = tableOrders.flatMap(o => o.payments || []);
        printPaymentReceipt({
          restaurantName: restaurantName || 'RESTORAN',
          tableName: selectedTable?.name || '',
          staffName: staffName || undefined,
          items: allItems,
          total: total,
          payments: [...allPayments, { id: '', orderId: targetOrder.id, amount, method: method as any, type: 'payment' as const, createdAt: new Date() }],
          orderIds: tableOrders.map(o => o.id),
          discountAmount,
          discountReason,
        }, printerConfig);
      }
    } catch {
      toast.error('Ödeme işlemi başarısız');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrepayment = async (amount: number, method: string) => {
    const targetOrder = tableOrders[0];
    if (!targetOrder || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await recordPrepayment(targetOrder.id, amount, method);
      appendLog(`${amount} ₺ ön ödeme alındı`, 'payment');
      toast.success(`${amount} ₺ ön ödeme alındı`);
    } catch {
      toast.error('Ön ödeme kaydedilemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayOrderItems = async (itemIds: string[], amount: number, method: string, discountAmount?: number, discountReason?: string) => {
    if (isSubmitting || tableOrders.length === 0) return;
    setIsSubmitting(true);
    try {
      const itemsByOrder = new Map<string, string[]>();
      for (const itemId of itemIds) {
        const parentOrder = tableOrders.find(o => o.items.some(i => i.id === itemId));
        if (parentOrder) {
          const existing = itemsByOrder.get(parentOrder.id) || [];
          existing.push(itemId);
          itemsByOrder.set(parentOrder.id, existing);
        }
      }
      for (const [orderId, orderItemIds] of itemsByOrder) {
        const orderAmount = tableOrders.find(o => o.id === orderId)!.items
          .filter(i => orderItemIds.includes(i.id))
          .reduce((sum, i) => {
            const modExtra = i.modifiers.reduce((s, m) => s + m.extraPrice, 0);
            return sum + (i.menuItem.price + modExtra) * i.quantity;
          }, 0);
        await payOrderItems(orderId, orderItemIds, orderAmount, method, discountAmount, discountReason);
      }
      appendLog(`${amount} ₺ ürün bazlı ödeme`, 'payment');
      toast.success(`${amount} ₺ ürün bazlı ödeme tamamlandı`);
      playSuccess();
    } catch {
      toast.error('Ürün bazlı ödeme başarısız');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Void / Return / Refund ───────────────
  const handleVoidItem = useCallback(async (itemId: string) => {
    const parentOrder = tableOrders.find(o => o.items.some(i => i.id === itemId));
    if (!parentOrder) return;
    const itemName = parentOrder.items.find(i => i.id === itemId)?.menuItem.name || '';
    await voidItem(parentOrder.id, itemId);
    appendLog(`İptal: ${itemName}`, 'void');
    toast.info(`${itemName} iptal edildi`);
    setSelectedItemId(null);
  }, [tableOrders, voidItem, appendLog]);

  const handleReturnItem = useCallback(async (itemId: string) => {
    const parentOrder = tableOrders.find(o => o.items.some(i => i.id === itemId));
    if (!parentOrder) return;
    const itemName = parentOrder.items.find(i => i.id === itemId)?.menuItem.name || '';
    await returnItem(parentOrder.id, itemId);
    appendLog(`İade: ${itemName}`, 'return');
    toast.info(`${itemName} iade edildi`);
    setSelectedItemId(null);
  }, [tableOrders, returnItem, appendLog]);

  const handleRefundPayment = useCallback(async (amount: number, method: string) => {
    const targetOrder = tableOrders[0];
    if (!targetOrder || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await refundPayment(targetOrder.id, amount, method);
      appendLog(`${amount} ₺ iade (${method === 'nakit' ? 'nakit' : 'kart'})`, 'refund');
      toast.success(`${amount} ₺ iade edildi`);
    } catch {
      toast.error('İade başarısız');
    } finally {
      setIsSubmitting(false);
    }
  }, [tableOrders, refundPayment, appendLog, isSubmitting]);

  const handleItemDiscount = useCallback(async (itemId: string, amount: number, reason: string) => {
    const parentOrder = tableOrders.find(o => o.items.some(i => i.id === itemId));
    if (!parentOrder) return;
    const itemName = parentOrder.items.find(i => i.id === itemId)?.menuItem.name || '';
    await applyItemDiscount(parentOrder.id, itemId, amount, reason);
    appendLog(`İndirim: ${itemName} -${amount}₺ (${reason})`, 'discount');
    toast.success(`${itemName} için ${amount} ₺ indirim uygulandı`);
  }, [tableOrders, applyItemDiscount, appendLog]);

  const handleOrderDiscount = useCallback((amount: number, reason: string) => {
    if (amount > 0) appendLog(`Sipariş indirimi: -${amount}₺ (${reason})`, 'discount');
  }, [appendLog]);

  // ─── Ikram toggle ─────────────────────────
  const handleToggleIkram = () => {
    if (!selectedItemId) return;
    setIkramItems(prev => {
      const next = new Set(prev);
      next.has(selectedItemId) ? next.delete(selectedItemId) : next.add(selectedItemId);
      return next;
    });
  };

  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    setShowSearch(false);
    setSearchQuery('');
    setExpandedItemId(null);
  };

  const navigateOut = () => { logout(); navigate(`/pos/${session?.type === 'staff' ? session.slug : ''}`); };

  // ─── Shared order panel props ──────────────
  const orderPanelProps = {
    selectedTable,
    orderItems,
    total,
    totalPaid,
    remainingAmount,
    ikramItems,
    editNoteId,
    editNoteText,
    selectedItemId,
    onSelectItem: setSelectedItemId,
    onEditNote: handleEditNote,
    onSaveNote: handleSaveNote,
    onEditNoteTextChange: setEditNoteText,
    onPrintAdisyon: printAdisyonHandler,
    onUpdateQty: handleUpdateQty,
    onRemoveItem: handleRemoveItem,
    onToggleIkram: (id: string) => {
      setIkramItems(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    },
    onVoidItem: handleVoidItem,
    onReturnItem: handleReturnItem,
    newItemCount,
    onSendToKitchen: sendToKitchen,
    onClearOrder: clearOrder,
    isSubmitting,
  };

  // ─── Mobile Layout ─────────────────────────

  if (isMobile) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-background">
        <header className="flex items-center gap-2 px-3 py-2 bg-card border-b shrink-0">
          {mobileTab === 'tables' ? (
            <button onClick={navigateOut} className="p-2 rounded-md hover:bg-muted pos-btn">
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={() => {
              if (mobileTab === 'order') { setMobileTab('menu'); }
              else { leaveTable(); }
            }} className="p-2 rounded-md hover:bg-muted pos-btn">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h1 className="text-base font-bold truncate">
            {mobileTab === 'tables' ? 'Kasa POS' : mobileTab === 'menu' ? 'Menü' : 'Sipariş'}
          </h1>
          {staffName && <span className="text-xs text-muted-foreground font-medium">({staffName})</span>}
          {selectedTable && (
            <div className="ml-auto flex items-center gap-1.5">
              {selectedTable.openedAt && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-medium">
                  <Clock className="w-3 h-3" /> {formatDuration(selectedTable.openedAt)}
                </span>
              )}
              <span className="px-2 py-1 rounded-md bg-primary/10 text-primary font-bold text-xs">{selectedTable.name}</span>
            </div>
          )}
        </header>

        <div className="flex-1 min-h-0 flex flex-col">
          {mobileTab === 'tables' && (
            <TableGrid
              tables={tables}
              orders={orders}
              floors={floors}
              selectedFloor={selectedFloor}
              onSelectFloor={setSelectedFloor}
              onSelectTable={handleSelectTable}
            />
          )}

          {mobileTab === 'menu' && selectedTable && (
            <>
              <CategorySidebar
                categories={categories}
                selectedCategory={selectedCategory}
                showSearch={showSearch}
                onSelectCategory={handleSelectCategory}
                horizontal
              />
              <ProductGrid
                menuItems={menuItems}
                selectedCategory={selectedCategory}
                showSearch={showSearch}
                searchQuery={searchQuery}
                onToggleSearch={() => { setShowSearch(!showSearch); setSearchQuery(''); }}
                onSearchChange={setSearchQuery}
                onItemTap={handleItemTap}
                hideBackButton
              />
            </>
          )}

          {mobileTab === 'order' && (
            <CashierOrderPanel {...orderPanelProps} fullWidth />
          )}
        </div>

        {/* Bottom order banner — menu step only */}
        {mobileTab === 'menu' && selectedTable && (
          <div
            onClick={() => setMobileTab('order')}
            className="shrink-0 border-t bg-primary text-primary-foreground px-4 py-3.5 flex items-center justify-between cursor-pointer active:opacity-90 touch-manipulation"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span className="font-bold">
                {newItemCount > 0 ? `${newItemCount} ürün · ${total} ₺` : 'Sipariş'}
              </span>
            </div>
            <span className="text-sm font-semibold">Sipariş →</span>
          </div>
        )}

        {/* Mobile Bottom Sheet Modifiers */}
        {mobileModifierItem && (
          <BottomSheetModifiers
            item={mobileModifierItem}
            modifierGroups={modifierGroups}
            productModifierMap={productModifierMap}
            onConfirm={(mods, note, qty) => handleConfirmModifiers(mobileModifierItem, mods, note, qty)}
            onCancel={() => setMobileModifierItem(null)}
          />
        )}

        {/* Sent Item Warning */}
        {showSentWarning && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowSentWarning(null)}>
            <div className="bg-card rounded-lg w-full max-w-sm mx-4 shadow-lg animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-5 text-center">
                <AlertTriangle className="w-12 h-12 text-pos-warning mx-auto mb-3" />
                <h3 className="text-lg font-bold mb-2">Dikkat!</h3>
                <p className="text-sm text-muted-foreground">Bu ürün mutfağa gönderildi. Değiştirmek istediğinize emin misiniz?</p>
              </div>
              <div className="p-4 border-t flex gap-2">
                <button onClick={() => setShowSentWarning(null)} className="flex-1 py-3 rounded-md bg-muted font-semibold text-sm pos-btn">İptal</button>
                <button onClick={confirmSentEdit} className="flex-1 py-3 rounded-md bg-pos-danger text-pos-danger-foreground font-bold text-sm pos-btn">Evet, Değiştir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Desktop 3-Column Layout ───────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-2 px-3 py-2 bg-card border-b shrink-0">
        {selectedTable ? (
          <button onClick={leaveTable} className="flex items-center gap-1.5 p-2 rounded-md hover:bg-muted pos-btn text-sm font-semibold">
            <ArrowLeft className="w-5 h-5" /> Masalar
          </button>
        ) : (
          <button onClick={navigateOut} className="p-2 rounded-md hover:bg-muted pos-btn">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <Banknote className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold">Kasa POS</h1>
        {staffName && <span className="text-xs text-muted-foreground font-medium ml-1">({staffName})</span>}
        {selectedTable && (
          <div className="ml-auto flex items-center gap-2">
            {selectedTable.openedAt && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                <Clock className="w-3 h-3" /> {formatDuration(selectedTable.openedAt)}
              </span>
            )}
            <span className="px-3 py-1 rounded-md bg-primary/10 text-primary font-bold text-sm">{selectedTable.name}</span>
          </div>
        )}
        <button onClick={navigateOut} className="ml-auto p-2 rounded-md hover:bg-muted pos-btn" title="Çıkış">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* State 1: No table selected — full-screen table grid */}
      {!selectedTable && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <TableGrid
            tables={tables}
            orders={orders}
            floors={floors}
            selectedFloor={selectedFloor}
            onSelectFloor={setSelectedFloor}
            onSelectTable={handleSelectTable}
            fullscreen
          />
        </div>
      )}

      {/* State 2: Table selected — 3-column layout */}
      {selectedTable && (
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* LEFT 25%: Order Panel */}
          <div className="w-[25%] shrink-0 border-r flex flex-col min-h-0 overflow-hidden">
            <CashierOrderPanel {...orderPanelProps} />
          </div>

          {/* CENTRE 45%: Categories + Products */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-r">
            <CategorySidebar
              categories={categories}
              selectedCategory={selectedCategory}
              showSearch={showSearch}
              onSelectCategory={handleSelectCategory}
              horizontal
            />
            <ProductGrid
              menuItems={menuItems}
              selectedCategory={selectedCategory}
              showSearch={showSearch}
              searchQuery={searchQuery}
              onToggleSearch={() => { setShowSearch(!showSearch); setSearchQuery(''); }}
              onSearchChange={setSearchQuery}
              onItemTap={handleItemTap}
              hideBackButton
              expandedItemId={expandedItemId}
              modifierGroups={modifierGroups}
              productModifierMap={productModifierMap}
              onConfirmModifiers={handleConfirmModifiers}
              onCancelModifiers={() => setExpandedItemId(null)}
            />
          </div>

          {/* RIGHT 30%: Payment Panel */}
          <div className="w-[30%] shrink-0 flex flex-col min-h-0 overflow-hidden">
            <CashierPaymentPanel
              tableOrders={tableOrders}
              tableName={selectedTable?.name || ''}
              restaurantName={restaurantName || 'RESTORAN'}
              staffName={staffName || ''}
              isSubmitting={isSubmitting}
              onCompletePayment={handleCompletePayment}
              onPrepayment={handlePrepayment}
              onPayOrderItems={handlePayOrderItems}
              onMarkReady={handleMarkReady}
              onPrintAdisyon={printAdisyonHandler}
            />
          </div>
        </div>
      )}

      {/* Sent Item Warning */}
      {showSentWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowSentWarning(null)}>
          <div className="bg-card rounded-lg w-full max-w-sm mx-4 shadow-lg animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 text-center">
              <AlertTriangle className="w-12 h-12 text-pos-warning mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-2">Dikkat!</h3>
              <p className="text-sm text-muted-foreground">Bu ürün mutfağa gönderildi. Değiştirmek istediğinize emin misiniz?</p>
            </div>
            <div className="p-4 border-t flex gap-2">
              <button onClick={() => setShowSentWarning(null)} className="flex-1 py-3 rounded-md bg-muted font-semibold text-sm pos-btn">İptal</button>
              <button onClick={confirmSentEdit} className="flex-1 py-3 rounded-md bg-pos-danger text-pos-danger-foreground font-bold text-sm pos-btn">Evet, Değiştir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
