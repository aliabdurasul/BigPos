import { useState, useEffect, useMemo } from 'react';
import { OrderItem, Table, Order } from '@/types/pos';
import {
  Minus, Plus, X, Send, Trash2, MessageSquare, Printer, CheckCircle,
  Banknote, CreditCard, Check, ChevronDown, ChevronUp,
  SplitSquareHorizontal, Users, Landmark, Percent, DollarSign,
} from 'lucide-react';
import { formatAdisyon, printReceipt } from '@/lib/receipt';

interface CashierOrderPanelProps {
  selectedTable: Table | null;
  orderItems: OrderItem[];
  total: number;
  totalPaid: number;
  totalPrepayment: number;
  remainingAmount: number;
  editNoteId: string | null;
  editNoteText: string;
  onUpdateQty: (itemId: string, delta: number) => void;
  onRemoveItem: (itemId: string) => void;
  onEditNote: (itemId: string) => void;
  onSaveNote: (itemId: string) => void;
  onEditNoteTextChange: (text: string) => void;
  onSendToKitchen: () => void;
  onClearOrder: () => void;
  onPrintAdisyon: () => void;
  onMarkReady?: () => void;
  hasActiveOrders?: boolean;
  fullWidth?: boolean;
  // Payment props — table-level
  tableOrders: Order[];
  restaurantName: string;
  staffName: string;
  onCompletePayment: (amount: number, method: string, discountAmount?: number, discountReason?: string) => void;
  onPrepayment: (amount: number, method: string) => void;
  onPayOrderItems?: (itemIds: string[], amount: number, method: string, discountAmount?: number, discountReason?: string) => void;
  isSubmitting: boolean;
}

