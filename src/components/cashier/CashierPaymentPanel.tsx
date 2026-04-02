import { useState, useEffect, useMemo } from 'react';
import { Order } from '@/types/pos';
import {
  Banknote, CreditCard, Check, Printer, ChevronDown, ChevronUp,
  SplitSquareHorizontal, Users, Landmark, Percent,
} from 'lucide-react';

// Keep this export so CashierPOS import doesn't break
export interface ActionLogEntry {
  id: string;
  ts: Date;
  message: string;
  type: 'payment' | 'refund' | 'void' | 'return' | 'discount' | 'info';
}

interface CashierPaymentPanelProps {
  tableOrders: Order[];
  tableName: string;
  restaurantName: string;
  staffName: string;
  isSubmitting: boolean;
  onCompletePayment: (amount: number, method: string, discountAmount?: number, discountReason?: string) => void;
  onPrepayment: (amount: number, method: string) => void;
  onPayOrderItems?: (itemIds: string[], amount: number, method: string, discountAmount?: number, discountReason?: string) => void;
  onMarkReady?: () => void;
  onPrintAdisyon: () => void;
}

export default function CashierPaymentPanel({
  tableOrders, tableName, restaurantName, staffName,
  onCompletePayment, onPrepayment, onPayOrderItems, onMarkReady,
  onPrintAdisyon, isSubmitting,
}: CashierPaymentPanelProps) {
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

  // Merge all orders
  const allItems = useMemo(() => tableOrders.flatMap(o => o.items), [tableOrders]);
  const orderTotal = useMemo(() => tableOrders.reduce((s, o) => s + o.total, 0), [tableOrders]);
  const allPayments = useMemo(() => tableOrders.flatMap(o => o.payments || []), [tableOrders]);
  const totalPaid = useMemo(() => allPayments.reduce((s, p) => s + p.amount, 0), [allPayments]);
  const prepaymentTotal = useMemo(() => allPayments.filter(p => p.type === 'prepayment').reduce((s, p) => s + p.amount, 0), [allPayments]);
  const paymentTotal = useMemo(() => allPayments.filter(p => p.type === 'payment').reduce((s, p) => s + p.amount, 0), [allPayments]);
  const hasActiveOrders = tableOrders.some(o => o.status === 'active');

  // Reset state when table changes
  const orderIds = tableOrders.map(o => o.id).join(',');
  useEffect(() => {
    setPaymentMethod('nakit');
    setShowAdvanced(false);
    setAdvancedMode('normal');
    setSelectedPayItems(new Set());
    setSplitPersonCount(2);
    setShowDiscount(false);
    setDiscountValue('');
    setDiscountReason('');
    setPrepaymentInput('');
  }, [orderIds]);

  const discountAmount = discountValue
    ? discountType === 'percentage'
      ? Math.round(orderTotal * Number(discountValue) / 100)
      : Number(discountValue)
    : 0;

  const effectiveTotal = Math.max(0, orderTotal - discountAmount);
  const remainingAmount = Math.max(0, effectiveTotal - totalPaid);

  const getPayAmount = () => {
    if (advancedMode === 'split_item') {
      return allItems
        .filter(i => selectedPayItems.has(i.id))
        .reduce((sum, i) => {
          const modExtra = i.modifiers.reduce((s, m) => s + m.extraPrice, 0);
          return sum + (i.menuItem.price + modExtra) * i.quantity;
        }, 0);
    }
    if (advancedMode === 'split_person') {
      return Math.ceil(effectiveTotal / splitPersonCount);
    }
    return remainingAmount;
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
    onPrintAdisyon();
  };

  if (tableOrders.length === 0) {
    return (
      <div className="flex flex-col h-full bg-card border-l items-center justify-center p-6 text-center">
        <Banknote className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">Masa seçin</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card border-l">
      {/* Table Header */}
      <div className="px-5 py-4 border-b shrink-0 flex items-center justify-between">
        <h2 className="text-lg font-bold">{tableName} — Ödeme</h2>
        {hasActiveOrders && onMarkReady && (
          <button onClick={onMarkReady} className="px-3 py-1.5 rounded-lg bg-pos-warning text-pos-warning-foreground text-xs font-bold pos-btn">
            Hazır İşaretle
          </button>
        )}
      </div>

      {/* Remaining Total */}
      <div className="px-5 py-6 text-center border-b shrink-0">
        <p className="text-4xl font-bold text-primary">{remainingAmount} ₺</p>
        <div className="flex items-center justify-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
          <span>Toplam: {orderTotal} ₺</span>
          {discountAmount > 0 && <span className="text-pos-warning font-semibold">İndirim: -{discountAmount} ₺</span>}
          {prepaymentTotal > 0 && <span className="text-blue-500 font-semibold">Ön ödeme: -{prepaymentTotal} ₺</span>}
          {paymentTotal > 0 && <span className="text-pos-success font-semibold">Ödenen: {paymentTotal} ₺</span>}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Order Items */}
        <div className="p-4 border-b">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Sipariş Detayı</p>
          <div className="space-y-1.5">
            {allItems.map(item => {
              const isPaid = item.paymentStatus === 'paid';
              const itemTotal = (item.menuItem.price + item.modifiers.reduce((s, m) => s + m.extraPrice, 0)) * item.quantity;
              return (
                <div key={item.id} className={`flex items-center justify-between text-sm ${isPaid ? 'opacity-50' : ''}`}>
                  <span className="flex items-center gap-1.5">
                    {isPaid && <Check className="w-3.5 h-3.5 text-pos-success" />}
                    <span className={isPaid ? 'line-through' : ''}>{item.quantity}x {item.menuItem.name}</span>
                  </span>
                  <span className="font-bold">{itemTotal} ₺</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Method Cards */}
        <div className="p-4 border-b">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod('nakit')}
              aria-pressed={paymentMethod === 'nakit'}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 font-bold text-base pos-btn transition-all ${
                paymentMethod === 'nakit'
                  ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                  : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <Banknote className="w-5 h-5" /> Nakit
            </button>
            <button
              onClick={() => setPaymentMethod('kredi_karti')}
              aria-pressed={paymentMethod === 'kredi_karti'}
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 font-bold text-base pos-btn transition-all ${
                paymentMethod === 'kredi_karti'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                  : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <CreditCard className="w-5 h-5" /> Kredi Kartı
            </button>
          </div>
        </div>

        {/* Pay Button */}
        {advancedMode !== 'prepayment' && (
          <div className="p-4 border-b">
            <button
              onClick={handlePay}
              disabled={isSubmitting || payAmount <= 0}
              className={`w-full h-14 rounded-xl font-bold text-lg pos-btn transition-all disabled:opacity-40 ${
                paymentMethod === 'nakit'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isSubmitting ? 'İşleniyor...' : `${payAmount} ₺ Ödeme Al`}
            </button>
          </div>
        )}

        {/* Quick Cash (nakit only, normal mode only) */}
        {paymentMethod === 'nakit' && advancedMode === 'normal' && (
          <div className="px-4 pb-4 pt-0 border-b">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Hızlı Nakit</p>
            <div className="grid grid-cols-5 gap-2">
              {[10, 20, 50, 100, 200].map(amount => (
                <button
                  key={amount}
                  onClick={() => handleQuickCash(amount)}
                  disabled={isSubmitting}
                  className="py-3 rounded-lg bg-muted font-bold text-sm pos-btn hover:bg-muted-foreground/10 disabled:opacity-40"
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
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted/50 pos-btn"
          >
            <span>Gelişmiş İşlemler</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvanced && (
            <div className="px-4 pb-4 space-y-3">
              {/* Mode tabs */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setAdvancedMode(advancedMode === 'split_item' ? 'normal' : 'split_item')}
                  className={`py-2.5 rounded-lg text-xs font-bold pos-btn flex flex-col items-center gap-0.5 ${advancedMode === 'split_item' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                  <SplitSquareHorizontal className="w-4 h-4" /> Ürüne Göre
                </button>
                <button
                  onClick={() => setAdvancedMode(advancedMode === 'split_person' ? 'normal' : 'split_person')}
                  className={`py-2.5 rounded-lg text-xs font-bold pos-btn flex flex-col items-center gap-0.5 ${advancedMode === 'split_person' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                  <Users className="w-4 h-4" /> Kişiye Göre
                </button>
                <button
                  onClick={() => setAdvancedMode(advancedMode === 'prepayment' ? 'normal' : 'prepayment')}
                  className={`py-2.5 rounded-lg text-xs font-bold pos-btn flex flex-col items-center gap-0.5 ${advancedMode === 'prepayment' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                >
                  <Landmark className="w-4 h-4" /> Ön Ödeme
                </button>
              </div>

              {/* Split by item */}
              {advancedMode === 'split_item' && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Ödenecek ürünleri seçin</p>
                  {allItems.map(item => {
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
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm pos-btn border ${
                          isPaid
                            ? 'border-pos-success/30 bg-pos-success/5 opacity-60'
                            : selectedPayItems.has(item.id)
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-muted/30'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {isPaid && <Check className="w-3.5 h-3.5 text-pos-success" />}
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
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Kişi Sayısı</p>
                  <div className="flex items-center gap-3 justify-center">
                    <button onClick={() => setSplitPersonCount(Math.max(2, splitPersonCount - 1))} className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center pos-btn font-bold text-lg">-</button>
                    <span className="text-3xl font-bold w-12 text-center">{splitPersonCount}</span>
                    <button onClick={() => setSplitPersonCount(splitPersonCount + 1)} className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center pos-btn font-bold text-lg">+</button>
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-2">Kişi başı: <span className="font-bold text-foreground">{Math.ceil(effectiveTotal / splitPersonCount)} ₺</span></p>
                </div>
              )}

              {/* Prepayment */}
              {advancedMode === 'prepayment' && (
                <div className="space-y-3">
                  {prepaymentTotal > 0 && (
                    <div className="px-3 py-2 rounded-lg bg-pos-success/10 border border-pos-success/20 text-sm text-pos-success font-semibold">
                      Mevcut ön ödeme: {prepaymentTotal} ₺
                    </div>
                  )}
                  <input
                    value={prepaymentInput}
                    onChange={e => setPrepaymentInput(e.target.value)}
                    placeholder="Tutar girin (örn: 100)"
                    type="number"
                    className="w-full px-4 py-2.5 rounded-lg border bg-card text-sm"
                  />
                  <button
                    onClick={handlePrepaymentSubmit}
                    disabled={!prepaymentInput || Number(prepaymentInput) <= 0 || isSubmitting}
                    className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm pos-btn disabled:opacity-40"
                  >
                    Ön Ödeme Al {prepaymentInput ? `— ${prepaymentInput} ₺` : ''}
                  </button>
                </div>
              )}

              {/* Discount */}
              <div>
                {!showDiscount ? (
                  <button onClick={() => setShowDiscount(true)} className="w-full py-2.5 rounded-lg bg-muted/60 font-semibold text-sm pos-btn flex items-center justify-center gap-2">
                    <Percent className="w-4 h-4" /> İndirim Uygula
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button onClick={() => setDiscountType('percentage')} className={`flex-1 py-2 rounded-lg text-xs font-bold pos-btn ${discountType === 'percentage' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>% Yüzde</button>
                      <button onClick={() => setDiscountType('fixed')} className={`flex-1 py-2 rounded-lg text-xs font-bold pos-btn ${discountType === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>₺ Tutar</button>
                    </div>
                    <input value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === 'percentage' ? 'Yüzde (örn: 10)' : 'Tutar (örn: 50)'} type="number" className="w-full px-4 py-2.5 rounded-lg border bg-card text-sm" />
                    <input value={discountReason} onChange={e => setDiscountReason(e.target.value)} placeholder="İndirim sebebi (opsiyonel)" className="w-full px-4 py-2.5 rounded-lg border bg-card text-sm" />
                    {discountAmount > 0 && <p className="text-center text-sm font-bold text-pos-warning">İndirim: -{discountAmount} ₺</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Receipt */}
        <div className="p-4">
          <button onClick={handlePrintReceipt} className="w-full py-3 rounded-lg border bg-card font-semibold text-sm pos-btn flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" /> Adisyon Yazdır
          </button>
        </div>
      </div>
    </div>
  );
}
