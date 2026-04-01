import { useMemo } from 'react';
import { OrderItem, Table } from '@/types/pos';
import { Printer, MessageSquare, Gift, Minus, Plus, Ban, RotateCcw, Send, Trash2 } from 'lucide-react';

interface CashierOrderPanelProps {
  selectedTable: Table | null;
  orderItems: OrderItem[];
  total: number;
  totalPaid: number;
  remainingAmount: number;
  /** Draft-only ikram set — local toggle for unsent items */
  ikramItems: Set<string>;
  editNoteId: string | null;
  editNoteText: string;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onEditNote: (id: string) => void;
  onSaveNote: (id: string) => void;
  onEditNoteTextChange: (text: string) => void;
  onPrintAdisyon: () => void;
  /** Qty +/- (pass delta +1 or -1) */
  onUpdateQty: (id: string, delta: number) => void;
  /** Remove item (handles confirmation externally for sent items) */
  onRemoveItem: (id: string) => void;
  /** Toggle ikram for draft item */
  onToggleIkram: (id: string) => void;
  /** Void a sent item (sets itemStatus = cancelled) */
  onVoidItem: (id: string) => void;
  /** Return a sent item (sets itemStatus = returned) */
  onReturnItem: (id: string) => void;
  /** Number of draft (unsent) items */
  newItemCount: number;
  onSendToKitchen: () => void;
  onClearOrder: () => void;
  isSubmitting?: boolean;
  fullWidth?: boolean;
}

