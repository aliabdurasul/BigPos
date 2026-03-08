import { useState, useMemo } from 'react';
import { usePOS } from '@/context/POSContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, ShoppingCart, Users, Clock, DollarSign, Download, CalendarDays, Utensils, Award } from 'lucide-react';

type TimeRange = 'today' | 'week' | 'month';

const CHART_COLORS = [
  'hsl(16, 85%, 52%)',   // primary
  'hsl(152, 60%, 42%)',  // success
  'hsl(210, 80%, 55%)',  // info
  'hsl(40, 90%, 52%)',   // warning
  'hsl(4, 72%, 56%)',    // danger
  'hsl(280, 60%, 55%)',  // purple
];

// Generate mock hourly data for demo
function generateHourlyData() {
  const hours = [];
  const patterns = [0, 0, 0, 0, 0, 0, 0, 0, 120, 280, 450, 680, 820, 540, 380, 520, 640, 780, 920, 750, 580, 340, 180, 0];
  for (let i = 0; i < 24; i++) {
    const base = patterns[i];
    const variance = Math.floor(Math.random() * (base * 0.3));
    hours.push({
      saat: `${i.toString().padStart(2, '0')}:00`,
      ciro: base + variance,
    });
  }
  return hours;
}

// Mock waiter data
const mockWaiters = [
  { name: 'Ahmet', orders: 22, revenue: 6840, avgTime: '38dk' },
  { name: 'Ayşe', orders: 18, revenue: 5920, avgTime: '32dk' },
  { name: 'Mehmet', orders: 15, revenue: 4650, avgTime: '45dk' },
  { name: 'Fatma', orders: 12, revenue: 3780, avgTime: '41dk' },
];

// Mock weekly data
function generateWeeklyData() {
  const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  return days.map(d => ({
    gun: d,
    ciro: Math.floor(Math.random() * 15000) + 20000,
    siparis: Math.floor(Math.random() * 40) + 50,
  }));
}

