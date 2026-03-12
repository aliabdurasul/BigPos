import { useState, useMemo, useEffect, useCallback } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { Table, Order, TABLE_STATUS_COLORS, TABLE_STATUS_BORDER_COLORS, TABLE_STATUS_LABELS } from '@/types/pos';
import { ArrowLeft, LogOut, Clock, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { playSuccess } from '@/lib/sound';
import PaymentScreen from '@/components/cashier/PaymentScreen';

function formatDuration(openedAt?: Date) {
  if (!openedAt) return '';
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
  if (mins < 1) return 'Az önce';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

export default function CashierPOS() {
  const {
    tables, orders, floors, restaurantName, completePayment,
    staffId,
  } = usePOS();
  const { session, logout } = useAuth();
  const staffName = session?.name || null;
  const navigate = useNavigate();

  const [selectedFloor, setSelectedFloor] = useState(floors[0]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  const floorTables = useMemo(
    () => tables.filter(t => t.floor === selectedFloor),
    [tables, selectedFloor]
  );

  const getTableOrder = useCallback((tableId: string): Order | null => {
    const tableOrders = orders.filter(o =>
      o.tableId === tableId && o.status !== 'paid' && o.status !== 'closed'
    );
    return tableOrders[0] || null;
  }, [orders]);

  const handleTableTap = (table: Table) => {
    const order = getTableOrder(table.id);
    if (!order) {
      if (table.status === 'available') {
        toast.info('Bu masa boş');
      } else {
        toast.info('Bu masanın aktif siparişi yok');
      }
      return;
    }
    setSelectedTable(table);
    setSelectedOrder(order);
  };

  const handleCompletePayment = async (amount: number, method: string, discountAmount?: number, discountReason?: string) => {
    if (!selectedOrder) return;
    try {
      await completePayment(selectedOrder.id, amount, method, staffId || undefined, discountAmount, discountReason);
      toast.success(`${amount} ₺ ödeme tamamlandı — ${selectedTable?.name} kapatıldı`);
      playSuccess();
      setSelectedTable(null);
      setSelectedOrder(null);
    } catch {
      toast.error('Ödeme işlemi başarısız');
    }
  };

  const handleClosePayment = () => {
    setSelectedTable(null);
    setSelectedOrder(null);
  };

  const waitingPaymentCount = tables.filter(t => t.status === 'waiting_payment').length;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 bg-card border-b shrink-0">
        <button onClick={() => { logout(); navigate(`/pos/${session?.type === 'staff' ? session.slug : ''}`); }} className="p-2 rounded-lg hover:bg-muted pos-btn">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <DollarSign className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-black">Kasa POS</h1>
        {staffName && <span className="text-xs text-muted-foreground font-medium ml-1">({staffName})</span>}
        {waitingPaymentCount > 0 && (
          <span className="ml-auto px-3 py-1 rounded-full bg-pos-warning text-pos-warning-foreground text-sm font-bold animate-pulse">
            {waitingPaymentCount} ödeme bekliyor
          </span>
        )}
        <button onClick={() => { logout(); navigate(`/pos/${session?.type === 'staff' ? session.slug : ''}`); }} className="ml-auto p-2 rounded-lg hover:bg-muted pos-btn" title="Çıkış">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Floor Selector */}
        <div className="flex gap-2 mb-4">
          {floors.map(f => (
            <button
              key={f}
              onClick={() => setSelectedFloor(f)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold pos-btn ${
                selectedFloor === f ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card border hover:bg-muted'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Table Grid */}
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 flex-1 content-start overflow-y-auto">
          {floorTables.map(t => {
            const order = getTableOrder(t.id);
            const isWaiting = t.status === 'waiting_payment';
            const hasOrder = !!order;

            return (
              <button
                key={t.id}
                onClick={() => handleTableTap(t)}
                className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 ${TABLE_STATUS_BORDER_COLORS[t.status]} bg-card pos-btn transition-all ${
                  isWaiting ? 'hover:shadow-lg ring-2 ring-pos-warning/30 animate-pulse-slow' : hasOrder ? 'hover:shadow-md' : 'opacity-60'
                }`}
              >
                <span className={`absolute top-2 right-2 w-3 h-3 rounded-full ${TABLE_STATUS_COLORS[t.status]}`} />
                <span className="text-2xl font-black text-foreground">{t.name.replace('Masa ', '')}</span>
                <span className="text-xs text-muted-foreground mt-1">{t.name}</span>

                {order && (
                  <span className="text-sm font-black text-primary mt-1">{order.total} TL</span>
                )}

                <span className={`text-[10px] font-bold mt-1 ${isWaiting ? 'text-pos-warning' : 'text-muted-foreground'}`}>
                  {TABLE_STATUS_LABELS[t.status]}
                </span>

                {t.openedAt && t.status !== 'available' && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground mt-0.5">
                    <Clock className="w-2.5 h-2.5" /> {formatDuration(t.openedAt)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3 justify-center text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pos-success" /> Boş</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Sipariş Var</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pos-danger" /> Hazırlanıyor</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Hazır</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pos-warning" /> Ödeme Bekliyor</span>
        </div>
      </div>

      {/* Payment Screen Modal */}
      {selectedOrder && selectedTable && (
        <PaymentScreen
          order={selectedOrder}
          tableName={selectedTable.name}
          restaurantName={restaurantName}
          staffName={staffName || ''}
          onCompletePayment={handleCompletePayment}
          onClose={handleClosePayment}
        />
      )}
    </div>
  );
}
