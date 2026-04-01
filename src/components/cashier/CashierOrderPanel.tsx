import { useMemo } from 'react';
import { OrderItem, Table } from '@/types/pos';
import { Printer, MessageSquare, Gift } from 'lucide-react';

interface CashierOrderPanelProps {
  selectedTable: Table | null;
  orderItems: OrderItem[];
  total: number;
  totalPaid: number;
  remainingAmount: number;
  ikramItems: Set<string>;
  editNoteId: string | null;
  editNoteText: string;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onEditNote: (id: string) => void;
  onSaveNote: (id: string) => void;
  onEditNoteTextChange: (text: string) => void;
  onPrintAdisyon: () => void;
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
    const itemPrice = (item.menuItem.price + item.modifiers.reduce((s, m) => s + m.extraPrice, 0)) * item.quantity;
    const isSent = !!(item as any)._fromDB;
    const isIkram = ikramItems.has(item.id);
    const isSelected = selectedItemId === item.id;

    return (
      <div
        key={item.id}
        onClick={() => onSelectItem(isSelected ? null : item.id)}
        className={`p-2.5 rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'bg-primary/10 border-2 border-primary'
            : isSent
            ? 'bg-muted/30 border border-border'
            : 'bg-muted/40 border border-transparent'
        }`}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-semibold truncate">{item.menuItem.name}</p>
              {isSent && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold shrink-0">GÖNDERİLDİ</span>
              )}
              {isIkram && (
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
            {item.note && !editNoteId && (
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
            <p className={`text-xs font-bold mt-0.5 ${isIkram ? 'line-through text-muted-foreground' : 'text-primary'}`}>
              {itemPrice} ₺
            </p>
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

      <div className="p-3 border-t space-y-1.5">
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
      </div>
    </div>
  );
}
