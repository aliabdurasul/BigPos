import { useState, useMemo, useEffect, useCallback } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { Table, Order, TABLE_STATUS_COLORS, TABLE_STATUS_BORDER_COLORS, TABLE_STATUS_LABELS } from '@/types/pos';
import { ArrowLeft, LogOut, Clock, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { playSuccess } from '@/lib/sound';
import { useIsMobile } from '@/hooks/use-mobile';
import CashierPaymentPanel from '@/components/cashier/CashierPaymentPanel';

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
  const isMobile = useIsMobile();

  const [selectedFloor, setSelectedFloor] = useState(floors[0]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileStep, setMobileStep] = useState<'tables' | 'payment'>('tables');
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  // Derived state — always in sync with realtime data
  const selectedTable = useMemo(() => {
    if (!selectedTableId) return null;
    return tables.find(t => t.id === selectedTableId) || null;
  }, [tables, selectedTableId]);

  const selectedOrder = useMemo(() => {
    if (!selectedTableId) return null;
    return orders.find(o => o.tableId === selectedTableId && o.status !== 'paid') || null;
  }, [orders, selectedTableId]);

  // Auto-deselect when table becomes available (payment completed via realtime)
  useEffect(() => {
    if (selectedTableId && selectedTable && selectedTable.status === 'available') {
      setSelectedTableId(null);
      if (isMobile) setMobileStep('tables');
    }
  }, [selectedTable?.status, selectedTableId, isMobile]);

  const floorTables = useMemo(
    () => tables.filter(t => t.floor === selectedFloor),
    [tables, selectedFloor]
  );

  // Desktop left panel: sorted by status priority then duration
  const sortedFloorTables = useMemo(() => {
    const statusOrder: Record<string, number> = { waiting_payment: 0, occupied: 1, available: 2 };
    return [...floorTables].sort((a, b) => {
      const sa = statusOrder[a.status] ?? 3;
      const sb = statusOrder[b.status] ?? 3;
      if (sa !== sb) return sa - sb;
      const da = a.openedAt ? new Date(a.openedAt).getTime() : Infinity;
      const db = b.openedAt ? new Date(b.openedAt).getTime() : Infinity;
      return da - db;
    });
  }, [floorTables]);

  const getTableOrder = useCallback((tableId: string): Order | null => {
    return orders.find(o => o.tableId === tableId && o.status !== 'paid') || null;
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
    setSelectedTableId(table.id);
    if (isMobile) setMobileStep('payment');
  };

  const handleCompletePayment = async (amount: number, method: string, discountAmount?: number, discountReason?: string) => {
    if (!selectedOrder || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await completePayment(selectedOrder.id, amount, method, staffId || undefined, discountAmount, discountReason);
      toast.success(`${amount} ₺ ödeme tamamlandı — ${selectedTable?.name} kapatıldı`);
      playSuccess();
    } catch {
      toast.error('Ödeme işlemi başarısız');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrepayment = async (amount: number, method: string) => {
    if (!selectedOrder || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await recordPrepayment(selectedOrder.id, amount, method);
      toast.success(`${amount} ₺ ön ödeme alındı`);
    } catch {
      toast.error('Ön ödeme kaydedilemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayOrderItems = async (itemIds: string[], amount: number, method: string, discountAmount?: number, discountReason?: string) => {
    if (!selectedOrder || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await payOrderItems(selectedOrder.id, itemIds, amount, method, discountAmount, discountReason);
      toast.success(`${amount} ₺ ürün bazlı ödeme tamamlandı`);
      playSuccess();
    } catch {
      toast.error('Ürün bazlı ödeme başarısız');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkReady = async () => {
    if (!selectedTableId) return;
    const activeOrders = orders.filter(o => o.tableId === selectedTableId && o.status === 'active');
    for (const o of activeOrders) {
      await markOrderReady(o.id);
    }
    toast.success('Sipariş hazır — ödeme bekleniyor');
  };

  const waitingPaymentCount = tables.filter(t => t.status === 'waiting_payment').length;
  const navigateOut = () => { logout(); navigate(`/pos/${session?.type === 'staff' ? session.slug : ''}`); };

  // ─── Mobile Layout ─────────────────────────

  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="flex items-center gap-2 px-4 py-3 bg-card border-b shrink-0">
          {mobileStep === 'payment' ? (
            <button onClick={() => { setMobileStep('tables'); setSelectedTableId(null); }} className="p-2 rounded-md hover:bg-muted pos-btn">
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={navigateOut} className="p-2 rounded-md hover:bg-muted pos-btn">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <DollarSign className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">
            {mobileStep === 'payment' && selectedTable ? selectedTable.name : 'Kasa POS'}
          </h1>
          {staffName && <span className="text-xs text-muted-foreground font-medium ml-1">({staffName})</span>}
          {waitingPaymentCount > 0 && mobileStep === 'tables' && (
            <span className="ml-auto px-2 py-1 rounded-md bg-pos-warning text-pos-warning-foreground text-xs font-bold">
              {waitingPaymentCount} bekliyor
            </span>
          )}
          <button onClick={navigateOut} className="ml-auto p-2 rounded-md hover:bg-muted pos-btn" title="Çıkış">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Mobile Step 1: Tables */}
        {mobileStep === 'tables' && (
          <div className="flex-1 flex flex-col p-3 overflow-hidden">
            <div className="flex gap-2 mb-3 shrink-0">
              {floors.map(f => (
                <button key={f} onClick={() => setSelectedFloor(f)} className={`px-4 py-2 rounded-md text-sm font-bold pos-btn ${selectedFloor === f ? 'bg-primary text-primary-foreground' : 'bg-card border hover:bg-muted'}`}>{f}</button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 flex-1 content-start overflow-y-auto">
              {floorTables.map(t => {
                const order = getTableOrder(t.id);
                const hasOrder = !!order;
                const allPayments = order?.payments || [];
                const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
                const remaining = order ? Math.max(0, order.total - totalPaid) : 0;
                const hasAnyPayment = totalPaid > 0;
                return (
                  <button key={t.id} onClick={() => handleTableTap(t)} className={`flex flex-col items-center justify-center p-3 rounded-lg border min-h-[72px] ${TABLE_STATUS_COLORS[t.status]} ${TABLE_STATUS_BORDER_COLORS[t.status]} pos-btn ${!hasOrder ? 'opacity-60' : ''}`}>
                    <span className="text-lg font-bold">{t.name.replace('Masa ', '')}</span>
                    <span className="text-[10px] opacity-60">{t.name}</span>
                    {order && (hasAnyPayment ? (
                      <>
                        <span className="text-[9px] opacity-60 line-through mt-0.5">{order.total} TL</span>
                        <span className="text-[11px] font-bold">{remaining} TL kalan</span>
                      </>
                    ) : (
                      <span className="text-[11px] font-bold mt-0.5">{order.total} TL</span>
                    ))}
                    <span className="text-[9px] font-bold mt-0.5">{TABLE_STATUS_LABELS[t.status]}</span>
                    {t.openedAt && t.status !== 'available' && (
                      <span className="flex items-center gap-0.5 text-[9px] opacity-60 mt-0.5"><Clock className="w-2.5 h-2.5" /> {formatDuration(t.openedAt)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mobile Step 2: Payment */}
        {mobileStep === 'payment' && selectedOrder && selectedTable && (
          <CashierPaymentPanel
            order={selectedOrder}
            tableName={selectedTable.name}
            restaurantName={restaurantName}
            staffName={staffName || ''}
            onCompletePayment={handleCompletePayment}
            onPrepayment={handlePrepayment}
            onPayOrderItems={handlePayOrderItems}
            onMarkReady={handleMarkReady}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    );
  }

  // ─── Desktop Layout ────────────────────────

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center gap-2 px-4 py-3 bg-card border-b shrink-0">
        <button onClick={navigateOut} className="p-2 rounded-md hover:bg-muted pos-btn">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <DollarSign className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">Kasa POS</h1>
        {staffName && <span className="text-xs text-muted-foreground font-medium ml-1">({staffName})</span>}
        {waitingPaymentCount > 0 && (
          <span className="ml-2 px-3 py-1 rounded-md bg-pos-warning text-pos-warning-foreground text-sm font-bold">
            {waitingPaymentCount} ödeme bekliyor
          </span>
        )}
        <button onClick={navigateOut} className="ml-auto p-2 rounded-md hover:bg-muted pos-btn" title="Çıkış">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Split Panel */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel — Table List */}
        <div className="w-[32%] border-r flex flex-col bg-background">
          <div className="flex gap-2 p-3 border-b shrink-0">
            {floors.map(f => (
              <button key={f} onClick={() => setSelectedFloor(f)} className={`px-4 py-2 rounded-md text-sm font-bold pos-btn ${selectedFloor === f ? 'bg-primary text-primary-foreground' : 'bg-card border hover:bg-muted'}`}>{f}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {sortedFloorTables.map(t => {
              const order = getTableOrder(t.id);
              const hasOrder = !!order;
              const isSelected = selectedTableId === t.id;
              const allPayments = order?.payments || [];
              const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
              const remaining = order ? Math.max(0, order.total - totalPaid) : 0;
              const hasAnyPayment = totalPaid > 0;
              return (
                <button
                  key={t.id}
                  onClick={() => handleTableTap(t)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left pos-btn transition-all ${
                    isSelected ? 'ring-2 ring-primary bg-primary/5 border-primary/30' : ''
                  } ${TABLE_STATUS_COLORS[t.status]} ${TABLE_STATUS_BORDER_COLORS[t.status]} ${!hasOrder ? 'opacity-50' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{t.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{TABLE_STATUS_LABELS[t.status]}</span>
                      {t.openedAt && t.status !== 'available' && (
                        <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {formatDuration(t.openedAt)}</span>
                      )}
                    </div>
                  </div>
                  {hasOrder && (
                    <div className="text-right shrink-0">
                      {hasAnyPayment ? (
                        <>
                          <div className="text-xs opacity-60 line-through">{order.total} ₺</div>
                          <div className="text-sm font-bold">{remaining} ₺</div>
                        </>
                      ) : (
                        <div className="text-sm font-bold">{order.total} ₺</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex gap-3 p-3 border-t justify-center text-[10px] text-muted-foreground shrink-0">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-200 border border-gray-300" /> Boş</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-100 border border-red-300" /> Dolu</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-100 border border-amber-300" /> Ödeme</span>
          </div>
        </div>

        {/* Right Panel — Payment */}
        <div className="w-[68%] flex flex-col">
          {selectedOrder && selectedTable ? (
            <CashierPaymentPanel
              order={selectedOrder}
              tableName={selectedTable.name}
              restaurantName={restaurantName}
              staffName={staffName || ''}
              onCompletePayment={handleCompletePayment}
              onPrepayment={handlePrepayment}
              onPayOrderItems={handlePayOrderItems}
              onMarkReady={handleMarkReady}
              isSubmitting={isSubmitting}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-semibold">Masa Seçin</p>
                <p className="text-sm mt-1">Ödeme almak için soldaki listeden bir masa seçin</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
