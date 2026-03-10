import { useState, useMemo, useCallback, useEffect } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { OrderItem, Table, MenuItem, OrderItemModifier, Payment } from '@/types/pos';
import { ArrowLeft, Minus, Plus, Send, Trash2, X, CreditCard, Banknote, Search, SplitSquareHorizontal, Clock, Edit3, MessageSquare, AlertTriangle, Users, Receipt, LogOut, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatAdisyon, printReceipt } from '@/lib/receipt';

function formatDuration(openedAt?: Date) {
  if (!openedAt) return '';
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
  if (mins < 1) return 'Az önce';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

export default function GarsonPOS() {
  const { tables, categories, menuItems, addOrder, getTableOrders, setTableStatus, setTableTotal, openTable, modifierGroups, floors, addPayment, orders, removeOrder, updateOrder, productModifierMap } = usePOS();
  const { session, logout } = useAuth();
  const staffName = session?.name || null;
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.id || '');
  const [selectedFloor, setSelectedFloor] = useState(floors[0]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [showPayment, setShowPayment] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [itemNote, setItemNote] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [showSentWarning, setShowSentWarning] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'normal' | 'split_item' | 'split_person'>('normal');
  const [selectedPayItems, setSelectedPayItems] = useState<Set<string>>(new Set());
  const [splitPersonCount, setSplitPersonCount] = useState(2);
  const [prepaymentAmount, setPrepaymentAmount] = useState('');
  const [showPrepayment, setShowPrepayment] = useState(false);
  const [paymentConfirm, setPaymentConfirm] = useState<{ method: string; amount: number } | null>(null);
  const [, setTick] = useState(0);

  // Refresh duration display every 30s
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Load existing order items when selecting occupied table
  const handleSelectTable = useCallback((t: Table) => {
    setSelectedTable(t);
    const existingOrders = getTableOrders(t.id);
    if (existingOrders.length > 0) {
      const allItems = existingOrders.flatMap(o => o.items.map(i => ({ ...i, sentToKitchen: true })));
      setOrderItems(allItems);
    } else {
      setOrderItems([]);
    }
    setShowPayment(false);
    setPaymentMode('normal');
    setSelectedPayItems(new Set());
  }, [getTableOrders]);

  const floorTables = useMemo(
    () => tables.filter(t => t.floor === selectedFloor),
    [tables, selectedFloor]
  );

  const filteredItems = useMemo(() => {
    if (showSearch && searchQuery) {
      return menuItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return menuItems.filter(i => i.categoryId === selectedCategory);
  }, [menuItems, selectedCategory, searchQuery, showSearch]);

  const total = useMemo(
    () => orderItems.reduce((sum, i) => {
      const modExtra = i.modifiers.reduce((s, m) => s + m.extraPrice, 0);
      return sum + (i.menuItem.price + modExtra) * i.quantity;
    }, 0),
    [orderItems]
  );

  // Calculate paid amount for current table
  const tableOrders = selectedTable ? orders.filter(o => o.tableId === selectedTable.id) : [];
  const totalPaid = tableOrders.reduce((sum, o) => {
    return sum + (o.payments || []).reduce((s, p) => s + p.amount, 0);
  }, 0);
  const totalPrepayment = tableOrders.reduce((sum, o) => sum + (o.prepayment || 0), 0);
  const remainingAmount = Math.max(0, total - totalPaid - totalPrepayment);

  const handleItemTap = useCallback((item: MenuItem) => {
    if (!selectedTable) return;
    if (item.hasModifiers) {
      setPendingItem(item);
      setSelectedModifiers({});
      setItemNote('');
      setShowModifierModal(true);
    } else {
      addItemDirect(item, [], '');
    }
  }, [selectedTable]);

  const addItemDirect = (item: MenuItem, modifiers: OrderItemModifier[], note: string) => {
    setOrderItems(prev => {
      if (modifiers.length === 0 && !note) {
        const existing = prev.find(i => i.menuItem.id === item.id && i.modifiers.length === 0 && !i.note && !i.sentToKitchen);
        if (existing) return prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: Date.now().toString(), menuItem: item, quantity: 1, modifiers, note: note || undefined, sentToKitchen: false }];
    });
  };

  const confirmModifiers = () => {
    if (!pendingItem) return;
    const modifiers: OrderItemModifier[] = [];
    for (const group of modifierGroups) {
      const selected = selectedModifiers[group.id] || [];
      for (const optId of selected) {
        const opt = group.options.find(o => o.id === optId);
        if (opt) modifiers.push({ groupName: group.name, optionName: opt.name, extraPrice: opt.extraPrice });
      }
    }
    addItemDirect(pendingItem, modifiers, itemNote);
    setShowModifierModal(false);
    setPendingItem(null);
    setItemNote('');
  };

  const toggleModifier = (groupId: string, optionId: string, type: 'checkbox' | 'radio') => {
    setSelectedModifiers(prev => {
      const current = prev[groupId] || [];
      if (type === 'radio') return { ...prev, [groupId]: [optionId] };
      return { ...prev, [groupId]: current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId] };
    });
  };

  const handleEditItem = (itemId: string) => {
    const item = orderItems.find(i => i.id === itemId);
    if (item?.sentToKitchen) {
      setShowSentWarning(itemId);
    } else {
      doRemoveItem(itemId);
    }
  };

  const confirmSentEdit = () => {
    if (showSentWarning) {
      doRemoveItem(showSentWarning);
      setShowSentWarning(null);
      toast.info('Mutfağa bildirildi: Ürün değiştirildi');
    }
  };

  const updateQty = (itemId: string, delta: number) => {
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

  const doRemoveItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(i => i.id !== itemId));
  };

  const saveItemNote = (itemId: string) => {
    setOrderItems(prev => prev.map(i => i.id === itemId ? { ...i, note: editNoteText || undefined } : i));
    setEditNoteId(null);
    setEditNoteText('');
  };

  const sendToKitchen = () => {
    if (!selectedTable || orderItems.length === 0) return;
    const newItems = orderItems.filter(i => !i.sentToKitchen);
    if (newItems.length === 0) {
      toast.info('Tüm ürünler zaten mutfağa gönderildi');
      return;
    }
    addOrder({
      id: Date.now().toString(),
      tableId: selectedTable.id,
      tableName: selectedTable.name,
      items: newItems,
      status: 'yeni',
      createdAt: new Date(),
      total,
    });
    openTable(selectedTable.id);
    setTableTotal(selectedTable.id, total);
    setOrderItems(prev => prev.map(i => ({ ...i, sentToKitchen: true })));
    toast.success('Sipariş mutfağa gönderildi!');
  };

  const clearOrder = () => {
    const hasKitchenItems = orderItems.some(i => i.sentToKitchen);
    if (hasKitchenItems) {
      setOrderItems(prev => prev.filter(i => i.sentToKitchen));
      toast.info('Gönderilmemiş ürünler temizlendi');
    } else {
      setOrderItems([]);
    }
  };

  const handleQuickCash = (amount: number) => {
    if (tableOrders.length > 0) {
      const payment: Payment = {
        id: Date.now().toString(),
        orderId: tableOrders[0].id,
        amount,
        method: 'nakit',
        createdAt: new Date(),
      };
      addPayment(tableOrders[0].id, payment);
    }
    toast.success(`${amount} ₺ nakit ödeme alındı`);
    const newPaid = totalPaid + amount;
    if (newPaid >= total) {
      closeTable();
    } else {
      setTableStatus(selectedTable!.id, 'odeme_bekliyor');
    }
  };

  const closeTable = () => {
    if (!selectedTable) return;
    setTableStatus(selectedTable.id, 'bos');
    setTableTotal(selectedTable.id, 0);
    // Remove all orders for this table
    tableOrders.forEach(o => removeOrder(o.id));
    setOrderItems([]);
    setSelectedTable(null);
    setShowPayment(false);
    setPaymentMode('normal');
    toast.success('Masa kapatıldı');
  };

  const handlePayment = (method: string) => {
    let payAmount = remainingAmount;

    if (paymentMode === 'split_item') {
      payAmount = orderItems
        .filter(i => selectedPayItems.has(i.id))
        .reduce((sum, i) => {
          const modExtra = i.modifiers.reduce((s, m) => s + m.extraPrice, 0);
          return sum + (i.menuItem.price + modExtra) * i.quantity;
        }, 0);
    } else if (paymentMode === 'split_person') {
      payAmount = Math.ceil(total / splitPersonCount);
    }

    setPaymentConfirm({ method, amount: payAmount });
  };

  const confirmPayment = () => {
    if (!paymentConfirm) return;
    const { method, amount: payAmount } = paymentConfirm;

    if (tableOrders.length > 0) {
      const payment: Payment = {
        id: Date.now().toString(),
        orderId: tableOrders[0].id,
        amount: payAmount,
        method: method === 'Nakit' ? 'nakit' : method === 'Kredi Kartı' ? 'kredi_karti' : 'bolunmus',
        createdAt: new Date(),
      };
      addPayment(tableOrders[0].id, payment);
    }

    toast.success(`${payAmount} ₺ ödeme alındı: ${method}`);
    setPaymentConfirm(null);

    const newPaid = totalPaid + payAmount;
    if (newPaid >= total) {
      // Auto-print adisyon on full payment
      if (selectedTable) {
        const items = orderItems.map(i => ({
          name: i.menuItem.name,
          qty: i.quantity,
          unitPrice: i.menuItem.price + i.modifiers.reduce((s, m) => s + m.extraPrice, 0),
        }));
        printReceipt(
          formatAdisyon({
            restaurantName: 'RESTORAN',
            tableName: selectedTable.name,
            staffName: staffName || '',
            date: new Date(),
            items,
            total,
          }),
          'Adisyon'
        );
      }
      closeTable();
    } else {
      setTableStatus(selectedTable!.id, 'odeme_bekliyor');
      setShowPayment(false);
      setPaymentMode('normal');
      setSelectedPayItems(new Set());
    }
  };

  const handlePrepayment = () => {
    const amount = Number(prepaymentAmount);
    if (!amount || amount <= 0 || !selectedTable) return;
    if (tableOrders.length > 0) {
      const order = tableOrders[0];
      const newPrepayment = (order.prepayment || 0) + amount;
      updateOrder(order.id, { prepayment: newPrepayment });
    }
    setPrepaymentAmount('');
    setShowPrepayment(false);
    toast.success(`${amount} ₺ ön ödeme alındı`);
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
        restaurantName: 'RESTORAN',
        tableName: selectedTable.name,
        staffName: staffName || '',
        date: new Date(),
        items,
        total,
      }),
      'Adisyon'
    );
  };

  const tableStatusColor = (status: string) => {
    switch (status) {
      case 'bos': return 'bg-pos-success';
      case 'dolu': return 'bg-pos-danger';
      case 'odeme_bekliyor': return 'bg-pos-warning';
      default: return 'bg-muted';
    }
  };

  const tableStatusBorder = (status: string) => {
    switch (status) {
      case 'bos': return 'border-pos-success/30';
      case 'dolu': return 'border-pos-danger/30';
      case 'odeme_bekliyor': return 'border-pos-warning/30';
      default: return 'border-border';
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Compact Header */}
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
            <button onClick={printAdisyon} className="p-2 rounded-lg hover:bg-muted pos-btn" title="Adisyon Yazdir">
              <Printer className="w-4 h-4" />
            </button>
          </div>
        )}
        {!selectedTable && (
          <button onClick={() => { logout(); navigate(`/pos/${session?.type === 'staff' ? session.slug : ''}`); }} className="ml-auto p-2 rounded-lg hover:bg-muted pos-btn" title="Cikis">
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {/* LEFT - Order Summary */}
        <div className="w-80 shrink-0 border-r bg-card flex flex-col">
          <div className="p-3 border-b">
            <h2 className="font-bold text-base">
              {selectedTable ? `${selectedTable.name}` : 'Masa Secin'}
            </h2>
            {totalPaid > 0 && (
              <p className="text-xs text-pos-success font-semibold mt-0.5">Ödenen: {totalPaid} ₺</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {orderItems.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center mt-10">
                {selectedTable ? 'Menüden ürün ekleyin' : 'Önce bir masa seçin'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {orderItems.map(item => (
                  <div key={item.id} className={`p-2.5 rounded-xl animate-slide-in ${item.sentToKitchen ? 'bg-pos-info/5 border border-pos-info/20' : 'bg-muted/40'}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate">{item.menuItem.name}</p>
                          {item.sentToKitchen && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-pos-info/10 text-pos-info font-bold shrink-0">GÖNDERİLDİ</span>
                          )}
                        </div>
                        {item.modifiers.length > 0 && (
                          <div className="mt-0.5">
                            {item.modifiers.map((m, i) => (
                              <p key={i} className="text-[11px] text-muted-foreground leading-tight">
                                • {m.optionName} {m.extraPrice > 0 && `+${m.extraPrice}₺`}
                              </p>
                            ))}
                          </div>
                        )}
                        {item.note && (
                          <p className="text-[11px] text-pos-warning font-medium mt-0.5 italic">Not: {item.note}</p>
                        )}
                        {editNoteId === item.id ? (
                          <div className="flex gap-1 mt-1">
                            <input
                              autoFocus
                              value={editNoteText}
                              onChange={e => setEditNoteText(e.target.value)}
                              placeholder="Not ekle..."
                              className="flex-1 text-xs px-2 py-1.5 rounded-lg border bg-card"
                              onKeyDown={e => e.key === 'Enter' && saveItemNote(item.id)}
                            />
                            <button onClick={() => saveItemNote(item.id)} className="text-xs px-2 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold pos-btn">✓</button>
                          </div>
                        ) : null}
                        <p className="text-xs text-primary font-bold mt-0.5">
                          {(item.menuItem.price + item.modifiers.reduce((s, m) => s + m.extraPrice, 0)) * item.quantity} ₺
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 rounded-lg bg-card border flex items-center justify-center pos-btn">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 rounded-lg bg-card border flex items-center justify-center pos-btn">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => { setEditNoteId(editNoteId === item.id ? null : item.id); setEditNoteText(item.note || ''); }} className="w-7 h-7 rounded-lg text-muted-foreground hover:bg-muted flex items-center justify-center pos-btn">
                            <MessageSquare className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleEditItem(item.id)} className="w-7 h-7 rounded-lg text-destructive/70 hover:bg-destructive/10 flex items-center justify-center pos-btn">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order Footer */}
          <div className="p-3 border-t space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-muted-foreground text-sm">TOPLAM</span>
              <span className="text-2xl font-black text-primary">{total} ₺</span>
            </div>
            {(totalPaid > 0 || totalPrepayment > 0) && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Kalan</span>
                <span className="font-bold text-foreground">{remainingAmount} ₺</span>
              </div>
            )}
            <button
              onClick={sendToKitchen}
              disabled={!selectedTable || orderItems.length === 0}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2 pos-btn disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              <Send className="w-5 h-5" /> Mutfağa Gönder
            </button>
            <div className="flex gap-2">
              <button
                onClick={clearOrder}
                disabled={orderItems.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-muted text-muted-foreground font-semibold text-sm flex items-center justify-center gap-1.5 pos-btn disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" /> Temizle
              </button>
              <button
                onClick={() => { setShowPayment(true); setPaymentMode('normal'); }}
                disabled={!selectedTable || (orderItems.length === 0 && !selectedTable.currentTotal)}
                className="flex-1 py-2.5 rounded-xl bg-pos-success text-pos-success-foreground font-semibold text-sm flex items-center justify-center gap-1.5 pos-btn disabled:opacity-40"
              >
                <CreditCard className="w-4 h-4" /> Ödeme Al
              </button>
            </div>
          </div>
        </div>

        {/* CENTER - Products */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedTable ? (
            <div className="flex-1 flex flex-col p-4">
              <div className="flex gap-2 mb-4">
                {floors.map(f => (
                  <button
                    key={f}
                    onClick={() => setSelectedFloor(f)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold pos-btn ${
                      selectedFloor === f ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card border hover:bg-muted'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 flex-1 content-start overflow-y-auto">
                {floorTables.map(t => {
                  const tOrders = orders.filter(o => o.tableId === t.id);
                  const tPrepay = tOrders.reduce((sum, o) => sum + (o.prepayment || 0), 0);
                  return (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTable(t)}
                    className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 ${tableStatusBorder(t.status)} bg-card hover:shadow-lg pos-btn transition-shadow`}
                  >
                    <span className={`absolute top-2 right-2 w-3 h-3 rounded-full ${tableStatusColor(t.status)}`} />
                    <span className="text-2xl font-black text-foreground">{t.name.replace('Masa ', '')}</span>
                    <span className="text-xs text-muted-foreground mt-1">{t.name}</span>
                    {t.currentTotal && t.currentTotal > 0 && (
                      <span className="text-xs font-bold text-primary mt-1">{t.currentTotal} TL</span>
                    )}
                    {tPrepay > 0 && (
                      <span className="text-[10px] font-bold text-pos-success mt-0.5">On odeme: {tPrepay} TL</span>
                    )}
                    {t.openedAt && t.status !== 'bos' && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground mt-0.5">
                        <Clock className="w-2.5 h-2.5" /> {formatDuration(t.openedAt)}
                      </span>
                    )}
                  </button>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-3 justify-center text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pos-success" /> Boş</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pos-danger" /> Dolu</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pos-warning" /> Ödeme Bekliyor</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-3">
              <div className="flex gap-2 mb-3 items-center">
                <button
                  onClick={() => setSelectedTable(null)}
                  className="px-3 py-2 rounded-xl bg-muted text-sm font-semibold pos-btn"
                >
                  ← Masalar
                </button>
                <button
                  onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }}
                  className={`p-2.5 rounded-xl border pos-btn ${showSearch ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
                >
                  <Search className="w-4 h-4" />
                </button>
                {showSearch && (
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Ürün ara..."
                    className="flex-1 px-4 py-2.5 rounded-xl border bg-card text-sm"
                  />
                )}
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {filteredItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleItemTap(item)}
                      className="flex flex-col items-start p-4 bg-card rounded-xl border hover:border-primary/40 hover:shadow-md pos-btn"
                    >
                      <span className="font-bold text-sm leading-tight">{item.name}</span>
                      {item.description && (
                        <span className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">{item.description}</span>
                      )}
                      <span className="text-primary font-black text-base mt-auto pt-1">{item.price} ₺</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT - Categories */}
        {selectedTable && (
          <div className="w-36 shrink-0 border-l bg-card p-2 overflow-y-auto scrollbar-thin">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">Kategoriler</h3>
            <div className="space-y-1">
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCategory(c.id); setShowSearch(false); setSearchQuery(''); }}
                  className={`w-full flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold pos-btn ${
                    selectedCategory === c.id && !showSearch
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span className="text-base">{c.icon}</span>
                  <span className="truncate text-xs">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modifier Modal */}
      {showModifierModal && pendingItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowModifierModal(false)}>
          <div className="bg-card rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b bg-primary/5">
              <h3 className="text-lg font-black">{pendingItem.name}</h3>
              <p className="text-primary font-bold">{pendingItem.price} ₺</p>
            </div>
            <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
              {modifierGroups
                .filter(group => {
                  // Show only modifier groups linked to this product, or all if no mapping exists
                  const linkedGroups = productModifierMap.get(pendingItem.id);
                  return !linkedGroups || linkedGroups.length === 0 || linkedGroups.includes(group.id);
                })
                .map(group => (
                <div key={group.id}>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{group.name}</h4>
                  <div className="space-y-1.5">
                    {group.options.map(opt => {
                      const isSelected = (selectedModifiers[group.id] || []).includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleModifier(group.id, opt.id, group.type)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium pos-btn border-2 ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-transparent bg-muted/50 hover:bg-muted'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-${group.type === 'radio' ? 'full' : 'md'} border-2 flex items-center justify-center ${
                              isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                            }`}>
                              {isSelected && <span className="w-2 h-2 rounded-full bg-primary-foreground" />}
                            </span>
                            {opt.name}
                          </span>
                          {opt.extraPrice > 0 && <span className="text-xs font-bold">+{opt.extraPrice} ₺</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* Item note */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Not</h4>
                <input
                  value={itemNote}
                  onChange={e => setItemNote(e.target.value)}
                  placeholder="Örn: Az pişmiş, extra sos..."
                  className="w-full px-4 py-3 rounded-xl border bg-muted/30 text-sm"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2">
              <button onClick={() => setShowModifierModal(false)} className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm pos-btn">
                İptal
              </button>
              <button onClick={confirmModifiers} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm pos-btn shadow-lg shadow-primary/20">
                Siparişe Ekle
              </button>
            </div>
          </div>
        </div>
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
              <button onClick={() => setShowSentWarning(null)} className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm pos-btn">
                İptal
              </button>
              <button onClick={confirmSentEdit} className="flex-1 py-3 rounded-xl bg-pos-danger text-pos-danger-foreground font-bold text-sm pos-btn">
                Evet, Değiştir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {paymentConfirm && selectedTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] animate-fade-in" onClick={() => setPaymentConfirm(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm mx-4 shadow-2xl animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 text-center">
              <Receipt className="w-12 h-12 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-black mb-2">Ödeme Onayı</h3>
              <p className="text-sm text-muted-foreground mb-3">{selectedTable.name} için ödeme alınacak</p>
              <p className="text-3xl font-black text-primary">{paymentConfirm.amount} ₺</p>
              <p className="text-sm text-muted-foreground mt-1">{paymentConfirm.method}</p>
            </div>
            <div className="p-4 border-t flex gap-2">
              <button onClick={() => setPaymentConfirm(null)} className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm pos-btn">
                İptal
              </button>
              <button onClick={confirmPayment} className="flex-1 py-3 rounded-xl bg-pos-success text-pos-success-foreground font-bold text-sm pos-btn">
                Ödeme Alındı
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && selectedTable && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowPayment(false)}>
          <div className="bg-card rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b text-center shrink-0">
              <h3 className="text-lg font-black">{selectedTable.name} - Ödeme</h3>
              <p className="text-3xl font-black text-primary mt-2">
                {paymentMode === 'split_person' 
                  ? `${Math.ceil(total / splitPersonCount)} ₺`
                  : paymentMode === 'split_item'
                  ? `${orderItems.filter(i => selectedPayItems.has(i.id)).reduce((sum, i) => sum + (i.menuItem.price + i.modifiers.reduce((s, m) => s + m.extraPrice, 0)) * i.quantity, 0)} ₺`
                  : `${remainingAmount} ₺`
                }
              </p>
              {totalPaid > 0 && <p className="text-xs text-pos-success mt-1 font-semibold">Ödenen: {totalPaid} ₺</p>}
            </div>

            <div className="overflow-y-auto flex-1 scrollbar-thin">
              {/* Payment mode tabs */}
              <div className="flex gap-1 p-3 border-b">
                <button onClick={() => setPaymentMode('normal')} className={`flex-1 py-2 rounded-lg text-xs font-bold pos-btn ${paymentMode === 'normal' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <Receipt className="w-3.5 h-3.5 mx-auto mb-0.5" /> Tam Ödeme
                </button>
                <button onClick={() => setPaymentMode('split_item')} className={`flex-1 py-2 rounded-lg text-xs font-bold pos-btn ${paymentMode === 'split_item' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <SplitSquareHorizontal className="w-3.5 h-3.5 mx-auto mb-0.5" /> Ürüne Göre
                </button>
                <button onClick={() => setPaymentMode('split_person')} className={`flex-1 py-2 rounded-lg text-xs font-bold pos-btn ${paymentMode === 'split_person' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <Users className="w-3.5 h-3.5 mx-auto mb-0.5" /> Kişiye Göre
                </button>
              </div>

              {/* Split by item selection */}
              {paymentMode === 'split_item' && (
                <div className="p-3 border-b space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Ödenecek ürünleri seçin</p>
                  {orderItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedPayItems(prev => {
                        const next = new Set(prev);
                        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                        return next;
                      })}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm pos-btn border-2 ${
                        selectedPayItems.has(item.id) ? 'border-primary bg-primary/10' : 'border-transparent bg-muted/50'
                      }`}
                    >
                      <span>{item.quantity}x {item.menuItem.name}</span>
                      <span className="font-bold">{(item.menuItem.price + item.modifiers.reduce((s, m) => s + m.extraPrice, 0)) * item.quantity} ₺</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Split by person */}
              {paymentMode === 'split_person' && (
                <div className="p-3 border-b">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Kişi Sayısı</p>
                  <div className="flex items-center gap-3 justify-center">
                    <button onClick={() => setSplitPersonCount(Math.max(2, splitPersonCount - 1))} className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center pos-btn font-bold text-lg">-</button>
                    <span className="text-3xl font-black w-12 text-center">{splitPersonCount}</span>
                    <button onClick={() => setSplitPersonCount(splitPersonCount + 1)} className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center pos-btn font-bold text-lg">+</button>
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-2">Kişi başı: <span className="font-bold text-foreground">{Math.ceil(total / splitPersonCount)} ₺</span></p>
                </div>
              )}

              <div className="p-4 space-y-2">
                <button onClick={() => handlePayment('Nakit')} className="w-full py-4 rounded-xl bg-pos-success text-pos-success-foreground font-bold text-base flex items-center justify-center gap-3 pos-btn">
                  <Banknote className="w-6 h-6" /> Nakit
                </button>
                <button onClick={() => handlePayment('Kredi Kartı')} className="w-full py-4 rounded-xl bg-pos-info text-pos-info-foreground font-bold text-base flex items-center justify-center gap-3 pos-btn">
                  <CreditCard className="w-6 h-6" /> Kredi Kartı
                </button>

                {/* Prepayment */}
                {!showPrepayment ? (
                  <button onClick={() => setShowPrepayment(true)} className="w-full py-3 rounded-xl bg-muted font-semibold text-sm pos-btn">
                    Ön Ödeme Ekle
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={prepaymentAmount}
                      onChange={e => setPrepaymentAmount(e.target.value)}
                      placeholder="Tutar"
                      type="number"
                      className="flex-1 px-4 py-3 rounded-xl border bg-card text-sm"
                    />
                    <button onClick={handlePrepayment} className="px-5 py-3 rounded-xl bg-pos-warning text-pos-warning-foreground font-bold text-sm pos-btn">
                      Ekle
                    </button>
                  </div>
                )}

                {/* Quick cash */}
                <div className="pt-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Hızlı Nakit</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[10, 20, 50, 100, 200].map(amount => (
                      <button key={amount} onClick={() => handleQuickCash(amount)} className="py-3 rounded-xl bg-muted font-bold text-sm pos-btn hover:bg-muted-foreground/10">
                        {amount}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t shrink-0">
              <button onClick={() => { setShowPayment(false); setPaymentMode('normal'); }} className="w-full py-3 rounded-xl bg-muted font-semibold text-sm pos-btn">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
