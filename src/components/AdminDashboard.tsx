import { useState, useMemo } from 'react';
import { usePOS } from '@/context/POSContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ShoppingCart, Clock, Award, CreditCard, Banknote, FileText, X } from 'lucide-react';

function generateHourlyData() {
  const hours = [];
  const patterns = [0, 0, 0, 0, 0, 0, 0, 0, 120, 280, 450, 680, 820, 540, 380, 520, 640, 780, 920, 750, 580, 340, 180, 0];
  for (let i = 0; i < 24; i++) {
    const base = patterns[i];
    const variance = Math.floor(Math.random() * (base * 0.3));
    hours.push({ saat: `${i.toString().padStart(2, '0')}:00`, ciro: base + variance });
  }
  return hours;
}

export default function AdminDashboard() {
  const { orders, tables } = usePOS();
  const [showReceipt, setShowReceipt] = useState(false);

  const hourlyData = useMemo(() => generateHourlyData(), []);

  const stats = useMemo(() => {
    const realTotal = orders.reduce((sum, o) => sum + o.total, 0);
    const baseTotal = 38450;
    const totalRevenue = realTotal + baseTotal;
    const totalOrders = orders.length + 67;

    const cashPayments = orders.reduce((sum, o) =>
      sum + (o.payments || []).filter(p => p.method === 'nakit').reduce((s, p) => s + p.amount, 0), 0) + 12000;
    const cardPayments = orders.reduce((sum, o) =>
      sum + (o.payments || []).filter(p => p.method === 'kredi_karti').reduce((s, p) => s + p.amount, 0), 0) + 26450;

    const activeTables = tables.filter(t => t.status !== 'bos').length;
    const availableTables = tables.filter(t => t.status === 'bos').length;

    const productMap: Record<string, { name: string; count: number }> = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        const key = item.menuItem.id;
        if (!productMap[key]) productMap[key] = { name: item.menuItem.name, count: 0 };
        productMap[key].count += item.quantity;
      });
    });
    const mockProducts = [
      { name: 'Adana Dürüm', count: 23 },
      { name: 'Ayran', count: 18 },
      { name: 'Urfa Dürüm', count: 15 },
      { name: 'İskender', count: 14 },
      { name: 'Kola', count: 12 },
    ];
    mockProducts.forEach(mp => {
      if (!productMap[mp.name]) productMap[mp.name] = mp;
      else productMap[mp.name].count += mp.count;
    });
    const topSelling = Object.values(productMap).sort((a, b) => b.count - a.count).slice(0, 5);

    const openTables = tables.filter(t => t.openedAt);
    let avgTableMinutes = 65;
    if (openTables.length > 0) {
      const totalMin = openTables.reduce((sum, t) => sum + (Date.now() - new Date(t.openedAt!).getTime()) / 60000, 0);
      avgTableMinutes = Math.round(totalMin / openTables.length);
    }

    return { totalRevenue, totalOrders, cashPayments, cardPayments, activeTables, availableTables, topSelling, avgTableMinutes };
  }, [orders, tables]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const shortDate = today.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmt = (val: number) => `${val.toLocaleString('tr-TR')} ₺`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black">Günlük Rapor</h2>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{dateStr}</p>
        </div>
        <button
          onClick={() => setShowReceipt(true)}
          className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-destructive text-destructive-foreground font-black text-sm pos-btn shadow-lg hover:opacity-90 transition-opacity"
        >
          <FileText className="w-5 h-5" />
          Günü Kapat
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
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Günlük Ciro</p>
          <p className="text-2xl font-black mt-1">{fmt(stats.totalRevenue)}</p>
        </div>
        <div className="bg-card rounded-2xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl bg-pos-info/10 flex items-center justify-center">
              <ShoppingCart className="w-4.5 h-4.5 text-pos-info" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Toplam Sipariş</p>
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
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Kredi Kartı</p>
          <p className="text-2xl font-black mt-1">{fmt(stats.cardPayments)}</p>
        </div>
      </div>

      {/* Hourly Chart + Top Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-4">Saatlik Ciro</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData.filter(h => h.ciro > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 12%, 87%)" />
                <XAxis dataKey="saat" tick={{ fontSize: 10 }} stroke="hsl(20, 8%, 46%)" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(20, 8%, 46%)" tickFormatter={(v) => `${v}₺`} />
                <Tooltip
                  formatter={(value: number) => [`${value.toLocaleString('tr-TR')} ₺`, 'Ciro']}
                  contentStyle={{ borderRadius: 12, border: '1px solid hsl(30, 12%, 87%)', fontSize: 12 }}
                />
                <Bar dataKey="ciro" fill="hsl(16, 85%, 52%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            En Çok Satılanlar
          </h3>
          <div className="space-y-3">
            {stats.topSelling.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                  i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-bold truncate">{p.name}</span>
                <span className="text-xs font-black text-muted-foreground">{p.count} adet</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Masa + Ödeme özet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-3">Ödeme Dağılımı</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-pos-success/10 border border-pos-success/20">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Nakit</p>
              <p className="text-lg font-black mt-1" style={{ color: 'hsl(152, 60%, 42%)' }}>{fmt(stats.cashPayments)}</p>
              <p className="text-[10px] text-muted-foreground">
                %{stats.totalRevenue > 0 ? Math.round((stats.cashPayments / stats.totalRevenue) * 100) : 0}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-pos-info/10 border border-pos-info/20">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Kredi Kartı</p>
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
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Boş</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-pos-danger">{stats.activeTables}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Dolu</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-pos-warning">{tables.filter(t => t.status === 'odeme_bekliyor').length}</p>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Ödeme Bekliyor</p>
            </div>
            <div className="text-center ml-auto">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <p className="text-lg font-black">{Math.floor(stats.avgTableMinutes / 60)}s {stats.avgTableMinutes % 60}dk</p>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Ort. Masa Süresi</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gün Sonu Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowReceipt(false)}>
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-black text-sm">Gün Sonu Raporu</h3>
              <button onClick={() => setShowReceipt(false)} className="p-2 rounded-lg hover:bg-muted pos-btn">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 font-mono text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
{`----------- GÜN SONU -----------

Tarih: ${shortDate}

Toplam Satış: ${fmt(stats.totalRevenue)}

  Nakit: ${fmt(stats.cashPayments)}

  Kart: ${fmt(stats.cardPayments)}

Toplam Sipariş: ${stats.totalOrders}

En Çok Satılan Ürünler:

${stats.topSelling.map((p, i) => `  ${i + 1}. ${p.name.padEnd(20)} ${p.count} adet`).join('\n\n')}

-------------------------------

         Teşekkür Ederiz!`}
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => { setShowReceipt(false); }}
                className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground font-black text-sm pos-btn shadow-md"
              >
                Günü Kapat & Yazdır
              </button>
              <button
                onClick={() => setShowReceipt(false)}
                className="px-5 py-3.5 rounded-xl border bg-card font-bold text-sm pos-btn"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
