import { useState, useMemo } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { formatGunSonu, printReceipt } from '@/lib/receipt';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ShoppingCart, Clock, Award, CreditCard, Banknote, FileText, X, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { orders, tables, closeDailyReport, restaurantId, restaurantName } = usePOS();
  const { session } = useAuth();
  const staffName = session?.name || null;
  const [showReceipt, setShowReceipt] = useState(false);
  const [closing, setClosing] = useState(false);

  const todayOrders = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return orders.filter(o => new Date(o.createdAt) >= todayStart);
  }, [orders]);

  const hourlyData = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;
    todayOrders.forEach(o => {
      const h = new Date(o.createdAt).getHours();
      hours[h] += o.total;
    });
    return Object.entries(hours)
      .map(([h, ciro]) => ({ saat: `${h.padStart(2, '0')}:00`, ciro }))
      .filter(d => d.ciro > 0);
  }, [todayOrders]);

  const stats = useMemo(() => {
    const allPayments = todayOrders.flatMap(o => o.payments || []);

    const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalOrders = todayOrders.length;

    const cashPayments = allPayments.filter(p => p.method === 'nakit').reduce((s, p) => s + p.amount, 0);
    const cardPayments = allPayments.filter(p => p.method === 'kredi_karti').reduce((s, p) => s + p.amount, 0);
    const splitPayments = allPayments.filter(p => p.method === 'bolunmus').reduce((s, p) => s + p.amount, 0);
    const discountPayments = allPayments.filter(p => p.method === 'discount').reduce((s, p) => s + p.amount, 0);
    const otherPayments = totalRevenue - cashPayments - cardPayments - splitPayments - discountPayments;

    const activeTables = tables.filter(t => t.status !== 'available').length;
    const availableTables = tables.filter(t => t.status === 'available').length;

    const productMap: Record<string, { name: string; count: number }> = {};
    todayOrders.forEach(o => {
      o.items.forEach(item => {
        const key = item.menuItem.id || item.menuItem.name;
        if (!productMap[key]) productMap[key] = { name: item.menuItem.name, count: 0 };
        productMap[key].count += item.quantity;
      });
    });
    const topSelling = Object.values(productMap).sort((a, b) => b.count - a.count).slice(0, 5);

    const openTables = tables.filter(t => t.openedAt);
    let avgTableMinutes = 0;
    if (openTables.length > 0) {
      const totalMin = openTables.reduce((sum, t) => sum + (Date.now() - new Date(t.openedAt!).getTime()) / 60000, 0);
      avgTableMinutes = Math.round(totalMin / openTables.length);
    }

    return { totalRevenue, totalOrders, cashPayments, cardPayments, splitPayments, discountPayments, otherPayments, activeTables, availableTables, topSelling, avgTableMinutes };
  }, [todayOrders, tables]);

  const buildGunSonuData = () => ({
    restaurantName: restaurantName || 'RESTORAN',
    date: new Date(),
    closedBy: staffName || 'Bilinmiyor',
    totalRevenue: stats.totalRevenue,
    cashTotal: stats.cashPayments,
    cardTotal: stats.cardPayments,
    totalOrders: stats.totalOrders,
    cashTransactions: todayOrders.filter(o => (o.payments || []).some(p => p.method === 'nakit')).length,
    cardTransactions: todayOrders.filter(o => (o.payments || []).some(p => p.method === 'kredi_karti')).length,
    emptyTables: stats.availableTables,
    occupiedTables: stats.activeTables,
    waitingPaymentTables: tables.filter(t => t.status === 'waiting_payment').length,
    topProducts: stats.topSelling,
  });

  const handlePrint = () => {
    printReceipt(formatGunSonu(buildGunSonuData()), 'Gun Sonu Raporu');
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const shortDate = today.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const isoDate = today.toISOString().split('T')[0];
  const fmt = (val: number) => `${val.toLocaleString('tr-TR')} TL`;

  const handleCloseDay = async () => {
    setClosing(true);
    try {
      await closeDailyReport({
        restaurantId,
        closedBy: staffName || undefined,
        closedAt: new Date(),
        date: isoDate,
        totalRevenue: stats.totalRevenue,
        totalOrders: stats.totalOrders,
        cashTotal: stats.cashPayments,
        cardTotal: stats.cardPayments,
        topProducts: stats.topSelling,
      });
      toast.success('Gun sonu raporu kaydedildi');
      setShowReceipt(false);
    } catch {
      toast.error('Gun sonu raporu kaydedilemedi');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Gunluk Rapor</h2>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{dateStr}</p>
        </div>
        <button
          onClick={() => setShowReceipt(true)}
          className="flex items-center gap-2 px-6 py-3.5 rounded-md bg-destructive text-destructive-foreground font-bold text-sm pos-btn hover:opacity-90 transition-opacity"
        >
          <FileText className="w-5 h-5" />
          Gunu Kapat
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-primary" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Gunluk Ciro</p>
          <p className="text-2xl font-bold mt-1">{fmt(stats.totalRevenue)}</p>
        </div>
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <ShoppingCart className="w-4.5 h-4.5 text-primary" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Toplam Siparis</p>
          <p className="text-2xl font-bold mt-1">{stats.totalOrders}</p>
        </div>
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Banknote className="w-4.5 h-4.5 text-primary" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Nakit</p>
          <p className="text-2xl font-bold mt-1">{fmt(stats.cashPayments)}</p>
        </div>
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <CreditCard className="w-4.5 h-4.5 text-primary" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Kredi Karti</p>
          <p className="text-2xl font-bold mt-1">{fmt(stats.cardPayments)}</p>
        </div>
      </div>

      {/* Hourly Chart + Top Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-lg border p-5">
          <h3 className="text-sm font-bold mb-4">Saatlik Ciro</h3>
          <div className="h-56">
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 10%, 88%)" />
                  <XAxis dataKey="saat" tick={{ fontSize: 10 }} stroke="hsl(220, 10%, 40%)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(220, 10%, 40%)" tickFormatter={(v) => `${v}TL`} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString('tr-TR')} TL`, 'Ciro']}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(220, 10%, 88%)', fontSize: 12, background: 'hsl(0, 0%, 100%)', color: 'hsl(220, 14%, 10%)' }}
                  />
                  <Bar dataKey="ciro" fill="hsl(217, 91%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Henuz siparis verisi yok
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            En Cok Satiranlar
          </h3>
          <div className="space-y-3">
            {stats.topSelling.length > 0 ? stats.topSelling.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-bold truncate">{p.name}</span>
                <span className="text-xs font-bold text-muted-foreground">{p.count} adet</span>
              </div>
            )) : (
              <p className="text-muted-foreground text-sm">Henuz veri yok</p>
            )}
          </div>
        </div>
      </div>

      {/* Masa + Odeme ozet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border p-5">
          <h3 className="text-sm font-bold mb-3">Odeme Dagilimi</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Nakit</p>
              <p className="text-lg font-bold mt-1 text-foreground">{fmt(stats.cashPayments)}</p>
              <p className="text-[10px] text-muted-foreground">
                %{stats.totalRevenue > 0 ? Math.round((stats.cashPayments / stats.totalRevenue) * 100) : 0}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Kredi Karti</p>
              <p className="text-lg font-bold mt-1 text-foreground">{fmt(stats.cardPayments)}</p>
              <p className="text-[10px] text-muted-foreground">
                %{stats.totalRevenue > 0 ? Math.round((stats.cardPayments / stats.totalRevenue) * 100) : 0}
              </p>
            </div>
            {stats.splitPayments > 0 && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Bolunmus</p>
                <p className="text-lg font-bold mt-1 text-foreground">{fmt(stats.splitPayments)}</p>
                <p className="text-[10px] text-muted-foreground">
                  %{stats.totalRevenue > 0 ? Math.round((stats.splitPayments / stats.totalRevenue) * 100) : 0}
                </p>
              </div>
            )}
            {stats.discountPayments > 0 && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Indirim</p>
                <p className="text-lg font-bold mt-1 text-muted-foreground">{fmt(stats.discountPayments)}</p>
                <p className="text-[10px] text-muted-foreground">
                  %{stats.totalRevenue > 0 ? Math.round((stats.discountPayments / stats.totalRevenue) * 100) : 0}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-lg border p-5">
          <h3 className="text-sm font-bold mb-3">Masa Durumu</h3>
          <div className="flex gap-6 items-center h-full">
            <div className="text-center">
              <p className="text-3xl font-bold text-pos-success">{stats.availableTables}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Bos</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-pos-danger">{stats.activeTables}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Dolu</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-pos-warning">{tables.filter(t => t.status === 'waiting_payment').length}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Odeme Bekliyor</p>
            </div>
            {stats.avgTableMinutes > 0 && (
              <div className="text-center ml-auto">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <p className="text-lg font-bold">{Math.floor(stats.avgTableMinutes / 60)}s {stats.avgTableMinutes % 60}dk</p>
                </div>
                <p className="text-[10px] font-bold text-muted-foreground mt-1">Ort. Masa Suresi</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gun Sonu Fis Dialog */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowReceipt(false)}>
          <div
            className="bg-card rounded-lg w-full max-w-md shadow-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-bold text-sm">Gun Sonu Fisi</h3>
              <div className="flex gap-1">
                <button onClick={handlePrint} className="p-2 rounded-md hover:bg-muted pos-btn" title="Yazdir">
                  <Printer className="w-4 h-4" />
                </button>
                <button onClick={() => setShowReceipt(false)} className="p-2 rounded-md hover:bg-muted pos-btn">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Termal yazici fis formati - text preview */}
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              <pre style={{ fontFamily: "'Courier New', monospace", fontSize: 11, lineHeight: 1.5, color: 'hsl(220, 14%, 10%)', whiteSpace: 'pre-wrap', background: 'hsl(220, 10%, 96%)', padding: 12, borderRadius: 8, border: '1px solid hsl(220, 10%, 88%)' }}>{formatGunSonu(buildGunSonuData())}</pre>
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={handleCloseDay}
                disabled={closing}
                className="flex-1 py-3.5 rounded-md bg-destructive text-destructive-foreground font-bold text-sm pos-btn flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Gunu Kapat ve Kaydet
              </button>
              <button
                onClick={handlePrint}
                className="px-5 py-3.5 rounded-md border bg-card font-bold text-sm pos-btn flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Yazdir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
