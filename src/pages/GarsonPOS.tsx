import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { OrderItem, Table, MenuItem, OrderItemModifier } from '@/types/pos';
import { ArrowLeft, Clock, LogOut, AlertTriangle, LayoutGrid, UtensilsCrossed, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatAdisyon, printReceipt } from '@/lib/receipt';
import { playSuccess } from '@/lib/sound';
import { useIsMobile } from '@/hooks/use-mobile';

import TableGrid from '@/components/waiter/TableGrid';
import OrderPanel from '@/components/waiter/OrderPanel';
import ProductGrid from '@/components/waiter/ProductGrid';
import CategorySidebar from '@/components/waiter/CategorySidebar';
import ModifierModal from '@/components/waiter/ModifierModal';

function formatDuration(openedAt?: Date) {
  if (!openedAt) return '';
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
  if (mins < 1) return 'Az önce';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

type MobileTab = 'tables' | 'menu' | 'order';

export default function GarsonPOS() {
  const {
    tables, categories, menuItems, addOrder, getTableOrders,
    setTableTotal, openTable, modifierGroups, floors,
    orders, restaurantName, productModifierMap,
  } = usePOS();
  const { session, logout } = useAuth();
  const staffName = session?.name || null;
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id || '');
  const [selectedFloor, setSelectedFloor] = useState(floors[0]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const draftItemsRef = useRef<Map<string, OrderItem[]>>(new Map());
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [showSentWarning, setShowSentWarning] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('tables');
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-reset when cashier completes payment — table TRANSITIONS to 'available' via realtime.
  // The ref tracks the previous status so we only reset on a STATUS CHANGE to 'available',
  // not when the waiter first selects a table that is already 'available'.
  const currentTableInContext = selectedTable ? tables.find(t => t.id === selectedTable.id) : undefined;
  const prevTableStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const curr = currentTableInContext?.status;
    const prev = prevTableStatusRef.current;
    prevTableStatusRef.current = curr;
    // Only fire if we were tracking a non-available state and it just became available
    if (selectedTable && curr === 'available' && prev !== undefined && prev !== 'available') {
      draftItemsRef.current.delete(selectedTable.id);
      setSelectedTable(null);
      setOrderItems([]);
      if (isMobile) setMobileTab('tables');
      toast.success(`${selectedTable.name} ödeme tamamlandı`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTableInContext?.status]);

  const saveDrafts = useCallback((tableId: string, items: OrderItem[]) => {
    const unsent = items.filter(i => !i.sentToKitchen);
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
    if (isMobile) setMobileTab('tables');
  }, [selectedTable, orderItems, saveDrafts, isMobile]);

  const handleSelectTable = useCallback((t: Table) => {
    if (t.status === 'waiting_payment') {
      toast.info('Ödeme bekleniyor — müşteriyi kasaya yönlendirin');
      return;
    }
    if (selectedTable) {
      saveDrafts(selectedTable.id, orderItems);
    }
    setSelectedTable(t);
    const existingOrders = getTableOrders(t.id);
    const sentItems = existingOrders.length > 0
      ? existingOrders.flatMap(o => o.items.map(i => ({ ...i, sentToKitchen: true })))
      : [];
    const drafts = draftItemsRef.current.get(t.id) || [];
    setOrderItems([...sentItems, ...drafts]);
    if (isMobile) setMobileTab('menu');
  }, [getTableOrders, isMobile, selectedTable, orderItems, saveDrafts]);

  const total = useMemo(
    () => orderItems.reduce((sum, i) => {
      const modExtra = i.modifiers.reduce((s, m) => s + m.extraPrice, 0);
      return sum + (i.menuItem.price + modExtra) * i.quantity;
    }, 0),
    [orderItems]
  );

  const tableOrders = selectedTable ? orders.filter(o => o.tableId === selectedTable.id && o.status !== 'paid' && o.status !== 'closed') : [];
  const totalPaid = tableOrders.reduce((sum, o) => sum + (o.payments || []).reduce((s, p) => s + p.amount, 0), 0);
  const totalPrepayment = tableOrders.reduce((sum, o) => (o.payments || []).filter(p => p.type === 'prepayment').reduce((s, p) => s + p.amount, sum), 0);
  const remainingAmount = Math.max(0, total - totalPaid);

  const newItemCount = orderItems.filter(i => !i.sentToKitchen).length;

  const handleItemTap = useCallback((item: MenuItem) => {
    if (!selectedTable) return;
    const linked = productModifierMap.get(item.id);
    if (item.hasModifiers && linked && linked.length > 0) {
      setPendingItem(item);
      setShowModifierModal(true);
    } else {
      addItemDirect(item, [], '');
    }
  }, [selectedTable, productModifierMap]);

  const addItemDirect = (item: MenuItem, modifiers: OrderItemModifier[], note: string) => {
    setOrderItems(prev => {
      if (modifiers.length === 0 && !note) {
        const existing = prev.find(i => i.menuItem.id === item.id && i.modifiers.length === 0 && !i.note && !i.sentToKitchen);
        if (existing) return prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: Date.now().toString(), menuItem: item, quantity: 1, modifiers, note: note || undefined, sentToKitchen: false }];
    });
  };

  const handleConfirmModifiers = (modifiers: OrderItemModifier[], note: string) => {
    if (!pendingItem) return;
    addItemDirect(pendingItem, modifiers, note);
    setShowModifierModal(false);
    setPendingItem(null);
  };

  const handleRemoveItem = (itemId: string) => {
    const item = orderItems.find(i => i.id === itemId);
    if (item?.sentToKitchen) {
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
    if (item?.sentToKitchen && delta < 0) {
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

  const sendToKitchen = async () => {
    if (!selectedTable || orderItems.length === 0) return;
    const newItems = orderItems.filter(i => !i.sentToKitchen);
    if (newItems.length === 0) {
      toast.info('Tum urunler zaten mutfaga gonderildi');
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
      status: 'sent_to_kitchen',
      createdAt: new Date(),
      total: newItemsTotal,
    });
    if (!result.success) {
      toast.error(`Siparis gonderilemedi: ${result.error || 'Veritabani hatasi. Lutfen tekrar deneyin.'}`);
      return;
    }
    openTable(selectedTable.id);
    setTableTotal(selectedTable.id, total);
    toast.success('Siparis mutfaga gonderildi!');
    playSuccess();
    draftItemsRef.current.delete(selectedTable.id);
    setSelectedTable(null);
    setOrderItems([]);
    if (isMobile) setMobileTab('tables');
  };

  const clearOrder = () => {
    const hasKitchenItems = orderItems.some(i => i.sentToKitchen);
    if (hasKitchenItems) {
      setOrderItems(prev => prev.filter(i => i.sentToKitchen));
      toast.info('Gönderilmemiş ürünler temizlendi');
    } else {
      setOrderItems([]);
    }
    if (selectedTable) draftItemsRef.current.delete(selectedTable.id);
  };

  const printAdisyon = () => {
    if (!selectedTable || orderItems.length === 0) return;
    const items = orderItems.map(i => ({
      name: i.menuItem.name,
      qty: i.quantity,
      unitPrice: i.menuItem.price + i.modifiers.reduce((s, m) => s + m.extraPrice, 0),
    }));
    printReceipt(
      formatAdisyon({
        restaurantName: restaurantName || 'RESTORAN',
        tableName: selectedTable.name,
        staffName: staffName || '',
        date: new Date(),
        items,
        total,
      }),
      'Adisyon'
    );
  };

  useEffect(() => {
    for (const [tableId] of draftItemsRef.current) {
      const t = tables.find(tb => tb.id === tableId);
      if (!t || t.status === 'available') {
        draftItemsRef.current.delete(tableId);
      }
    }
  }, [tables]);

  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    setShowSearch(false);
    setSearchQuery('');
  };

  // ─── Mobile Layout ──────────────────────────────

  if (isMobile) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-background">
        {/* Mobile Header */}
        <header className="flex items-center gap-2 px-3 py-2 bg-card border-b shrink-0">
          <button onClick={() => { logout(); navigate(`/pos/${session?.type === 'staff' ? session.slug : ''}`); }} className="p-2 rounded-lg hover:bg-muted pos-btn">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold truncate">Garson POS</h1>
          {staffName && <span className="text-xs text-muted-foreground font-medium">({staffName})</span>}
          {selectedTable && (
            <div className="ml-auto flex items-center gap-1.5">
              {selectedTable.openedAt && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-muted text-muted-foreground text-[10px] font-medium">
                  <Clock className="w-3 h-3" /> {formatDuration(selectedTable.openedAt)}
                </span>
              )}
              <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary font-bold text-xs">{selectedTable.name}</span>
            </div>
          )}
        </header>

        {/* Mobile Content */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
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
            <div className="flex flex-col h-full">
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
                onBackToTables={leaveTable}
              />
            </div>
          )}
          {mobileTab === 'menu' && !selectedTable && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Önce bir masa seçin
            </div>
          )}
          {mobileTab === 'order' && (
            <OrderPanel
              selectedTable={selectedTable}
              orderItems={orderItems}
              total={total}
              totalPaid={totalPaid}
              totalPrepayment={totalPrepayment}
              remainingAmount={remainingAmount}
              editNoteId={editNoteId}
              editNoteText={editNoteText}
              onUpdateQty={handleUpdateQty}
              onRemoveItem={handleRemoveItem}
              onEditNote={handleEditNote}
              onSaveNote={handleSaveNote}
              onEditNoteTextChange={setEditNoteText}
              onSendToKitchen={sendToKitchen}
              onClearOrder={clearOrder}
              onPrintAdisyon={printAdisyon}
              fullWidth
            />
          )}
        </div>

        {/* Floating Cart Bar */}
        {mobileTab === 'menu' && newItemCount > 0 && (
          <div
            onClick={() => setMobileTab('order')}
            className="shrink-0 border-t bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between cursor-pointer active:opacity-90"
          >
            <span className="font-bold">{newItemCount} ürün &middot; {total} TL</span>
            <span className="text-sm font-semibold">Sepeti Gör &rarr;</span>
          </div>
        )}

        {/* Mobile Bottom Tab Bar */}
        <nav className="shrink-0 border-t bg-card flex">
          <button
            onClick={() => setMobileTab('tables')}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold pos-btn ${
              mobileTab === 'tables' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            Masalar
          </button>
          <button
            onClick={() => setMobileTab('menu')}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold pos-btn ${
              mobileTab === 'menu' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <UtensilsCrossed className="w-5 h-5" />
            Menü
          </button>
          <button
            onClick={() => setMobileTab('order')}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold pos-btn relative ${
              mobileTab === 'order' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            Sipariş
            {newItemCount > 0 && (
              <span className="absolute top-1 right-1/4 w-5 h-5 rounded-full bg-pos-danger text-pos-danger-foreground text-[10px] font-bold flex items-center justify-center">
                {newItemCount}
              </span>
            )}
          </button>
        </nav>

        {/* Modifier Modal */}
        {showModifierModal && pendingItem && (
          <ModifierModal
            item={pendingItem}
            modifierGroups={modifierGroups}
            productModifierMap={productModifierMap}
            onConfirm={handleConfirmModifiers}
            onCancel={() => { setShowModifierModal(false); setPendingItem(null); }}
          />
        )}

        {/* Sent Item Warning */}
        {showSentWarning && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowSentWarning(null)}>
            <div className="bg-card rounded-2xl w-full max-w-sm mx-4 shadow-2xl animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-5 text-center">
                <AlertTriangle className="w-12 h-12 text-pos-warning mx-auto mb-3" />
                <h3 className="text-lg font-black mb-2">Dikkat!</h3>
                <p className="text-sm text-muted-foreground">Bu ürün mutfağa gönderildi. Değiştirmek istediğinize emin misiniz?</p>
              </div>
              <div className="p-4 border-t flex gap-2">
                <button onClick={() => setShowSentWarning(null)} className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm pos-btn">İptal</button>
                <button onClick={confirmSentEdit} className="flex-1 py-3 rounded-xl bg-pos-danger text-pos-danger-foreground font-bold text-sm pos-btn">Evet, Değiştir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Desktop Layout ─────────────────────────────

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center gap-2 px-3 py-2 bg-card border-b shrink-0">
        <button onClick={() => { logout(); navigate(`/pos/${session?.type === 'staff' ? session.slug : ''}`); }} className="p-2 rounded-lg hover:bg-muted pos-btn">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Garson POS</h1>
        {staffName && <span className="text-xs text-muted-foreground font-medium ml-1">({staffName})</span>}
        {selectedTable && (
          <div className="ml-auto flex items-center gap-2">
            {selectedTable.openedAt && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-medium">
                <Clock className="w-3 h-3" /> {formatDuration(selectedTable.openedAt)}
              </span>
            )}
            <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary font-bold text-sm">{selectedTable.name}</span>
          </div>
        )}
        {!selectedTable && (
          <button onClick={() => { logout(); navigate(`/pos/${session?.type === 'staff' ? session.slug : ''}`); }} className="ml-auto p-2 rounded-lg hover:bg-muted pos-btn" title="Çıkış">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {selectedTable && (
          <OrderPanel
            selectedTable={selectedTable}
            orderItems={orderItems}
            total={total}
            totalPaid={totalPaid}
            totalPrepayment={totalPrepayment}
            remainingAmount={remainingAmount}
            editNoteId={editNoteId}
            editNoteText={editNoteText}
            onUpdateQty={handleUpdateQty}
            onRemoveItem={handleRemoveItem}
            onEditNote={handleEditNote}
            onSaveNote={handleSaveNote}
            onEditNoteTextChange={setEditNoteText}
            onSendToKitchen={sendToKitchen}
            onClearOrder={clearOrder}
            onPrintAdisyon={printAdisyon}
          />
        )}

        {!selectedTable ? (
          <TableGrid
            tables={tables}
            orders={orders}
            floors={floors}
            selectedFloor={selectedFloor}
            onSelectFloor={setSelectedFloor}
            onSelectTable={handleSelectTable}
          />
        ) : (
          <ProductGrid
            menuItems={menuItems}
            selectedCategory={selectedCategory}
            showSearch={showSearch}
            searchQuery={searchQuery}
            onToggleSearch={() => { setShowSearch(!showSearch); setSearchQuery(''); }}
            onSearchChange={setSearchQuery}
            onItemTap={handleItemTap}
            onBackToTables={leaveTable}
          />
        )}

        {selectedTable && (
          <CategorySidebar
            categories={categories}
            selectedCategory={selectedCategory}
            showSearch={showSearch}
            onSelectCategory={handleSelectCategory}
          />
        )}
      </div>

      {showModifierModal && pendingItem && (
        <ModifierModal
          item={pendingItem}
          modifierGroups={modifierGroups}
          productModifierMap={productModifierMap}
          onConfirm={handleConfirmModifiers}
          onCancel={() => { setShowModifierModal(false); setPendingItem(null); }}
        />
      )}

      {showSentWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowSentWarning(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm mx-4 shadow-2xl animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 text-center">
              <AlertTriangle className="w-12 h-12 text-pos-warning mx-auto mb-3" />
              <h3 className="text-lg font-black mb-2">Dikkat!</h3>
              <p className="text-sm text-muted-foreground">Bu ürün mutfağa gönderildi. Değiştirmek istediğinize emin misiniz?</p>
            </div>
            <div className="p-4 border-t flex gap-2">
              <button onClick={() => setShowSentWarning(null)} className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm pos-btn">İptal</button>
              <button onClick={confirmSentEdit} className="flex-1 py-3 rounded-xl bg-pos-danger text-pos-danger-foreground font-bold text-sm pos-btn">Evet, Değiştir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