export default function AdminDashboard() {
  const { orders, tables, categories, menuItems } = usePOS();
  const [timeRange, setTimeRange] = useState<TimeRange>('today');

  const hourlyData = useMemo(() => generateHourlyData(), []);
  const weeklyData = useMemo(() => generateWeeklyData(), []);

  const stats = useMemo(() => {
    // Use real order data + mock base for demo richness
    const realTotal = orders.reduce((sum, o) => sum + o.total, 0);
    const baseTotal = 38450;
    const totalRevenue = realTotal + baseTotal;
    const totalOrders = orders.length + 67;

    const cashPayments = orders.reduce((sum, o) =>
      sum + (o.payments || []).filter(p => p.method === 'nakit').reduce((s, p) => s + p.amount, 0), 0);
    const cardPayments = orders.reduce((sum, o) =>
      sum + (o.payments || []).filter(p => p.method === 'kredi_karti').reduce((s, p) => s + p.amount, 0), 0);

    const activeTables = tables.filter(t => t.status !== 'bos').length;
    const availableTables = tables.filter(t => t.status === 'bos').length;

    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Product analytics
    const productMap: Record<string, { name: string; count: number; revenue: number; categoryId: string }> = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        const key = item.menuItem.id;
        if (!productMap[key]) productMap[key] = { name: item.menuItem.name, count: 0, revenue: 0, categoryId: item.menuItem.categoryId };
        productMap[key].count += item.quantity;
        productMap[key].revenue += item.menuItem.price * item.quantity;
      });
    });

    // Add mock product data for demo
    const mockProducts = [
      { name: 'Adana Kebap', count: 23, revenue: 6440, categoryId: '1' },
      { name: 'Ayran', count: 31, revenue: 1240, categoryId: '3' },
      { name: 'Adana Dürüm', count: 18, revenue: 3600, categoryId: '2' },
      { name: 'İskender', count: 15, revenue: 4800, categoryId: '1' },
      { name: 'Künefe', count: 14, revenue: 2100, categoryId: '4' },
      { name: 'Mercimek Çorbası', count: 12, revenue: 960, categoryId: '5' },
      { name: 'Kola', count: 28, revenue: 1680, categoryId: '3' },
      { name: 'Lahmacun', count: 11, revenue: 1320, categoryId: '2' },
    ];
    mockProducts.forEach(mp => {
      if (!productMap[mp.name]) {
        productMap[mp.name] = mp;
      } else {
        productMap[mp.name].count += mp.count;
        productMap[mp.name].revenue += mp.revenue;
      }
    });

    const topSelling = Object.values(productMap).sort((a, b) => b.count - a.count).slice(0, 5);
    const topRevenue = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Category distribution
    const categoryRevenue: Record<string, number> = {};
    Object.values(productMap).forEach(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      const catName = cat ? cat.name : 'Diğer';
      categoryRevenue[catName] = (categoryRevenue[catName] || 0) + p.revenue;
    });
    const categoryData = Object.entries(categoryRevenue).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    // Avg table time
    const openTables = tables.filter(t => t.openedAt);
    let avgTableMinutes = 65; // default demo
    if (openTables.length > 0) {
      const totalMin = openTables.reduce((sum, t) => sum + (Date.now() - new Date(t.openedAt!).getTime()) / 60000, 0);
      avgTableMinutes = Math.round(totalMin / openTables.length);
    }

    return {
      totalRevenue,
      totalOrders,
      cashPayments: cashPayments + 12000,
      cardPayments: cardPayments + 26450,
      activeTables,
      availableTables,
      avgOrderValue,
      topSelling,
      topRevenue,
      categoryData,
      avgTableMinutes,
    };
  }, [orders, tables, categories]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const formatCurrency = (val: number) => `${val.toLocaleString('tr-TR')} ₺`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Restoran Genel Bakış
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time range selector */}
          <div className="flex bg-muted rounded-xl p-1">
            {([['today', 'Bugün'], ['week', 'Bu Hafta'], ['month', 'Bu Ay']] as [TimeRange, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTimeRange(key)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  timeRange === key ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-card'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border bg-card text-xs font-bold hover:bg-muted pos-btn">
            <Download className="w-3.5 h-3.5" /> Rapor İndir
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Günlük Ciro"
          value={formatCurrency(stats.totalRevenue)}
          color="primary"
          sub="+12% dünden"
        />
        <SummaryCard
          icon={<ShoppingCart className="w-5 h-5" />}
          label="Toplam Sipariş"
          value={stats.totalOrders.toString()}
          color="info"
          sub={`Ortalama: ${stats.avgOrderValue} ₺`}
        />
        <SummaryCard
          icon={<Utensils className="w-5 h-5" />}
          label="Aktif Masalar"
          value={`${stats.activeTables} / ${stats.activeTables + stats.availableTables}`}
          color="success"
          sub={`${stats.availableTables} masa boş`}
        />
        <SummaryCard
          icon={<Clock className="w-5 h-5" />}
          label="Ort. Masa Süresi"
          value={`${Math.floor(stats.avgTableMinutes / 60)}s ${stats.avgTableMinutes % 60}dk`}
          color="warning"
          sub="Masa başı harcama: ~574 ₺"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hourly Revenue Chart */}
        <div className="lg:col-span-2 bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-4 flex items-center gap-2">
            <BarChart className="w-4 h-4 text-primary" />
            Saatlik Ciro
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData.filter(h => h.ciro > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 12%, 87%)" />
                <XAxis dataKey="saat" tick={{ fontSize: 11 }} stroke="hsl(20, 8%, 46%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(20, 8%, 46%)" tickFormatter={(v) => `${v}₺`} />
                <Tooltip
                  formatter={(value: number) => [`${value.toLocaleString('tr-TR')} ₺`, 'Ciro']}
                  contentStyle={{ borderRadius: 12, border: '1px solid hsl(30, 12%, 87%)', fontSize: 12 }}
                />
                <Bar dataKey="ciro" fill="hsl(16, 85%, 52%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-4">Kategori Dağılımı</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  dataKey="value"
                  stroke="none"
                >
                  {stats.categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [`${value.toLocaleString('tr-TR')} ₺`, 'Gelir']} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {stats.categoryData.map((c, i) => {
              const total = stats.categoryData.reduce((s, x) => s + x.value, 0);
              const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
              return (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="font-medium">{c.name}</span>
                  </div>
                  <span className="font-bold text-muted-foreground">%{pct}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row: Top Selling + Waiter Performance + Revenue Leaders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Selling */}
        <div className="bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            En Çok Satılan Ürünler
          </h3>
          <div className="space-y-2">
            {stats.topSelling.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                  i === 0 ? 'bg-primary text-primary-foreground' : i === 1 ? 'bg-pos-warning/20 text-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{p.name}</p>
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div
                      className="h-1.5 rounded-full bg-primary/70"
                      style={{ width: `${(p.count / stats.topSelling[0].count) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-black text-muted-foreground whitespace-nowrap">{p.count} adet</span>
              </div>
            ))}
          </div>
        </div>

        {/* Waiter Performance */}
        <div className="bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Garson Performansı
          </h3>
          <div className="space-y-3">
            {mockWaiters.map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary">
                  {w.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{w.name}</p>
                  <p className="text-[10px] text-muted-foreground">{w.orders} sipariş · Ort: {w.avgTime}</p>
                </div>
                <span className="text-xs font-black text-primary">{w.revenue.toLocaleString('tr-TR')} ₺</span>
              </div>
            ))}
          </div>
        </div>

        {/* Most Profitable */}
        <div className="bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" />
            En Çok Kazandıran Ürünler
          </h3>
          <div className="space-y-2">
            {stats.topRevenue.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                    i === 0 ? 'bg-pos-success/20 text-pos-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold">{p.name}</span>
                </div>
                <span className="text-xs font-black text-primary">{p.revenue.toLocaleString('tr-TR')} ₺</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Breakdown + Weekly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment Methods */}
        <div className="bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-4">Ödeme Dağılımı</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-pos-success/10 border border-pos-success/20">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Nakit</p>
              <p className="text-lg font-black mt-1" style={{ color: 'hsl(152, 60%, 42%)' }}>{formatCurrency(stats.cashPayments)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                %{stats.totalRevenue > 0 ? Math.round((stats.cashPayments / stats.totalRevenue) * 100) : 0}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-pos-info/10 border border-pos-info/20">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Kredi Kartı</p>
              <p className="text-lg font-black mt-1" style={{ color: 'hsl(210, 80%, 55%)' }}>{formatCurrency(stats.cardPayments)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                %{stats.totalRevenue > 0 ? Math.round((stats.cardPayments / stats.totalRevenue) * 100) : 0}
              </p>
            </div>
          </div>
          {/* Table status summary */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-xs font-bold text-muted-foreground mb-2">MASA DURUMU</h4>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-pos-success" />
                <span className="text-xs font-medium">{stats.availableTables} Boş</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-pos-danger" />
                <span className="text-xs font-medium">{stats.activeTables} Dolu</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-pos-warning" />
                <span className="text-xs font-medium">{tables.filter(t => t.status === 'odeme_bekliyor').length} Ödeme Bekliyor</span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Trend */}
        <div className="bg-card rounded-2xl border p-5">
          <h3 className="text-sm font-black mb-4">Haftalık Satış Trendi</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 12%, 87%)" />
                <XAxis dataKey="gun" tick={{ fontSize: 11 }} stroke="hsl(20, 8%, 46%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(20, 8%, 46%)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'ciro' ? `${value.toLocaleString('tr-TR')} ₺` : value,
                    name === 'ciro' ? 'Ciro' : 'Sipariş'
                  ]}
                  contentStyle={{ borderRadius: 12, border: '1px solid hsl(30, 12%, 87%)', fontSize: 12 }}
                />
                <Legend formatter={(value) => value === 'ciro' ? 'Ciro' : 'Sipariş'} />
                <Line type="monotone" dataKey="ciro" stroke="hsl(16, 85%, 52%)" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="siparis" stroke="hsl(210, 80%, 55%)" strokeWidth={2} dot={{ r: 3 }} yAxisId={0} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'primary' | 'info' | 'success' | 'warning';
  sub: string;
}) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    info: 'bg-pos-info/10 text-pos-info',
    success: 'bg-pos-success/10 text-pos-success',
    warning: 'bg-pos-warning/10 text-pos-warning',
  };

  const valueColorMap = {
    primary: 'text-primary',
    info: '',
    success: '',
    warning: '',
  };

  return (
    <div className="p-5 bg-card rounded-2xl border hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
        <p className="text-[11px] font-bold text-muted-foreground uppercase">{label}</p>
      </div>
      <p className={`text-2xl font-black ${valueColorMap[color]}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
