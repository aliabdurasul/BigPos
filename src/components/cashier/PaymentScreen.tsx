import { useState } from 'react';
import { Order } from '@/types/pos';
import { Banknote, CreditCard, SplitSquareHorizontal, Users, Receipt, Printer, Percent, X, Landmark, Check } from 'lucide-react';
import { formatAdisyon, printReceipt } from '@/lib/receipt';

interface PaymentScreenProps {
  order: Order;
  tableName: string;
  restaurantName: string;
  staffName: string;
  onCompletePayment: (amount: number, method: string, discountAmount?: number, discountReason?: string) => void;
  onPrepayment: (amount: number) => void;
  onPayOrderItems?: (itemIds: string[], amount: number, method: string, discountAmount?: number, discountReason?: string) => void;
  onClose: () => void;
}

export default function PaymentScreen({
  order, tableName, restaurantName, staffName,
  onCompletePayment, onPrepayment, onPayOrderItems, onClose,
}: PaymentScreenProps) {
  const [paymentMode, setPaymentMode] = useState<'normal' | 'split_item' | 'split_person' | 'prepayment'>('normal');
  const [selectedPayItems, setSelectedPayItems] = useState<Set<string>>(new Set());
  const [splitPersonCount, setSplitPersonCount] = useState(2);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [confirmPayment, setConfirmPayment] = useState<{ method: string; amount: number; discount: number } | null>(null);
  const [prepaymentInput, setPrepaymentInput] = useState('');

  const allPayments = order.payments || [];
  const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
  const prepaymentTotal = allPayments.filter(p => p.type === 'prepayment').reduce((sum, p) => sum + p.amount, 0);
  const paymentTotal = allPayments.filter(p => p.type === 'payment').reduce((sum, p) => sum + p.amount, 0);

  const discountAmount = discountValue
    ? discountType === 'percentage'
      ? Math.round(order.total * Number(discountValue) / 100)
      : Number(discountValue)
    : 0;

  const effectiveTotal = Math.max(0, order.total - discountAmount);
  const remainingAmount = Math.max(0, effectiveTotal - totalPaid);

  const getPayAmount = () => {
    if (paymentMode === 'split_item') {
      return order.items
        .filter(i => selectedPayItems.has(i.id))
        .reduce((sum, i) => {
          const modExtra = i.modifiers.reduce((s, m) => s + m.extraPrice, 0);
          return sum + (i.menuItem.price + modExtra) * i.quantity;
        }, 0);
    }
    if (paymentMode === 'split_person') {
      return Math.ceil(effectiveTotal / splitPersonCount);
    }
    return remainingAmount;
  };

  const handlePayment = (method: string) => {
    const payAmount = getPayAmount();
    setConfirmPayment({ method, amount: payAmount, discount: discountAmount });
  };

  const handleQuickCash = (amount: number) => {
    setConfirmPayment({ method: 'Nakit', amount, discount: discountAmount });
  };

  const doConfirm = () => {
    if (!confirmPayment) return;
    const methodMap: Record<string, string> = {
      'Nakit': 'nakit',
      'Kredi Karti': 'kredi_karti',
      'Bolunmus': 'bolunmus',
    };
    const dbMethod = methodMap[confirmPayment.method] || 'nakit';
    const disc = confirmPayment.discount > 0 ? confirmPayment.discount : undefined;
    const discReason = confirmPayment.discount > 0
      ? (discountReason || `${discountType === 'percentage' ? `%${discountValue}` : `${discountValue} TL`} indirim`)
      : undefined;

    if (paymentMode === 'split_item' && onPayOrderItems && selectedPayItems.size > 0) {
      onPayOrderItems(Array.from(selectedPayItems), confirmPayment.amount, dbMethod, disc, discReason);
    } else {
      onCompletePayment(confirmPayment.amount, dbMethod, disc, discReason);
    }
  };

  const handlePrintReceipt = () => {
    printReceipt(
      formatAdisyon({
        restaurantName: restaurantName || 'RESTORAN',
        tableName,
        staffName: staffName || '',
        date: new Date(),
        items: order.items.map(i => ({
          name: i.menuItem.name,
          qty: i.quantity,
          unitPrice: i.menuItem.price + i.modifiers.reduce((s, m) => s + m.extraPrice, 0),
        })),
        total: effectiveTotal,
      }),
      'Adisyon'
    );
  };

  // ─── Payment Confirmation Modal ────────────────

  if (confirmPayment) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] animate-fade-in" onClick={() => setConfirmPayment(null)}>
        <div className="bg-card rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b flex items-center justify-between shrink-0">
            <h3 className="text-lg font-black">Ödeme Onayı</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              confirmPayment.method === 'Nakit' ? 'bg-pos-success/10 text-pos-success' : 'bg-pos-info/10 text-pos-info'
            }`}>
              {confirmPayment.method === 'Nakit' ? '💵' : '💳'} {confirmPayment.method}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <pre style={{ fontFamily: "'Courier New', monospace", fontSize: 11, lineHeight: 1.5, color: '#000', whiteSpace: 'pre-wrap', background: '#fafaf8', padding: 12, borderRadius: 12, border: '1px solid #e5e2dc' }}>{formatAdisyon({
              restaurantName: restaurantName || 'RESTORAN',
              tableName,
              staffName: staffName || '',
              date: new Date(),
              items: order.items.map(i => ({
                name: i.menuItem.name,
                qty: i.quantity,
                unitPrice: i.menuItem.price + i.modifiers.reduce((s, m) => s + m.extraPrice, 0),
              })),
              total: effectiveTotal,
            })}</pre>

            {confirmPayment.discount > 0 && (
              <div className="mt-3 p-2 rounded-xl bg-pos-warning/10 border border-pos-warning/20 text-center">
                <p className="text-xs text-muted-foreground">İndirim</p>
                <p className="text-lg font-black text-pos-warning">-{confirmPayment.discount} ₺</p>
              </div>
            )}

            <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/10 text-center">
              <p className="text-sm text-muted-foreground">Ödenecek Tutar</p>
              <p className="text-3xl font-black text-primary">{confirmPayment.amount} ₺</p>
            </div>
          </div>

          <div className="p-4 border-t flex gap-2 shrink-0">
            <button onClick={() => setConfirmPayment(null)} className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm pos-btn">
              İptal
            </button>
            <button onClick={handlePrintReceipt} className="py-3 px-4 rounded-xl border bg-card font-bold text-sm pos-btn flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> Fiş
            </button>
            <button onClick={doConfirm} className="flex-1 py-3 rounded-xl bg-pos-success text-pos-success-foreground font-bold text-sm pos-btn shadow-lg">
              Ödeme Tamamla
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Payment Screen ───────────────────────

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-card rounded-2xl w-full max-w-lg mx-4 shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b text-center shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-black">{tableName} - Ödeme</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-3xl font-black text-primary">
            {paymentMode === 'split_person'
              ? `${Math.ceil(effectiveTotal / splitPersonCount)} ₺`
              : paymentMode === 'split_item'
              ? `${getPayAmount()} ₺`
              : `${remainingAmount} ₺`
            }
          </p>
          {discountAmount > 0 && <p className="text-xs text-pos-warning font-semibold mt-1">Indirim: -{discountAmount} TL</p>}
          {prepaymentTotal > 0 && <p className="text-xs text-blue-500 mt-1 font-semibold">On Odeme: -{prepaymentTotal} TL</p>}
          {paymentTotal > 0 && <p className="text-xs text-pos-success mt-1 font-semibold">Odenen: {paymentTotal} TL</p>}
          {totalPaid > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">Kalan: <span className="font-black text-foreground">{remainingAmount} TL</span></p>
          )}
        </div>

        <div className="overflow-y-auto flex-1 scrollbar-thin">
          {/* Order Items Summary */}
          <div className="p-3 border-b">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Siparis Detayi</p>
            <div className="space-y-1">
              {order.items.map(item => {
                const isPaid = item.paymentStatus === 'paid';
                const itemTotal = (item.menuItem.price + item.modifiers.reduce((s, m) => s + m.extraPrice, 0)) * item.quantity;
                return (
                  <div key={item.id} className={`flex items-center justify-between text-sm ${isPaid ? 'opacity-50' : ''}`}>
                    <span className="flex items-center gap-1.5">
                      {isPaid && <Check className="w-3 h-3 text-pos-success" />}
                      <span className={isPaid ? 'line-through' : ''}>{item.quantity}x {item.menuItem.name}</span>
                    </span>
                    <span className="font-bold">{itemTotal} TL</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment mode tabs */}
          <div className="flex gap-1 p-3 border-b flex-wrap">
            <button onClick={() => setPaymentMode('normal')} className={`flex-1 min-w-[72px] py-2 rounded-lg text-xs font-bold pos-btn ${paymentMode === 'normal' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <Receipt className="w-3.5 h-3.5 mx-auto mb-0.5" /> Tam Ödeme
            </button>
            <button onClick={() => setPaymentMode('split_item')} className={`flex-1 min-w-[72px] py-2 rounded-lg text-xs font-bold pos-btn ${paymentMode === 'split_item' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <SplitSquareHorizontal className="w-3.5 h-3.5 mx-auto mb-0.5" /> Ürüne Göre
            </button>
            <button onClick={() => setPaymentMode('split_person')} className={`flex-1 min-w-[72px] py-2 rounded-lg text-xs font-bold pos-btn ${paymentMode === 'split_person' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <Users className="w-3.5 h-3.5 mx-auto mb-0.5" /> Kişiye Göre
            </button>
            <button onClick={() => setPaymentMode('prepayment')} className={`flex-1 min-w-[72px] py-2 rounded-lg text-xs font-bold pos-btn ${paymentMode === 'prepayment' ? 'bg-pos-warning text-pos-warning-foreground' : 'bg-muted'}`}>
              <Landmark className="w-3.5 h-3.5 mx-auto mb-0.5" /> Ön Ödeme
            </button>
          </div>

          {/* Prepayment section */}
          {paymentMode === 'prepayment' && (
            <div className="p-3 border-b space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase">Ön Ödeme Tutarı</p>
              {prepaymentTotal > 0 && (
                <div className="px-3 py-2 rounded-lg bg-pos-success/10 border border-pos-success/20 text-sm text-pos-success font-semibold">
                  Mevcut on odeme: {prepaymentTotal} TL
                </div>
              )}
              <input
                value={prepaymentInput}
                onChange={e => setPrepaymentInput(e.target.value)}
                placeholder="Tutar girin (örn: 100)"
                type="number"
                className="w-full px-4 py-2.5 rounded-xl border bg-card text-sm"
                autoFocus
              />
              <button
                onClick={() => {
                  const amt = Number(prepaymentInput);
                  if (amt > 0) { onPrepayment(amt); setPrepaymentInput(''); }
                }}
                disabled={!prepaymentInput || Number(prepaymentInput) <= 0}
                className="w-full py-3 rounded-xl bg-pos-warning text-pos-warning-foreground font-bold text-sm pos-btn disabled:opacity-40"
              >
                Ön Ödeme Al — {prepaymentInput ? `${prepaymentInput} ₺` : ''}
              </button>
            </div>
          )}

          {/* Split by item */}
          {paymentMode === 'split_item' && (
            <div className="p-3 border-b space-y-1.5">
              <p className="text-xs font-bold text-muted-foreground uppercase">Odenecek urunleri secin</p>
              {order.items.map(item => {
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
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm pos-btn border-2 ${
                      isPaid
                        ? 'border-pos-success/30 bg-pos-success/5 opacity-60'
                        : selectedPayItems.has(item.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-transparent bg-muted/50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {isPaid && <Check className="w-3.5 h-3.5 text-pos-success" />}
                      <span className={isPaid ? 'line-through' : ''}>{item.quantity}x {item.menuItem.name}</span>
                    </span>
                    <span className="font-bold">{itemTotal} TL</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Split by person */}
          {paymentMode === 'split_person' && (
            <div className="p-3 border-b">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Kişi Sayısı</p>
              <div className="flex items-center gap-3 justify-center">
                <button onClick={() => setSplitPersonCount(Math.max(2, splitPersonCount - 1))} className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center pos-btn font-bold text-lg">-</button>
                <span className="text-3xl font-black w-12 text-center">{splitPersonCount}</span>
                <button onClick={() => setSplitPersonCount(splitPersonCount + 1)} className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center pos-btn font-bold text-lg">+</button>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-2">Kişi başı: <span className="font-bold text-foreground">{Math.ceil(effectiveTotal / splitPersonCount)} ₺</span></p>
            </div>
          )}

          {/* Discount section */}
          <div className="p-3 border-b">
            {!showDiscount ? (
              <button onClick={() => setShowDiscount(true)} className="w-full py-2.5 rounded-xl bg-muted/60 font-semibold text-sm pos-btn flex items-center justify-center gap-2">
                <Percent className="w-4 h-4" /> İndirim Uygula
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiscountType('percentage')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold pos-btn ${discountType === 'percentage' ? 'bg-pos-warning text-pos-warning-foreground' : 'bg-muted'}`}
                  >
                    % Yüzde
                  </button>
                  <button
                    onClick={() => setDiscountType('fixed')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold pos-btn ${discountType === 'fixed' ? 'bg-pos-warning text-pos-warning-foreground' : 'bg-muted'}`}
                  >
                    ₺ Tutar
                  </button>
                </div>
                <input
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'Yüzde (örn: 10)' : 'Tutar (örn: 50)'}
                  type="number"
                  className="w-full px-4 py-2.5 rounded-xl border bg-card text-sm"
                />
                <input
                  value={discountReason}
                  onChange={e => setDiscountReason(e.target.value)}
                  placeholder="İndirim sebebi (opsiyonel)"
                  className="w-full px-4 py-2.5 rounded-xl border bg-card text-sm"
                />
                {discountAmount > 0 && (
                  <p className="text-center text-sm font-bold text-pos-warning">İndirim: -{discountAmount} ₺</p>
                )}
              </div>
            )}
          </div>

          {/* Payment buttons */}
          <div className="p-4 space-y-2">
            <button onClick={() => handlePayment('Nakit')} className="w-full py-4 rounded-xl bg-pos-success text-pos-success-foreground font-bold text-base flex items-center justify-center gap-3 pos-btn">
              <Banknote className="w-6 h-6" /> Nakit
            </button>
            <button onClick={() => handlePayment('Kredi Kartı')} className="w-full py-4 rounded-xl bg-pos-info text-pos-info-foreground font-bold text-base flex items-center justify-center gap-3 pos-btn">
              <CreditCard className="w-6 h-6" /> Kredi Kartı
            </button>

            {/* Quick cash */}
            <div className="pt-2">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Hızlı Nakit</p>
              <div className="grid grid-cols-5 gap-2">
                {[5, 10, 20, 50, 100].map(amount => (
                  <button key={amount} onClick={() => handleQuickCash(amount)} className="py-3 rounded-xl bg-muted font-bold text-sm pos-btn hover:bg-muted-foreground/10">
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handlePrintReceipt} className="w-full py-3 rounded-xl border bg-card font-semibold text-sm pos-btn flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> Adisyon Yazdır
            </button>
          </div>
        </div>

        <div className="p-4 border-t shrink-0">
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-muted font-semibold text-sm pos-btn">
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}
