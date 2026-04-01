import { useState, useMemo, useEffect } from 'react';
import { Order } from '@/types/pos';
import {
  Banknote, CreditCard, ChevronDown, ChevronUp, Percent, Tag,
  RotateCcw, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react';

// ─── Action Log ────────────────────────────────

export interface ActionLogEntry {
  id: string;
  ts: Date;
  message: string;
  type: 'payment' | 'refund' | 'void' | 'return' | 'discount' | 'info';
}

// ─── Props ─────────────────────────────────────

interface CashierPaymentPanelProps {
  /**  All active (unpaid) orders for the selected table */
  tableOrders: Order[];
  isSubmitting: boolean;
  /** Full payment for the whole table */
  onCompletePayment: (amount: number, method: string, discountAmount?: number, discountReason?: string) => Promise<void>;
  /** Refund a given amount back to customer */
  onRefund: (amount: number, method: string) => Promise<void>;
  /** Order-level discount (updates effective total) */
  onOrderDiscount: (amount: number, reason: string) => void;
  onPrintAdisyon: () => void;
  actionLog: ActionLogEntry[];
}

// ─── Helpers ───────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const QUICK_AMOUNTS = [50, 100, 200, 500];

// ─── Component ─────────────────────────────────

export default function CashierPaymentPanel({
  tableOrders,
  isSubmitting,
  onCompletePayment,
  onRefund,
  onOrderDiscount,
  onPrintAdisyon,
  actionLog,
}: CashierPaymentPanelProps) {
  // ─── Payment method ────────────────────────
  const [method, setMethod] = useState<'nakit' | 'kredi_karti'>('nakit');
  const [amountInput, setAmountInput] = useState('');

  // Cash-received + change calculation (nakit only)
  const [receivedInput, setReceivedInput] = useState('');

  // Discount
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [appliedOrderDiscount, setAppliedOrderDiscount] = useState(0);
  const [appliedOrderDiscountReason, setAppliedOrderDiscountReason] = useState('');

  // Refund
  const [showRefund, setShowRefund] = useState(false);
  const [refundInput, setRefundInput] = useState('');
  const [refundMethod, setRefundMethod] = useState<'nakit' | 'kredi_karti'>('nakit');

  // Log
  const [showLog, setShowLog] = useState(false);

  // ─── Derived values ────────────────────────
  const rawTotal = useMemo(
    () => tableOrders.reduce((s, o) => s + o.total, 0),
    [tableOrders],
  );

  const effectiveTotal = Math.max(0, rawTotal - appliedOrderDiscount);

  const { totalPaid, totalRefunded } = useMemo(() => {
    let paid = 0;
    let refunded = 0;
    for (const o of tableOrders) {
      for (const p of o.payments || []) {
        if (p.type === 'refund') refunded += Math.abs(p.amount);
        else paid += p.amount;
      }
    }
    return { totalPaid: paid, totalRefunded: refunded };
  }, [tableOrders]);

  const balance = effectiveTotal - totalPaid + totalRefunded;  // positive = still owed, negative = overpaid

  const parsedAmount = parseFloat(amountInput) || 0;
  const parsedReceived = parseFloat(receivedInput) || 0;
  const change = method === 'nakit' && parsedReceived > 0 ? Math.max(0, parsedReceived - parsedAmount) : 0;

  // Auto-fill amount with remaining balance when table orders load / balance changes
  useEffect(() => {
    if (balance > 0 && (!amountInput || parseFloat(amountInput) === 0)) {
      setAmountInput(balance > 0 ? fmt(balance).replace(',', '.') : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableOrders.length]);

  // Auto-show refund UI when overpaid
  useEffect(() => {
    if (balance < -0.01) setShowRefund(true);
  }, [balance]);

  // ─── Handlers ─────────────────────────────
  const handleApplyDiscount = () => {
    if (!discountValue) return;
    const v = parseFloat(discountValue);
    if (isNaN(v) || v <= 0) return;
    const amount = discountType === 'percent' ? Math.round((rawTotal * v) / 100 * 100) / 100 : v;
    const reason = discountReason || (discountType === 'percent' ? `${v}% indirim` : 'Manuel indirim');
    setAppliedOrderDiscount(amount);
    setAppliedOrderDiscountReason(reason);
    onOrderDiscount(amount, reason);
    setShowDiscount(false);
    setDiscountValue('');
    setDiscountReason('');
  };

  const handleRemoveDiscount = () => {
    setAppliedOrderDiscount(0);
    setAppliedOrderDiscountReason('');
    onOrderDiscount(0, '');
  };

  const handlePay = async () => {
    const amount = parsedAmount > 0 ? parsedAmount : balance > 0 ? balance : 0;
    if (amount <= 0 || isSubmitting || tableOrders.length === 0) return;
    await onCompletePayment(
      amount,
      method,
      appliedOrderDiscount > 0 ? appliedOrderDiscount : undefined,
      appliedOrderDiscount > 0 ? appliedOrderDiscountReason : undefined,
    );
    setAmountInput('');
    setReceivedInput('');
  };

  const handleRefund = async () => {
    const amount = parseFloat(refundInput) || Math.abs(balance);
    if (amount <= 0 || isSubmitting) return;
    await onRefund(amount, refundMethod);
    setRefundInput('');
    setShowRefund(false);
  };

  const handleQuickAmount = (v: number) => {
    setAmountInput(String(v));
    if (method === 'nakit') setReceivedInput(String(v));
  };

  // ─── Balance status ────────────────────────
  const balanceStatus: 'paid' | 'remaining' | 'overpaid' =
    balance <= 0.01 && balance >= -0.01 ? 'paid'
    : balance > 0 ? 'remaining'
    : 'overpaid';

  if (tableOrders.length === 0) {
    return (
      <div className="flex flex-col h-full bg-card border-l items-center justify-center p-6 text-center">
        <Banknote className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground text-sm">Masa seçin</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card border-l overflow-y-auto scrollbar-thin">

      {/* ── Balance display ─────────────────────── */}
      <div className={`p-4 border-b ${
        balanceStatus === 'paid' ? 'bg-green-50 dark:bg-green-950/30'
        : balanceStatus === 'overpaid' ? 'bg-red-50 dark:bg-red-950/30'
        : 'bg-amber-50 dark:bg-amber-950/30'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          {balanceStatus === 'paid'
            ? <CheckCircle2 className="w-5 h-5 text-green-600" />
            : balanceStatus === 'overpaid'
            ? <AlertCircle className="w-5 h-5 text-red-600" />
            : <Clock className="w-5 h-5 text-amber-600" />
          }
          <span className={`text-sm font-bold ${
            balanceStatus === 'paid' ? 'text-green-700 dark:text-green-400'
            : balanceStatus === 'overpaid' ? 'text-red-700 dark:text-red-400'
            : 'text-amber-700 dark:text-amber-400'
          }`}>
            {balanceStatus === 'paid' ? 'Ödendi ✓'
             : balanceStatus === 'overpaid' ? 'Fazla Ödendi'
             : 'Ödeme Bekleniyor'}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Toplam</span>
            <span className="font-medium text-foreground">{fmt(rawTotal)} ₺</span>
          </div>
          {appliedOrderDiscount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-green-600 flex items-center gap-1">
                <Tag className="w-3 h-3" /> {appliedOrderDiscountReason}
              </span>
              <span className="text-green-600 font-medium">-{fmt(appliedOrderDiscount)} ₺</span>
            </div>
          )}
          {appliedOrderDiscount > 0 && (
            <div className="flex justify-between text-xs font-semibold border-t border-current/20 pt-1">
              <span>Efektif Toplam</span>
              <span>{fmt(effectiveTotal)} ₺</span>
            </div>
          )}
          {totalPaid > 0 && (
            <div className="flex justify-between text-xs text-green-600">
              <span>Ödenen</span>
              <span className="font-medium">-{fmt(totalPaid)} ₺</span>
            </div>
          )}
          {totalRefunded > 0 && (
            <div className="flex justify-between text-xs text-red-500">
              <span>İade</span>
              <span className="font-medium">+{fmt(totalRefunded)} ₺</span>
            </div>
          )}
          <div className={`flex justify-between font-bold text-lg pt-1 border-t ${
            balanceStatus === 'paid' ? 'text-green-700 dark:text-green-400'
            : balanceStatus === 'overpaid' ? 'text-red-600'
            : 'text-amber-700 dark:text-amber-400'
          }`}>
            <span>{balanceStatus === 'overpaid' ? 'Fazla' : 'Kalan'}</span>
            <span>{balanceStatus === 'overpaid' ? `+${fmt(Math.abs(balance))} ₺` : `${fmt(Math.max(0, balance))} ₺`}</span>
          </div>
        </div>
      </div>

      {/* ── Payment method tabs ─────────────────── */}
      <div className="p-3 border-b">
        <div className="flex rounded-lg overflow-hidden border">
          <button
            onClick={() => setMethod('nakit')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-colors ${
              method === 'nakit'
                ? 'bg-green-600 text-white'
                : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            <Banknote className="w-4 h-4" /> Nakit
          </button>
          <button
            onClick={() => setMethod('kredi_karti')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-colors border-l ${
              method === 'kredi_karti'
                ? 'bg-blue-600 text-white'
                : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Kart
          </button>
        </div>
      </div>

      {/* ── Amount input ────────────────────────── */}
      <div className="p-3 border-b space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Tutar (₺)
        </label>
        <input
          type="number"
          value={amountInput}
          onChange={e => setAmountInput(e.target.value)}
          placeholder={balance > 0 ? fmt(balance) : '0,00'}
          className="w-full px-3 py-2.5 rounded-lg border bg-background text-lg font-bold text-right"
          onKeyDown={e => e.key === 'Enter' && handlePay()}
        />

        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-1.5">
          {QUICK_AMOUNTS.map(v => (
            <button
              key={v}
              onClick={() => handleQuickAmount(v)}
              className="py-1.5 rounded-lg border bg-muted hover:bg-muted/70 text-xs font-bold pos-btn"
            >
              {v}
            </button>
          ))}
        </div>
        {balance > 0 && (
          <button
            onClick={() => setAmountInput(fmt(balance).replace(',', '.'))}
            className="w-full text-xs text-primary font-semibold py-1 rounded hover:bg-primary/5 pos-btn"
          >
            Kalan tutarı doldur ({fmt(balance)} ₺)
          </button>
        )}

        {/* Cash mode: received + change */}
        {method === 'nakit' && (
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Alınan Nakit (opsiyonel)
            </label>
            <input
              type="number"
              value={receivedInput}
              onChange={e => setReceivedInput(e.target.value)}
              placeholder="Müşteriden alınan..."
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm text-right"
            />
            {change > 0 && (
              <div className="flex justify-between items-center rounded-lg bg-green-50 dark:bg-green-950/30 px-3 py-2">
                <span className="text-xs font-semibold text-green-700 dark:text-green-400">Para Üstü</span>
                <span className="text-base font-bold text-green-700 dark:text-green-400">{fmt(change)} ₺</span>
              </div>
            )}
          </div>
        )}

        {/* ── Pay button ─────────────────────────── */}
        <button
          onClick={handlePay}
          disabled={isSubmitting || tableOrders.length === 0 || balance <= 0.01}
          className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 pos-btn disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
            method === 'nakit'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {method === 'nakit' ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
          {isSubmitting ? 'İşleniyor...' : `${method === 'nakit' ? 'Nakit' : 'Kart'} ile Öde`}
        </button>
      </div>

      {/* ── Order-level discount ─────────────────── */}
      <div className="border-b">
        <button
          onClick={() => setShowDiscount(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted/50 pos-btn"
        >
          <span className="flex items-center gap-2">
            <Percent className="w-4 h-4" />
            {appliedOrderDiscount > 0
              ? <span className="text-green-600">İndirim uygulandı: -{fmt(appliedOrderDiscount)} ₺</span>
              : 'Sipariş İndirimi'}
          </span>
          {showDiscount ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showDiscount && (
          <div className="px-4 pb-4 space-y-2 bg-muted/20">
            {appliedOrderDiscount > 0 && (
              <button
                onClick={handleRemoveDiscount}
                className="w-full text-xs text-red-500 font-semibold py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 pos-btn"
              >
                İndirimi Kaldır
              </button>
            )}
            <div className="flex rounded-lg overflow-hidden border">
              <button
                onClick={() => setDiscountType('percent')}
                className={`flex-1 py-2 text-xs font-bold ${discountType === 'percent' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              >
                % Yüzde
              </button>
              <button
                onClick={() => setDiscountType('fixed')}
                className={`flex-1 py-2 text-xs font-bold border-l ${discountType === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              >
                ₺ Tutar
              </button>
            </div>
            <input
              type="number"
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percent' ? '% (örn. 10)' : '₺ (örn. 50)'}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            />
            <input
              type="text"
              value={discountReason}
              onChange={e => setDiscountReason(e.target.value)}
              placeholder="Sebep (opsiyonel)"
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            />
            <button
              onClick={handleApplyDiscount}
              disabled={!discountValue}
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold pos-btn disabled:opacity-40"
            >
              Uygula
            </button>
          </div>
        )}
      </div>

      {/* ── Refund section ───────────────────────── */}
      <div className="border-b">
        <button
          onClick={() => setShowRefund(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted/50 pos-btn"
        >
          <span className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            {balanceStatus === 'overpaid'
              ? <span className="text-red-500">Para İadesi Gerekli: {fmt(Math.abs(balance))} ₺</span>
              : 'İade / Geri Ödeme'}
          </span>
          {showRefund ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showRefund && (
          <div className="px-4 pb-4 space-y-2 bg-red-50/50 dark:bg-red-950/20">
            <div className="flex rounded-lg overflow-hidden border">
              <button
                onClick={() => setRefundMethod('nakit')}
                className={`flex-1 py-2 text-xs font-bold ${refundMethod === 'nakit' ? 'bg-green-600 text-white' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              >
                Nakit
              </button>
              <button
                onClick={() => setRefundMethod('kredi_karti')}
                className={`flex-1 py-2 text-xs font-bold border-l ${refundMethod === 'kredi_karti' ? 'bg-blue-600 text-white' : 'bg-card text-muted-foreground hover:bg-muted'}`}
              >
                Kart
              </button>
            </div>
            <input
              type="number"
              value={refundInput}
              onChange={e => setRefundInput(e.target.value)}
              placeholder={balanceStatus === 'overpaid' ? fmt(Math.abs(balance)) : 'İade tutarı...'}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
            />
            <button
              onClick={handleRefund}
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm pos-btn disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4 inline mr-1.5" />
              İade Et
            </button>
          </div>
        )}
      </div>

      {/* ── Action log ───────────────────────────── */}
      <div className="border-b">
        <button
          onClick={() => setShowLog(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-muted/50 pos-btn"
        >
          <span>İşlem Geçmişi ({actionLog.length})</span>
          {showLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showLog && (
          <div className="max-h-48 overflow-y-auto scrollbar-thin px-4 pb-4 space-y-1.5">
            {actionLog.length === 0
              ? <p className="text-xs text-muted-foreground py-2 text-center">Henüz işlem yok</p>
              : [...actionLog].reverse().map(entry => (
                <div key={entry.id} className={`flex gap-2 items-start text-xs rounded-lg px-2.5 py-1.5 ${
                  entry.type === 'payment' ? 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                  : entry.type === 'refund' ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                  : entry.type === 'void' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  : entry.type === 'return' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                  : entry.type === 'discount' ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300'
                  : 'bg-muted text-muted-foreground'
                }`}>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {entry.ts.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="leading-tight">{entry.message}</span>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* ── Print adisyon ────────────────────────── */}
      <div className="p-3 mt-auto shrink-0">
        <button
          onClick={onPrintAdisyon}
          className="w-full py-2 rounded-lg border text-sm font-semibold text-muted-foreground hover:bg-muted pos-btn"
        >
          Adisyon Yazdır
        </button>
      </div>
    </div>
  );
}
