import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { Order, OrderStatus } from '@/types/pos';
import { ArrowLeft, Clock, ChefHat, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const columns: { status: OrderStatus; label: string; emoji: string; bgClass: string }[] = [
  { status: 'yeni', label: 'Yeni Sipariş', emoji: '🔴', bgClass: 'border-pos-danger' },
  { status: 'hazirlaniyor', label: 'Hazırlanıyor', emoji: '🟡', bgClass: 'border-pos-warning' },
  { status: 'hazir', label: 'Hazır', emoji: '🟢', bgClass: 'border-pos-success' },
];

function timeAgo(date: Date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'Az önce';
  return `${mins} dk önce`;
}

function OrderCard({ order, onStatusChange }: { order: Order; onStatusChange: (status: OrderStatus) => void }) {
  const isUrgent = order.status === 'yeni' && (Date.now() - new Date(order.createdAt).getTime()) > 300000;
  
  return (
    <div className={`bg-card rounded-2xl border-2 p-4 shadow-sm animate-slide-in ${isUrgent ? 'border-pos-danger ring-2 ring-pos-danger/20' : 'border-border'}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-black text-xl">{order.tableName}</h3>
        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${isUrgent ? 'bg-pos-danger/10 text-pos-danger' : 'bg-muted text-muted-foreground'}`}>
          <Clock className="w-3 h-3" /> {timeAgo(order.createdAt)}
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
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        {order.status === 'yeni' && (
          <button
            onClick={() => onStatusChange('hazirlaniyor')}
            className="flex-1 py-3 rounded-xl bg-pos-warning text-pos-warning-foreground font-bold text-sm pos-btn shadow-md"
          >
            🍳 Hazırlanıyor
          </button>
        )}
        {order.status === 'hazirlaniyor' && (
          <button
            onClick={() => onStatusChange('hazir')}
            className="flex-1 py-3 rounded-xl bg-pos-success text-pos-success-foreground font-bold text-sm pos-btn shadow-md"
          >
            ✅ Hazır
          </button>
        )}
      </div>
    </div>
  );
}

export default function MutfakEkrani() {
  const { orders, updateOrderStatus } = usePOS();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const newCount = orders.filter(o => o.status === 'yeni').length;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b shrink-0">
        <button onClick={() => { logout(); navigate('/'); }} className="p-2 rounded-lg hover:bg-muted pos-btn" title="Çıkış">
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
        {columns.map(col => {
          const colOrders = orders.filter(o => o.status === col.status);
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
                    <OrderCard key={order.id} order={order} onStatusChange={(status) => updateOrderStatus(order.id, status)} />
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
