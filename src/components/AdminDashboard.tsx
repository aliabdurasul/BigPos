import { useState, useMemo, useEffect, useRef } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ShoppingCart, Clock, Award, CreditCard, Banknote, FileText, X, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { orders, tables, closeDailyReport, restaurantId } = usePOS();
  const { session } = useAuth();
  const staffName = session?.name || null;
  const [showReceipt, setShowReceipt] = useState(false);
  const [closing, setClosing] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!restaurantId) return;
    supabase.from('restaurants').select('name').eq('id', restaurantId).single()
      .then(({ data }) => { if (data) setRestaurantName((data as { name: string }).name); });
  }, [restaurantId]);

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Gun Sonu Fisi</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; width: 80mm; padding: 4mm; font-size: 12px; color: #000; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
        .big { font-size: 16px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .mt { margin-top: 8px; }
        @media print { body { width: 80mm; } }
      </style></head><body>
      ${receiptRef.current.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  // Generate hourly data from REAL orders only
  const hourlyData = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;
    orders.forEach(o => {
      const h = new Date(o.createdAt).getHours();
      hours[h] += o.total;
    });
    return Object.entries(hours)
      .map(([h, ciro]) => ({ saat: `${h.padStart(2, '0')}:00`, ciro }))
      .filter(d => d.ciro > 0);
  }, [orders]);

  const stats = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;

    const cashPayments = orders.reduce((sum, o) =>
      sum + (o.payments || []).filter(p => p.method === 'nakit').reduce((s, p) => s + p.amount, 0), 0);
    const cardPayments = orders.reduce((sum, o) =>
      sum + (o.payments || []).filter(p => p.method === 'kredi_karti').reduce((s, p) => s + p.amount, 0), 0);

    const activeTables = tables.filter(t => t.status !== 'bos').length;
    const availableTables = tables.filter(t => t.status === 'bos').length;

    const productMap: Record<string, { name: string; count: number }> = {};
    orders.forEach(o => {
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

    return { totalRevenue, totalOrders, cashPayments, cardPayments, activeTables, availableTables, topSelling, avgTableMinutes };
  }, [orders, tables]);

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
          <h2 className="text-xl font-black">Gunluk Rapor</h2>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{dateStr}</p>
        </div>
        <button
          onClick={() => setShowReceipt(true)}
          className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-destructive text-destructive-foreground font-black text-sm pos-btn shadow-lg hover:opacity-90 transition-opacity"
        >
          <FileText className="w-5 h-5" />
          Gunu Kapat
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-primary" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Gunluk Ciro</p>
          <p className="text-2xl font-black mt-1">{fmt(stats.totalRevenue)}</p>
        </div>
        <div className="bg-card rounded-2xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-pos-info/10 flex items-center justify-center">
              <ShoppingCart className="w-4.5 h-4.5 text-pos-info" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Toplam Siparis</p>
          <p className="text-2xl font-black mt-1">{stats.totalOrders}</p>
        </div>
        <div className="bg-card rounded-2xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-pos-success/10 flex items-center justify-center">
              <Banknote className="w-4.5 h-4.5 text-pos-success" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Nakit</p>
          <p className="text-2xl font-black mt-1">{fmt(stats.cashPayments)}</p>
        </div>
        <div className="bg-card rounded-2xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-pos-warning/10 flex items-center justify-center">
              <CreditCard className="w-4.5 h-4.5 text-pos-warning" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Kredi Karti</p>
          <p className="text-2xl font-black mt-1">{fmt(stats.cardPayments)}</p>
        </div>
      </div>

      {/* Hourly Chart + Top Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-4">Saatlik Ciro</h3>
          <div className="h-56">
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 12%, 87%)" />
                  <XAxis dataKey="saat" tick={{ fontSize: 10 }} stroke="hsl(20, 8%, 46%)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(20, 8%, 46%)" tickFormatter={(v) => `${v}TL`} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toLocaleString('tr-TR')} TL`, 'Ciro']}
                    contentStyle={{ borderRadius: 12, border: '1px solid hsl(30, 12%, 87%)', fontSize: 12 }}
                  />
                  <Bar dataKey="ciro" fill="hsl(16, 85%, 52%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Henuz siparis verisi yok
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            En Cok Satiranlar
          </h3>
          <div className="space-y-3">
            {stats.topSelling.length > 0 ? stats.topSelling.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                  i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-bold truncate">{p.name}</span>
                <span className="text-xs font-black text-muted-foreground">{p.count} adet</span>
              </div>
            )) : (
              <p className="text-muted-foreground text-sm">Henuz veri yok</p>
            )}
          </div>
        </div>
      </div>

      {/* Masa + Odeme ozet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-3">Odeme Dagilimi</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-pos-success/10 border border-pos-success/20">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Nakit</p>
              <p className="text-lg font-black mt-1" style={{ color: 'hsl(152, 60%, 42%)' }}>{fmt(stats.cashPayments)}</p>
              <p className="text-[10px] text-muted-foreground">
                %{stats.totalRevenue > 0 ? Math.round((stats.cashPayments / stats.totalRevenue) * 100) : 0}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-pos-info/10 border border-pos-info/20">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Kredi Karti</p>
              <p className="text-lg font-black mt-1" style={{ color: 'hsl(210, 80%, 55%)' }}>{fmt(stats.cardPayments)}</p>
              <p className="text-[10px] text-muted-foreground">
                %{stats.totalRevenue > 0 ? Math.round((stats.cardPayments / stats.totalRevenue) * 100) : 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-3">Masa Durumu</h3>
          <div className="flex gap-6 items-center h-full">
            <div className="text-center">
              <p className="text-3xl font-black text-pos-success">{stats.availableTables}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Bos</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-pos-danger">{stats.activeTables}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Dolu</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-pos-warning">{tables.filter(t => t.status === 'odeme_bekliyor').length}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Odeme Bekliyor</p>
            </div>
            {stats.avgTableMinutes > 0 && (
              <div className="text-center ml-auto">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <p className="text-lg font-black">{Math.floor(stats.avgTableMinutes / 60)}s {stats.avgTableMinutes % 60}dk</p>
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
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-black text-sm">Gun Sonu Fisi</h3>
              <div className="flex gap-1">
                <button onClick={handlePrint} className="p-2 rounded-lg hover:bg-muted pos-btn" title="Yazdir">
                  <Printer className="w-4 h-4" />
                </button>
                <button onClick={() => setShowReceipt(false)} className="p-2 rounded-lg hover:bg-muted pos-btn">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Termal yazici fis formati */}
            <div ref={receiptRef} className="p-5 max-h-[70vh] overflow-y-auto">
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12, lineHeight: 1.6, color: '#000' }}>
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 'bold' }}>{restaurantName || 'RESTORAN'}</div>
                  <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>GUN SONU RAPORU</div>
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tarih:</span>
                  <span style={{ fontWeight: 'bold' }}>{shortDate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Saat:</span>
                  <span style={{ fontWeight: 'bold' }}>{new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {staffName && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Kapatan:</span>
                    <span style={{ fontWeight: 'bold' }}>{staffName}</span>
                  </div>
                )}

                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 14 }}>
                  <span>TOPLAM CIRO</span>
                  <span>{fmt(stats.totalRevenue)}</span>
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                <div style={{ fontWeight: 'bold', marginBottom: 2 }}>ODEME DETAYI</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nakit:</span>
                  <span>{fmt(stats.cashPayments)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Kredi Karti:</span>
                  <span>{fmt(stats.cardPayments)}</span>
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                <div style={{ fontWeight: 'bold', marginBottom: 2 }}>SATIS ADETLERI</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Toplam Siparis:</span>
                  <span style={{ fontWeight: 'bold' }}>{stats.totalOrders} adet</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nakit Islem:</span>
                  <span>{orders.filter(o => (o.payments || []).some(p => p.method === 'nakit')).length} adet</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Kart Islem:</span>
                  <span>{orders.filter(o => (o.payments || []).some(p => p.method === 'kredi_karti')).length} adet</span>
                </div>

                {stats.topSelling.length > 0 && (
                  <>
                    <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                    <div style={{ fontWeight: 'bold', marginBottom: 2 }}>EN COK SATILAN</div>
                    {stats.topSelling.map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{i + 1}. {p.name}</span>
                        <span>{p.count} ad.</span>
                      </div>
                    ))}
                  </>
                )}

                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

                <div style={{ fontWeight: 'bold', marginBottom: 2 }}>MASA DURUMU</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Bos:</span>
                  <span>{stats.availableTables}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Dolu:</span>
                  <span>{stats.activeTables}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Odeme Bekliyor:</span>
                  <span>{tables.filter(t => t.status === 'odeme_bekliyor').length}</span>
                </div>

                <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

                <div style={{ textAlign: 'center', fontSize: 10, color: '#666' }}>
                  <div>--- GUN SONU ---</div>
                  <div style={{ marginTop: 4 }}>Bu fis otomatik olusturulmustur</div>
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={handleCloseDay}
                disabled={closing}
                className="flex-1 py-3.5 rounded-xl bg-destructive text-destructive-foreground font-black text-sm pos-btn shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Gunu Kapat ve Kaydet
              </button>
              <button
                onClick={handlePrint}
                className="px-5 py-3.5 rounded-xl border bg-card font-bold text-sm pos-btn flex items-center gap-2"
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
