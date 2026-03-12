import { useEffect, useRef, useState, memo } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { Order, OrderStatus } from '@/types/pos';
import { Clock, ChefHat, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { playNotification } from '@/lib/sound';

const KITCHEN_COLUMNS: { status: OrderStatus; label: string; emoji: string; bgClass: string }[] = [
  { status: 'sent_to_kitchen', label: 'Yeni Sipariş', emoji: '🔴', bgClass: 'border-pos-danger' },
  { status: 'preparing', label: 'Hazırlanıyor', emoji: '🟡', bgClass: 'border-pos-warning' },
  { status: 'ready', label: 'Hazır', emoji: '🟢', bgClass: 'border-pos-success' },
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

const OrderCard = memo(function OrderCard({ order, onStatusChange }: {
  order: Order;
  onStatusChange: (status: OrderStatus) => void;
}) {
  const elapsed = useElapsedTime(order.createdAt);
  const isUrgent = order.status === 'sent_to_kitchen' && (Date.now() - new Date(order.createdAt).getTime()) > 300000;

  return (
    <div className={`bg-card rounded-2xl border-2 p-4 shadow-sm animate-slide-in ${isUrgent ? 'border-pos-danger ring-2 ring-pos-danger/20' : 'border-border'}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-black text-xl">{order.tableName}</h3>
        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${isUrgent ? 'bg-pos-danger/10 text-pos-danger' : 'bg-muted text-muted-foreground'}`}>
          <Clock className="w-3 h-3" /> {elapsed}
        </span>
      </div>
      <ul className="space-y-1.5 mb-4">
        {order.items.map(item => (
          <li key={item.id} className="text-sm">
            <span className="font-bold">{item.quantity}x</span>{' '}
            <span className="font-medium">{item.menuItem.name}</span>
            {item.modifiers.length > 0 && (
              <div className="ml-5">
                {item.modifiers.map((m, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">• {m.optionName}</p>
                ))}
              </div>
            )}
            {item.note && (
              <p className="ml-5 text-[11px] text-pos-warning font-medium italic">NOT: {item.note}</p>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        {order.status === 'sent_to_kitchen' && (
          <button
            onClick={() => onStatusChange('preparing')}
            className="flex-1 py-3 rounded-xl bg-pos-warning text-pos-warning-foreground font-bold text-sm pos-btn shadow-md"
          >
            🍳 Hazırlanıyor
          </button>
        )}
        {order.status === 'preparing' && (
          <button
            onClick={() => onStatusChange('ready')}
            className="flex-1 py-3 rounded-xl bg-pos-success text-pos-success-foreground font-bold text-sm pos-btn shadow-md"
          >
            ✅ Hazır
          </button>
        )}
      </div>
    </div>
  );
});

export default function MutfakEkrani() {
  const { orders, updateOrderStatus, markOrderReady, refetchOrders } = usePOS();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const kitchenOrders = orders.filter(o =>
    o.status === 'sent_to_kitchen' || o.status === 'preparing' || o.status === 'ready'
  );

  const newCount = kitchenOrders.filter(o => o.status === 'sent_to_kitchen').length;

  const prevNewCount = useRef(newCount);
  useEffect(() => {
    if (newCount > prevNewCount.current) {
      playNotification();
    }
    prevNewCount.current = newCount;
  }, [newCount]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetchOrders();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refetchOrders]);

  useEffect(() => {
    const interval = setInterval(refetchOrders, 10000);
    return () => clearInterval(interval);
  }, [refetchOrders]);

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    if (newStatus === 'ready') {
      markOrderReady(orderId);
    } else {
      updateOrderStatus(orderId, newStatus);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b shrink-0">
        <button onClick={() => { const s = (JSON.parse(localStorage.getItem('auth_session') || '{}')).slug || ''; logout(); navigate(`/pos/${s}`); }} className="p-2 rounded-lg hover:bg-muted pos-btn" title="Çıkış">
          <LogOut className="w-5 h-5" />
        </button>
        <ChefHat className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-black">Mutfak Ekranı</h1>
        {newCount > 0 && (
          <span className="ml-auto px-3 py-1 rounded-full bg-pos-danger text-pos-danger-foreground text-sm font-bold animate-pulse">
            {newCount} yeni
          </span>
        )}
      </header>

      <div className="flex-1 flex min-h-0 p-4 gap-4 overflow-x-auto">
        {KITCHEN_COLUMNS.map(col => {
          const colOrders = kitchenOrders.filter(o => o.status === col.status);
          return (
            <div key={col.status} className="flex-1 min-w-[300px] flex flex-col">
              <h2 className={`text-sm font-black uppercase tracking-wider mb-3 pb-2 border-b-3 ${col.bgClass} flex items-center gap-2`}>
                <span>{col.emoji}</span> {col.label} <span className="text-muted-foreground font-medium">({colOrders.length})</span>
              </h2>
              <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin">
                {colOrders.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center mt-10">Sipariş yok</p>
                ) : (
                  colOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onStatusChange={(status) => handleStatusChange(order.id, status)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
