import { useEffect, useRef, useState, memo } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { Order, OrderStatus } from '@/types/pos';
import { Clock, ChefHat, LogOut, Printer, X, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { playNotification } from '@/lib/sound';
import { formatKitchenTicket, printReceipt } from '@/lib/receipt';
import { supabase } from '@/lib/supabase';

const KITCHEN_COLUMNS: { status: OrderStatus; label: string; emoji: string; borderClass: string; bgClass: string }[] = [
  { status: 'sent_to_kitchen', label: 'Yeni Sipariş', emoji: '🔴', borderClass: 'border-pos-danger',  bgClass: 'bg-pos-danger/5'  },
  { status: 'preparing',       label: 'Hazırlanıyor',  emoji: '🟡', borderClass: 'border-pos-warning', bgClass: 'bg-pos-warning/5' },
  { status: 'ready',           label: 'Hazır',          emoji: '🟢', borderClass: 'border-pos-success', bgClass: 'bg-pos-success/5' },
];

function useElapsedTime(date: Date) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Az önce';
  return `${mins} dk`;
}

// ── Cancel reason modal ─────────────────────────────────────────────────────

interface CancelTarget { orderId: string; tableName: string; orderTag: string; }

function CancelModal({
  target, restaurantId, onConfirm, onClose,
}: {
  target: CancelTarget;
  restaurantId: string;
  onConfirm: (orderId: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await supabase.from('kitchen_logs').insert({
      restaurant_id: restaurantId,
      order_id: target.orderId,
      action: 'iptal',
      note: reason.trim() || '(Açıklama girilmedi)',
      created_at: new Date().toISOString(),
    });
    onConfirm(target.orderId);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-pos-danger/10">
          <AlertTriangle className="w-5 h-5 text-pos-danger shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-black text-base">Sipariş İptali</p>
            <p className="text-xs text-muted-foreground truncate">{target.tableName} &bull; #{target.orderTag}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted pos-btn"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-2">
          <label className="text-sm font-medium">İptal açıklaması</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Örn: Müşteri vazgeçti, yanlış sipariş..."
            rows={3}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pos-danger"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">İsteğe bağlı — raporlarda görünür</p>
        </div>
        <div className="px-5 py-3 flex gap-2 border-t bg-muted/30">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border font-bold text-sm pos-btn bg-background">Geri Dön</button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-pos-danger text-pos-danger-foreground font-bold text-sm pos-btn disabled:opacity-50"
          >
            {loading ? 'İptal ediliyor…' : 'İptal Et'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order card (clean UI, ticket format only for print) ────────────────────

const OrderCard = memo(function OrderCard({
  order, onStatusChange, onCancelRequest,
}: {
  order: Order;
  onStatusChange: (status: OrderStatus) => void;
  onCancelRequest: () => void;
}) {
  const elapsed = useElapsedTime(order.createdAt);
  const isUrgent = order.status === 'sent_to_kitchen' && Date.now() - new Date(order.createdAt).getTime() > 300000;

  const handlePrint = () => {
    const ticket = formatKitchenTicket({
      tableName: order.tableName,
      orderNumber: order.id.slice(-4).toUpperCase(),
      date: new Date(order.createdAt),
      items: order.items.map(i => ({
        name: i.menuItem.name,
        qty: i.quantity,
        modifiers: i.modifiers.map(m => m.optionName),
        note: i.note,
      })),
    });
    printReceipt(ticket, `Mutfak - ${order.tableName}`);
  };

  const allNotes = order.items.filter(i => i.note).map(i => i.note as string);

  return (
    <div className={`bg-card rounded-xl border-2 overflow-hidden shadow-sm animate-slide-in ${isUrgent ? 'border-pos-danger ring-2 ring-pos-danger/20' : 'border-border'}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${isUrgent ? 'bg-pos-danger/10' : 'bg-muted/60'}`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-black text-2xl tracking-tight leading-none">{order.tableName}</span>
          <span className="text-xs font-mono text-muted-foreground shrink-0">#{order.id.slice(-4).toUpperCase()}</span>
        </div>
        <div className="flex justify-end mt-0.5">
          <span className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? 'text-pos-danger font-bold' : 'text-muted-foreground'}`}>
            <Clock className="w-3 h-3" />{elapsed}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-1.5">
        {order.items.map(item => (
          <div key={item.id}>
            <p className="text-base font-bold leading-snug">
              <span className="text-primary font-black inline-block w-8">{item.quantity}x</span>
              {item.menuItem.name}
            </p>
            {item.modifiers.map((m, i) => (
              <p key={i} className="text-xs text-muted-foreground ml-8">+ {m.optionName}</p>
            ))}
          </div>
        ))}
        {allNotes.length > 0 && (
          <p className="text-sm font-bold text-pos-warning pt-1.5 border-t border-pos-warning/20 mt-1">
            Not: {allNotes.join(', ')}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-3 pb-3 flex gap-2 items-center">
        {order.status === 'sent_to_kitchen' && (
          <>
            <button onClick={onCancelRequest} className="py-2 px-3 rounded-lg bg-muted text-muted-foreground font-bold text-sm pos-btn border">İptal</button>
            <button onClick={() => onStatusChange('preparing')} className="flex-1 py-2 rounded-lg bg-pos-warning text-pos-warning-foreground font-bold text-sm pos-btn">🍳 Hazırlanıyor</button>
          </>
        )}
        {order.status === 'preparing' && (
          <>
            <button onClick={onCancelRequest} className="py-2 px-3 rounded-lg bg-muted text-muted-foreground font-bold text-sm pos-btn border">İptal</button>
            <button onClick={() => onStatusChange('ready')} className="flex-1 py-2 rounded-lg bg-pos-success text-pos-success-foreground font-bold text-sm pos-btn">✅ Hazır</button>
          </>
        )}
        {order.status === 'ready' && (
          <>
            <button onClick={onCancelRequest} className="py-2 px-3 rounded-lg bg-muted text-muted-foreground font-bold text-sm pos-btn border">İptal</button>
            <button onClick={() => onStatusChange('waiting_payment')} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm pos-btn">🤝 Teslim Edildi</button>
          </>
        )}
        <button onClick={handlePrint} className="p-2 rounded-lg bg-muted hover:bg-muted/80 pos-btn border" title="Fişi Yazdır">
          <Printer className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

// ── Main screen ─────────────────────────────────────────────────────────────

export default function MutfakEkrani() {
  const { orders, updateOrderStatus, markOrderReady, refetchOrders, restaurantId } = usePOS();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);

  const kitchenOrders = orders.filter(o =>
    o.status === 'sent_to_kitchen' || o.status === 'preparing' || o.status === 'ready'
  );
  const newCount = kitchenOrders.filter(o => o.status === 'sent_to_kitchen').length;

  const prevNewCount = useRef(newCount);
  useEffect(() => {
    if (newCount > prevNewCount.current) playNotification();
    prevNewCount.current = newCount;
  }, [newCount]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refetchOrders(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetchOrders]);

  useEffect(() => {
    const interval = setInterval(refetchOrders, 10000);
    return () => clearInterval(interval);
  }, [refetchOrders]);

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    if (newStatus === 'waiting_payment') {
      markOrderReady(orderId);
    } else {
      updateOrderStatus(orderId, newStatus);
    }
  };

  const handleCancelConfirm = (orderId: string) => {
    updateOrderStatus(orderId, 'closed');
    setCancelTarget(null);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b shrink-0">
        <button
          onClick={() => { const s = (JSON.parse(localStorage.getItem('auth_session') || '{}')).slug || ''; logout(); navigate(`/pos/${s}`); }}
          className="p-2 rounded-lg hover:bg-muted pos-btn" title="Çıkış"
        >
          <LogOut className="w-5 h-5" />
        </button>
        <ChefHat className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-black">Mutfak Ekranı</h1>
        {newCount > 0 && (
          <span className="ml-auto px-3 py-1 rounded-full bg-pos-danger text-pos-danger-foreground text-sm font-bold">
            {newCount} yeni
          </span>
        )}
      </header>

      <div className="flex-1 flex min-h-0 p-4 gap-4 overflow-x-auto">
        {KITCHEN_COLUMNS.map(col => {
          const colOrders = kitchenOrders.filter(o => o.status === col.status);
          return (
            <div key={col.status} className={`flex-1 min-w-[280px] flex flex-col rounded-xl ${col.bgClass} p-3`}>
              <h2 className={`text-xs font-black uppercase tracking-wider mb-3 pb-2 border-b-2 ${col.borderClass} flex items-center gap-2`}>
                <span>{col.emoji}</span> {col.label}
                <span className="ml-auto text-muted-foreground font-medium">{colOrders.length}</span>
              </h2>
              <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin">
                {colOrders.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center mt-10">Sipariş yok</p>
                ) : (
                  colOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onStatusChange={status => handleStatusChange(order.id, status)}
                      onCancelRequest={() => setCancelTarget({ orderId: order.id, tableName: order.tableName, orderTag: order.id.slice(-4).toUpperCase() })}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {cancelTarget && (
        <CancelModal
          target={cancelTarget}
          restaurantId={restaurantId}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  );
}