export default function CashierOrderPanel({
  selectedTable, orderItems, total, totalPaid, totalPrepayment, remainingAmount,
  editNoteId, editNoteText,
  onUpdateQty, onRemoveItem, onEditNote, onSaveNote, onEditNoteTextChange,
  onSendToKitchen, onClearOrder, onPrintAdisyon, onMarkReady, hasActiveOrders,
  fullWidth,
  tableOrders, restaurantName, staffName,
  onCompletePayment, onPrepayment, onPayOrderItems,
  isSubmitting,
}: CashierOrderPanelProps) {
  // ─── Payment State ──────────────────────────
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'nakit' | 'kredi_karti'>('nakit');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedMode, setAdvancedMode] = useState<'normal' | 'split_item' | 'split_person' | 'prepayment'>('normal');
  const [selectedPayItems, setSelectedPayItems] = useState<Set<string>>(new Set());
  const [splitPersonCount, setSplitPersonCount] = useState(2);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [prepaymentInput, setPrepaymentInput] = useState('');

  // Reset payment state when table changes
  const tableOrderIds = tableOrders.map(o => o.id).sort().join(',');
  useEffect(() => {
    setShowPayment(false);
    setPaymentMethod('nakit');
    setShowAdvanced(false);
    setAdvancedMode('normal');
    setSelectedPayItems(new Set());
    setSplitPersonCount(2);
    setShowDiscount(false);
    setDiscountValue('');
    setDiscountReason('');
    setPrepaymentInput('');
  }, [tableOrderIds]);

  // ─── Payment computed values (aggregated across all table orders) ────────────────
  const orderTotal = useMemo(() => tableOrders.reduce((sum, o) => sum + o.total, 0) || total, [tableOrders, total]);
  const allPayments = useMemo(() => tableOrders.flatMap(o => o.payments || []), [tableOrders]);
  const computedTotalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
  const computedPrepaymentTotal = allPayments.filter(p => p.type === 'prepayment').reduce((sum, p) => sum + p.amount, 0);
  const paymentTotal = allPayments.filter(p => p.type === 'payment').reduce((sum, p) => sum + p.amount, 0);
  const allOrderItems = useMemo(() => tableOrders.flatMap(o => o.items), [tableOrders]);
  const hasOrders = tableOrders.length > 0;

  const discountAmount = discountValue
    ? discountType === 'percentage'
      ? Math.round(orderTotal * Number(discountValue) / 100)
      : Number(discountValue)
    : 0;

  const effectiveTotal = Math.max(0, orderTotal - discountAmount);
  const payRemainingAmount = Math.max(0, effectiveTotal - computedTotalPaid);

  const getPayAmount = () => {
    if (advancedMode === 'split_item' && hasOrders) {
      return allOrderItems
        .filter(i => selectedPayItems.has(i.id))
        .reduce((sum, i) => {
          const modExtra = i.modifiers.reduce((s, m) => s + m.extraPrice, 0);
          return sum + (i.menuItem.price + modExtra) * i.quantity;
        }, 0);
    }
    if (advancedMode === 'split_person') {
      return Math.ceil(effectiveTotal / splitPersonCount);
    }
    return payRemainingAmount;
  };

  const payAmount = getPayAmount();

  const getDiscountParams = () => {
    const disc = discountAmount > 0 ? discountAmount : undefined;
    const discReason = discountAmount > 0
      ? (discountReason || `${discountType === 'percentage' ? `%${discountValue}` : `${discountValue} TL`} indirim`)
      : undefined;
    return { disc, discReason };
  };

  const handlePay = () => {
    if (isSubmitting || payAmount <= 0) return;
    const { disc, discReason } = getDiscountParams();
    if (advancedMode === 'split_item' && onPayOrderItems && selectedPayItems.size > 0) {
      onPayOrderItems(Array.from(selectedPayItems), payAmount, paymentMethod, disc, discReason);
    } else {
      onCompletePayment(payAmount, paymentMethod, disc, discReason);
    }
  };

  const handleQuickCash = (amount: number) => {
    if (isSubmitting) return;
    const { disc, discReason } = getDiscountParams();
    onCompletePayment(amount, 'nakit', disc, discReason);
  };

  const handlePrepaymentSubmit = () => {
    const amt = Number(prepaymentInput);
    if (amt > 0 && !isSubmitting) {
      onPrepayment(amt, paymentMethod);
      setPrepaymentInput('');
    }
  };

  const handlePrintReceipt = () => {
    if (!hasOrders) return;
    printReceipt(
      formatAdisyon({
        restaurantName: restaurantName || 'RESTORAN',
        tableName: selectedTable?.name || '',
        staffName: staffName || '',
        date: new Date(),
        items: allOrderItems.map(i => ({
          name: i.menuItem.name,
          qty: i.quantity,
          unitPrice: i.menuItem.price + i.modifiers.reduce((s, m) => s + m.extraPrice, 0),
        })),
        total: effectiveTotal,
      }),
      'Adisyon'
    );
  };

  const newItemCount = orderItems.filter(i => !(i as any)._fromDB).length;

  const renderItem = (item: OrderItem) => (
    <div key={item.id} className={`p-2.5 rounded-lg animate-slide-in ${(item as any)._fromDB ? 'bg-muted/30 border border-border' : 'bg-muted/40'}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate">{item.menuItem.name}</p>
            {(item as any)._fromDB && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold shrink-0">GÖNDERİLDİ</span>
            )}
            {item.paymentStatus === 'paid' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-pos-success/20 text-pos-success font-bold shrink-0">ÖDENDİ</span>
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
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5 italic">Not: {item.note}</p>
          )}
          {editNoteId === item.id && (
            <div className="flex gap-1 mt-1">
              <input
                autoFocus
                value={editNoteText}
                onChange={e => onEditNoteTextChange(e.target.value)}
                placeholder="Not ekle..."
                className="flex-1 text-xs px-2 py-1.5 rounded-lg border bg-card"
                onKeyDown={e => e.key === 'Enter' && onSaveNote(item.id)}
              />
              <button onClick={() => onSaveNote(item.id)} className="text-xs px-2 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold pos-btn">✓</button>
            </div>
          )}
          <p className="text-xs text-primary font-bold mt-0.5">
            {(item.menuItem.price + item.modifiers.reduce((s, m) => s + m.extraPrice, 0)) * item.quantity} ₺
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="flex items-center gap-1">
            <button onClick={() => onUpdateQty(item.id, -1)} className="w-11 h-11 rounded-md bg-card border flex items-center justify-center pos-btn">
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
            <button onClick={() => onUpdateQty(item.id, 1)} className="w-11 h-11 rounded-md bg-card border flex items-center justify-center pos-btn">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onEditNote(item.id)} className="w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted flex items-center justify-center pos-btn">
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onRemoveItem(item.id)} className="w-9 h-9 rounded-lg text-destructive/70 hover:bg-destructive/10 flex items-center justify-center pos-btn">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${fullWidth ? 'w-full' : 'w-full'} bg-card flex flex-col h-full`}>
      {/* ─── Header ──────────────────────── */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">
              {selectedTable ? selectedTable.name : 'Masa Seçin'}
            </h2>
            {hasOrders && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {tableOrders.length} sipariş
                {computedTotalPaid > 0 && <span className="text-pos-success font-semibold ml-2">Ödenen: {computedTotalPaid} ₺</span>}
              </p>
            )}
          </div>
          {selectedTable && orderItems.length > 0 && (
            <button onClick={onPrintAdisyon} className="p-2 rounded-lg hover:bg-muted pos-btn" title="Adisyon Yazdır">
              <Printer className="w-4 h-4" />
            </button>
          )}
        </div>
        {/* Order status badges */}
        {tableOrders.length > 1 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {tableOrders.map((o, idx) => (
              <span key={o.id} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                o.status === 'ready' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}>
                #{idx + 1} {o.status === 'ready' ? 'Hazır' : 'Aktif'} · {o.total} ₺
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─── Scrollable Items ────────────── */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {orderItems.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center mt-10">
            {selectedTable ? 'Menüden ürün ekleyin' : 'Önce bir masa seçin'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {/* Sent items section */}
            {orderItems.some(i => (i as any)._fromDB) && (
              <div className="flex items-center gap-2 px-1 pt-1 pb-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Gönderilmiş Siparişler</span>
                <div className="flex-1 border-t border-border" />
              </div>
            )}
            {orderItems.filter(i => (i as any)._fromDB).map(item => renderItem(item))}
            {/* Draft items section */}
            {orderItems.some(i => !(i as any)._fromDB) && (
              <div className="flex items-center gap-2 px-1 pt-2 pb-0.5">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Yeni Eklenenler</span>
                <div className="flex-1 border-t border-primary/30" />
              </div>
            )}
            {orderItems.filter(i => !(i as any)._fromDB).map(item => renderItem(item))}
          </div>
        )}
      </div>
      {/* ─── Footer ──────────────────────── */}
      <div className="p-3 border-t space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-muted-foreground text-sm">TOPLAM</span>
          <span className="text-xl font-bold text-primary">{total} ₺</span>
        </div>
        {(totalPaid > 0 || totalPrepayment > 0) && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Kalan</span>
            <span className="font-bold text-foreground">{remainingAmount} ₺</span>
          </div>
        )}

        {/* Send to Kitchen */}
        {newItemCount > 0 && (
          <button
            onClick={onSendToKitchen}
            disabled={!selectedTable || orderItems.length === 0}
            className="w-full py-3 rounded-md bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 pos-btn disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" /> Mutfağa Gönder ({newItemCount})
          </button>
        )}

        {/* Mark Ready */}
        {hasActiveOrders && onMarkReady && (
          <button
            onClick={onMarkReady}
            className="w-full py-2.5 rounded-md bg-pos-warning text-pos-warning-foreground font-bold text-sm flex items-center justify-center gap-2 pos-btn"
          >
            <CheckCircle className="w-4 h-4" /> Sipariş Hazır
          </button>
        )}

        {/* Payment Toggle */}
        {hasOrders && (
          <button
            onClick={() => setShowPayment(!showPayment)}
            className={`w-full py-3 rounded-md font-bold text-sm flex items-center justify-center gap-2 pos-btn transition-all ${
              showPayment
                ? 'bg-muted text-muted-foreground'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            {showPayment ? 'Ödemeyi Gizle' : `Ödeme Al (${payRemainingAmount} ₺)`}
          </button>
        )}

        {/* Clear */}
        <button
          onClick={onClearOrder}
          disabled={orderItems.length === 0}
          className="w-full py-2 rounded-md bg-muted text-muted-foreground font-semibold text-xs flex items-center justify-center gap-1.5 pos-btn disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" /> Temizle
        </button>
      </div>

      {/* ─── Collapsible Payment Section ─── */}
      {showPayment && hasOrders && (
        <div className="border-t overflow-y-auto max-h-[50vh]">
          {/* Remaining Total */}
          <div className="px-4 py-4 text-center border-b">
            <p className="text-3xl font-bold text-primary">{payRemainingAmount} ₺</p>
            <div className="flex items-center justify-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span>Toplam: {orderTotal} ₺</span>
              {discountAmount > 0 && <span className="text-pos-warning font-semibold">İndirim: -{discountAmount} ₺</span>}
              {computedPrepaymentTotal > 0 && <span className="text-blue-500 font-semibold">Ön ödeme: -{computedPrepaymentTotal} ₺</span>}
              {paymentTotal > 0 && <span className="text-pos-success font-semibold">Ödenen: {paymentTotal} ₺</span>}
            </div>
          </div>

          {/* Payment Method Cards */}
          <div className="p-3 border-b">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod('nakit')}
                aria-pressed={paymentMethod === 'nakit'}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-bold text-sm pos-btn transition-all ${
                  paymentMethod === 'nakit'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-border bg-card hover:bg-muted'
                }`}
              >
                <Banknote className="w-4 h-4" /> Nakit
              </button>
              <button
                onClick={() => setPaymentMethod('kredi_karti')}
                aria-pressed={paymentMethod === 'kredi_karti'}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 font-bold text-sm pos-btn transition-all ${
                  paymentMethod === 'kredi_karti'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-border bg-card hover:bg-muted'
                }`}
              >
                <CreditCard className="w-4 h-4" /> Kredi Kartı
              </button>
            </div>
          </div>

          {/* Pay Button */}
          {advancedMode !== 'prepayment' && (
            <div className="p-3 border-b">
              <button
                onClick={handlePay}
                disabled={isSubmitting || payAmount <= 0}
                className={`w-full h-12 rounded-xl font-bold text-base pos-btn transition-all disabled:opacity-40 ${
                  paymentMethod === 'nakit'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isSubmitting ? 'İşleniyor...' : `${payAmount} ₺ Ödeme Al`}
              </button>
            </div>
          )}

          {/* Quick Cash */}
          {paymentMethod === 'nakit' && advancedMode === 'normal' && (
            <div className="px-3 pb-3 pt-0 border-b">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-1.5">Hızlı Nakit</p>
              <div className="grid grid-cols-5 gap-1.5">
                {[10, 20, 50, 100, 200].map(amount => (
                  <button
                    key={amount}
                    onClick={() => handleQuickCash(amount)}
                    disabled={isSubmitting}
                    className="py-2.5 rounded-lg bg-muted font-bold text-xs pos-btn hover:bg-muted-foreground/10 disabled:opacity-40"
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Section */}
          <div className="border-b">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50 pos-btn"
            >
              <span>Gelişmiş İşlemler</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div className="px-3 pb-3 space-y-2.5">
                {/* Mode tabs */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setAdvancedMode(advancedMode === 'split_item' ? 'normal' : 'split_item')}
                    className={`py-2 rounded-lg text-[10px] font-bold pos-btn flex flex-col items-center gap-0.5 ${advancedMode === 'split_item' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                  >
                    <SplitSquareHorizontal className="w-3.5 h-3.5" /> Ürüne Göre
                  </button>
                  <button
                    onClick={() => setAdvancedMode(advancedMode === 'split_person' ? 'normal' : 'split_person')}
                    className={`py-2 rounded-lg text-[10px] font-bold pos-btn flex flex-col items-center gap-0.5 ${advancedMode === 'split_person' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                  >
                    <Users className="w-3.5 h-3.5" /> Kişiye Göre
                  </button>
                  <button
                    onClick={() => setAdvancedMode(advancedMode === 'prepayment' ? 'normal' : 'prepayment')}
                    className={`py-2 rounded-lg text-[10px] font-bold pos-btn flex flex-col items-center gap-0.5 ${advancedMode === 'prepayment' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                  >
                    <Landmark className="w-3.5 h-3.5" /> Ön Ödeme
                  </button>
                </div>

                {/* Split by item */}
                {advancedMode === 'split_item' && hasOrders && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Ödenecek ürünleri seçin</p>
                    {allOrderItems.map(item => {
                      const isPaid = item.paymentStatus === 'paid';
                      const itemTotal = (item.menuItem.price + item.modifiers.reduce((s, m) => s + m.extraPrice, 0)) * item.quantity;
                      return (
                        <button
                          key={item.id}
                          disabled={isPaid}
                          onClick={() => setSelectedPayItems(prev => {
                            const next = new Set(prev);
                            next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                            return next;
                          })}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs pos-btn border ${
                            isPaid
                              ? 'border-pos-success/30 bg-pos-success/5 opacity-60'
                              : selectedPayItems.has(item.id)
                              ? 'border-primary bg-primary/10'
                              : 'border-border bg-muted/30'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {isPaid && <Check className="w-3 h-3 text-pos-success" />}
                            <span className={isPaid ? 'line-through' : ''}>{item.quantity}x {item.menuItem.name}</span>
                          </span>
                          <span className="font-bold">{itemTotal} ₺</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Split by person */}
                {advancedMode === 'split_person' && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Kişi Sayısı</p>
                    <div className="flex items-center gap-2.5 justify-center">
                      <button onClick={() => setSplitPersonCount(Math.max(2, splitPersonCount - 1))} className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center pos-btn font-bold text-base">-</button>
                      <span className="text-2xl font-bold w-10 text-center">{splitPersonCount}</span>
                      <button onClick={() => setSplitPersonCount(splitPersonCount + 1)} className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center pos-btn font-bold text-base">+</button>
                    </div>
                    <p className="text-center text-xs text-muted-foreground mt-1.5">Kişi başı: <span className="font-bold text-foreground">{Math.ceil(effectiveTotal / splitPersonCount)} ₺</span></p>
                  </div>
                )}

                {/* Prepayment */}
                {advancedMode === 'prepayment' && (
                  <div className="space-y-2">
                    {computedPrepaymentTotal > 0 && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-pos-success/10 border border-pos-success/20 text-xs text-pos-success font-semibold">
                        Mevcut ön ödeme: {computedPrepaymentTotal} ₺
                      </div>
                    )}
                    <input
                      value={prepaymentInput}
                      onChange={e => setPrepaymentInput(e.target.value)}
                      placeholder="Tutar girin (örn: 100)"
                      type="number"
                      className="w-full px-3 py-2 rounded-lg border bg-card text-xs"
                    />
                    <button
                      onClick={handlePrepaymentSubmit}
                      disabled={!prepaymentInput || Number(prepaymentInput) <= 0 || isSubmitting}
                      className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs pos-btn disabled:opacity-40"
                    >
                      Ön Ödeme Al {prepaymentInput ? `— ${prepaymentInput} ₺` : ''}
                    </button>
                  </div>
                )}

                {/* Discount */}
                <div>
                  {!showDiscount ? (
                    <button onClick={() => setShowDiscount(true)} className="w-full py-2 rounded-lg bg-muted/60 font-semibold text-xs pos-btn flex items-center justify-center gap-1.5">
                      <Percent className="w-3.5 h-3.5" /> İndirim Uygula
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex gap-1.5">
                        <button onClick={() => setDiscountType('percentage')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold pos-btn ${discountType === 'percentage' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>% Yüzde</button>
                        <button onClick={() => setDiscountType('fixed')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold pos-btn ${discountType === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>₺ Tutar</button>
                      </div>
                      <input value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === 'percentage' ? 'Yüzde (örn: 10)' : 'Tutar (örn: 50)'} type="number" className="w-full px-3 py-2 rounded-lg border bg-card text-xs" />
                      <input value={discountReason} onChange={e => setDiscountReason(e.target.value)} placeholder="İndirim sebebi (opsiyonel)" className="w-full px-3 py-2 rounded-lg border bg-card text-xs" />
                      {discountAmount > 0 && <p className="text-center text-xs font-bold text-pos-warning">İndirim: -{discountAmount} ₺</p>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Receipt */}
          <div className="p-3">
            <button onClick={handlePrintReceipt} className="w-full py-2.5 rounded-lg border bg-card font-semibold text-xs pos-btn flex items-center justify-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Adisyon Yazdır
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
