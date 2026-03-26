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
    recordPrepayment, payOrderItems, staffId, markOrderReady,
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
      o.tableId === tableId && o.status !== 'paid'
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

  const handlePrepayment = async (amount: number) => {
    if (!selectedOrder) return;
    try {
      await recordPrepayment(selectedOrder.id, amount);
      toast.success(`${amount} ₺ ön ödeme alındı`);
    } catch {
      toast.error('Ön ödeme kaydedilemedi');
    }
    setSelectedTable(null);
    setSelectedOrder(null);
  };

  const handlePayOrderItems = async (itemIds: string[], amount: number, method: string, discountAmount?: number, discountReason?: string) => {
    if (!selectedOrder) return;
    try {
      await payOrderItems(selectedOrder.id, itemIds, amount, method, discountAmount, discountReason);
      toast.success(`${amount} ₺ ürün bazlı ödeme tamamlandı`);
      playSuccess();
    } catch {
      toast.error('Ürün bazlı ödeme başarısız');
    }
    setSelectedTable(null);
    setSelectedOrder(null);
  };

  const handleMarkReady = async (tableId: string) => {
    const activeOrders = orders.filter(o => o.tableId === tableId && o.status === 'active');
    for (const o of activeOrders) {
      await markOrderReady(o.id);
    }
    toast.success('Sipariş hazır — ödeme bekleniyor');
  };

  const waitingPaymentCount = tables.filter(t => t.status === 'waiting_payment').length;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 bg-card border-b shrink-0">
        <button onClick={() => { logout(); navigate(`/pos/${session?.type === 'staff' ? session.slug : ''}`); }} className="p-2 rounded-md hover:bg-muted pos-btn">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <DollarSign className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Kasa POS</h1>
        {staffName && <span className="text-xs text-muted-foreground font-medium ml-1">({staffName})</span>}
        {waitingPaymentCount > 0 && (
          <span className="ml-auto px-3 py-1 rounded-md bg-pos-warning text-pos-warning-foreground text-sm font-bold">
            {waitingPaymentCount} ödeme bekliyor
          </span>
        )}
        <button onClick={() => { logout(); navigate(`/pos/${session?.type === 'staff' ? session.slug : ''}`); }} className="ml-auto p-2 rounded-md hover:bg-muted pos-btn" title="Çıkış">
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
              className={`px-5 py-2.5 rounded-md text-sm font-bold pos-btn ${
                selectedFloor === f ? 'bg-primary text-primary-foreground' : 'bg-card border hover:bg-muted'
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

            const allPayments = order?.payments || [];
            const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
            const remaining = order ? Math.max(0, order.total - totalPaid) : 0;
            const hasAnyPayment = totalPaid > 0;

            return (
              <button
                key={t.id}
                onClick={() => handleTableTap(t)}
                className={`relative flex flex-col items-center justify-center p-4 rounded-lg border ${TABLE_STATUS_BORDER_COLORS[t.status]} bg-card pos-btn transition-all ${
                  isWaiting ? 'hover:bg-muted/50 border-pos-warning/40' : hasOrder ? 'hover:bg-muted/50' : 'opacity-60'
                }`}
              >
                <span className={`absolute top-2 right-2 w-3 h-3 rounded-full ${TABLE_STATUS_COLORS[t.status]}`} />
                <span className="text-2xl font-bold text-foreground">{t.name.replace('Masa ', '')}</span>
                <span className="text-xs text-muted-foreground mt-0.5">{t.name}</span>

                {order && (
                  <>
                    {hasAnyPayment ? (
                      <>
                        <span className="text-[10px] text-muted-foreground line-through mt-1">{order.total} TL</span>
                        <span className="text-sm font-bold text-pos-warning">{remaining} TL kalan</span>
                      </>
                    ) : (
                      <span className="text-sm font-bold text-primary mt-1">{order.total} TL</span>
                    )}
                  </>
                )}

                <span className={`text-[10px] font-bold mt-1 ${isWaiting ? 'text-pos-warning' : 'text-muted-foreground'}`}>
                  {TABLE_STATUS_LABELS[t.status]}
                </span>

                {t.openedAt && t.status !== 'available' && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground mt-0.5">
                    <Clock className="w-2.5 h-2.5" /> {formatDuration(t.openedAt)}
                  </span>
                )}

                {hasOrder && t.status === 'occupied' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMarkReady(t.id); }}
                    className="mt-1.5 px-2.5 py-1 rounded-md bg-pos-success text-pos-success-foreground text-[10px] font-bold pos-btn"
                  >
                    ✅ Hazır
                  </button>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3 justify-center text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pos-success" /> Boş</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Dolu</span>
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
          onPrepayment={handlePrepayment}
          onPayOrderItems={handlePayOrderItems}
          onClose={handleClosePayment}
        />
      )}
    </div>
  );
}