export default function CashierOrderPanel({
  selectedTable,
  orderItems,
  total,
  totalPaid,
  remainingAmount,
  ikramItems,
  editNoteId,
  editNoteText,
  selectedItemId,
  onSelectItem,
  onEditNote,
  onSaveNote,
  onEditNoteTextChange,
  onPrintAdisyon,
  onUpdateQty,
  onRemoveItem,
  onToggleIkram,
  onVoidItem,
  onReturnItem,
  newItemCount,
  onSendToKitchen,
  onClearOrder,
  isSubmitting,
  fullWidth,
}: CashierOrderPanelProps) {
  const ikramDeduction = useMemo(
    () =>
      orderItems
        .filter(i => ikramItems.has(i.id))
        .reduce((sum, i) => {
          const ext = i.modifiers.reduce((s, m) => s + m.extraPrice, 0);
          return sum + (i.menuItem.price + ext) * i.quantity;
        }, 0),
    [orderItems, ikramItems]
  );

  const renderItem = (item: OrderItem) => {
    const unitPrice = item.menuItem.price + item.modifiers.reduce((s, m) => s + m.extraPrice, 0);
    const itemPrice = unitPrice * item.quantity;
    const isSent = !!(item as any)._fromDB;
    const isIkram = ikramItems.has(item.id);
    const isSelected = selectedItemId === item.id;
    const isCancelled = item.itemStatus === 'cancelled';
    const isReturned = item.itemStatus === 'returned';
    const hasDiscount = item.discountAmount != null && item.discountAmount > 0;

    return (
      <div
        key={item.id}
        onClick={() => onSelectItem(isSelected ? null : item.id)}
        className={`p-2.5 rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'bg-primary/10 border-2 border-primary'
            : isCancelled
            ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 opacity-60'
            : isReturned
            ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900'
            : isSent
            ? 'bg-muted/30 border border-border'
            : 'bg-muted/40 border border-transparent'
        }`}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className={`text-sm font-semibold truncate ${isCancelled ? 'line-through text-muted-foreground' : ''}`}>
                {item.menuItem.name}
              </p>
              {isSent && !isCancelled && !isReturned && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold shrink-0">
                  GÖNDERİLDİ
                </span>
              )}
              {isCancelled && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-bold shrink-0 flex items-center gap-0.5">
                  <Ban className="w-2.5 h-2.5" /> İPTAL
                </span>
              )}
              {isReturned && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 font-bold shrink-0 flex items-center gap-0.5">
                  <RotateCcw className="w-2.5 h-2.5" /> İADE
                </span>
              )}
              {isIkram && !isCancelled && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold shrink-0 flex items-center gap-0.5">
                  <Gift className="w-2.5 h-2.5" /> İKRAM
                </span>
              )}
            </div>
            {item.modifiers.length > 0 && (
              <div className="mt-0.5">
                {item.modifiers.map((m, idx) => (
                  <p key={idx} className="text-[11px] text-muted-foreground leading-tight">
                    • {m.optionName} {m.extraPrice > 0 && `+${m.extraPrice}₺`}
                  </p>
                ))}
              </div>
            )}
            {item.note && editNoteId !== item.id && (
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5 italic">Not: {item.note}</p>
            )}
            {editNoteId === item.id && (
              <div className="flex gap-1 mt-1" onClick={e => e.stopPropagation()}>
                <input
                  autoFocus
                  value={editNoteText}
                  onChange={e => onEditNoteTextChange(e.target.value)}
                  placeholder="Not ekle..."
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg border bg-card"
                  onKeyDown={e => e.key === 'Enter' && onSaveNote(item.id)}
                />
                <button
                  onClick={() => onSaveNote(item.id)}
                  className="text-xs px-2 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold pos-btn"
                >
                  ✓
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className={`text-xs font-bold ${isCancelled || isIkram ? 'line-through text-muted-foreground' : 'text-primary'}`}>
                {itemPrice} ₺
              </p>
              {hasDiscount && !isCancelled && (
                <p className="text-[10px] text-green-600 font-semibold">
                  −{item.discountAmount} ₺ {item.discountReason ? `(${item.discountReason})` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-center gap-0.5">
            <span className="text-sm font-bold px-2 py-1 rounded bg-muted">×{item.quantity}</span>
            <button
              onClick={e => { e.stopPropagation(); onEditNote(item.id); }}
              className="w-7 h-7 rounded-lg text-muted-foreground hover:bg-muted flex items-center justify-center pos-btn"
            >
              <MessageSquare className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Inline controls bar when selected */}
        {isSelected && (
          <div
            className="mt-2 pt-2 border-t border-primary/20 flex gap-1.5"
            onClick={e => e.stopPropagation()}
          >
            {!isSent ? (
              // Draft item controls
              <>
                <button
                  onClick={() => onUpdateQty(item.id, -1)}
                  className="flex-1 py-1.5 rounded-lg bg-muted flex items-center justify-center pos-btn"
                  title="Azalt"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onUpdateQty(item.id, 1)}
                  className="flex-1 py-1.5 rounded-lg bg-muted flex items-center justify-center pos-btn"
                  title="Artır"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onToggleIkram(item.id)}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center pos-btn text-xs font-bold ${
                    isIkram
                      ? 'bg-amber-100 text-amber-700 border border-amber-300'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  title="İkram"
                >
                  <Gift className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="flex-1 py-1.5 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center pos-btn"
                  title="Kaldır"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              // Sent item controls — void / return
              <>
                {!isCancelled && (
                  <button
                    onClick={() => onVoidItem(item.id)}
                    className="flex-1 py-1.5 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 flex items-center justify-center gap-1 text-xs font-bold pos-btn"
                    title="İptal (Void)"
                  >
                    <Ban className="w-3.5 h-3.5" /> İptal
                  </button>
                )}
                {!isReturned && !isCancelled && (
                  <button
                    onClick={() => onReturnItem(item.id)}
                    className="flex-1 py-1.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex items-center justify-center gap-1 text-xs font-bold pos-btn"
                    title="İade"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> İade
                  </button>
                )}
                {isCancelled && (
                  <span className="flex-1 py-1.5 text-center text-xs text-muted-foreground">
                    İptal edildi
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const sentItems = orderItems.filter(i => !!(i as any)._fromDB);
  const newItems = orderItems.filter(i => !(i as any)._fromDB);

  return (
    <div className={`${fullWidth ? 'w-full' : 'w-full'} bg-card flex flex-col h-full`}>
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">{selectedTable ? selectedTable.name : 'Masa Seçin'}</h2>
            {totalPaid > 0 && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                <span className="text-pos-success font-semibold">Ödenen: {totalPaid} ₺</span>
              </p>
            )}
          </div>
          {selectedTable && orderItems.length > 0 && (
            <button onClick={onPrintAdisyon} className="p-2 rounded-lg hover:bg-muted pos-btn" title="Adisyon Yazdır">
              <Printer className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {orderItems.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center mt-10">
            {selectedTable ? 'Menüden ürün ekleyin' : 'Önce bir masa seçin'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {sentItems.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-1 pt-1 pb-0.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Gönderilmiş</span>
                  <div className="flex-1 border-t border-border" />
                </div>
                {sentItems.map(item => renderItem(item))}
              </>
            )}
            {newItems.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-1 pt-2 pb-0.5">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Yeni Eklenenler</span>
                  <div className="flex-1 border-t border-primary/30" />
                </div>
                {newItems.map(item => renderItem(item))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Footer: totals + send btn ────────────── */}
      <div className="p-3 border-t space-y-2 shrink-0">
        {ikramDeduction > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-amber-600 font-semibold flex items-center gap-1"><Gift className="w-3 h-3" /> İkram</span>
            <span className="text-amber-600 font-semibold">-{ikramDeduction} ₺</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="font-semibold text-muted-foreground text-sm">TOPLAM</span>
          <span className="text-xl font-bold text-primary">{total - ikramDeduction} ₺</span>
        </div>
        {remainingAmount > 0 && totalPaid > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Kalan</span>
            <span className="font-bold text-foreground">{remainingAmount} ₺</span>
          </div>
        )}

        {newItemCount > 0 && (
          <button
            onClick={onSendToKitchen}
            disabled={!selectedTable || isSubmitting}
            className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 pos-btn disabled:opacity-40"
          >
            <Send className="w-4 h-4" /> Mutfağa Gönder ({newItemCount})
          </button>
        )}
        {newItemCount > 0 && orderItems.some(i => !!(i as any)._fromDB) && (
          <button
            onClick={onClearOrder}
            className="w-full py-1.5 rounded-md bg-muted text-muted-foreground font-semibold text-xs pos-btn"
          >
            Taslakları Temizle
          </button>
        )}
      </div>
    </div>
  );
}
