import { OrderItem, Table } from '@/types/pos';
import { Minus, Plus, X, Send, Trash2, MessageSquare, Printer, CheckCircle } from 'lucide-react';

interface OrderPanelProps {
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
}

export default function OrderPanel({
  selectedTable, orderItems, total, totalPaid, totalPrepayment, remainingAmount,
  editNoteId, editNoteText,
  onUpdateQty, onRemoveItem, onEditNote, onSaveNote, onEditNoteTextChange,
  onSendToKitchen, onClearOrder, onPrintAdisyon, onMarkReady, hasActiveOrders,
  fullWidth,
}: OrderPanelProps) {
  return (
    <div className={`${fullWidth ? 'w-full' : 'w-full'} bg-card flex flex-col h-full`}>
      <div className="p-3 border-b flex items-center justify-between">
        <div>
          <h2 className="font-bold text-base">
            {selectedTable ? selectedTable.name : 'Masa Seçin'}
          </h2>
          {totalPaid > 0 && (
            <p className="text-xs text-pos-success font-semibold mt-0.5">Ödenen: {totalPaid} ₺</p>
          )}
        </div>
        {selectedTable && orderItems.length > 0 && (
          <button onClick={onPrintAdisyon} className="p-2 rounded-lg hover:bg-muted pos-btn" title="Adisyon Yazdır">
            <Printer className="w-4 h-4" />
          </button>
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
              <div key={item.id} className={`p-2.5 rounded-lg animate-slide-in ${(item as any)._fromDB ? 'bg-muted/30 border border-border' : 'bg-muted/40'}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold truncate">{item.menuItem.name}</p>
                      {(item as any)._fromDB && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold shrink-0">GÖNDERİLDİ</span>
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
            ))}
          </div>
        )}
      </div>

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
        <button
          onClick={onSendToKitchen}
          disabled={!selectedTable || orderItems.length === 0}
          className="w-full py-4 rounded-md bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-2 pos-btn disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" /> Mutfağa Gönder
        </button>
        {hasActiveOrders && onMarkReady && (
          <button
            onClick={onMarkReady}
            className="w-full py-3 rounded-md bg-pos-success text-pos-success-foreground font-bold text-sm flex items-center justify-center gap-2 pos-btn"
          >
            <CheckCircle className="w-4 h-4" /> Sipariş Hazır
          </button>
        )}
        <button
          onClick={onClearOrder}
          disabled={orderItems.length === 0}
          className="w-full py-2.5 rounded-md bg-muted text-muted-foreground font-semibold text-sm flex items-center justify-center gap-1.5 pos-btn disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4" /> Temizle
        </button>
      </div>
    </div>
  );
}
