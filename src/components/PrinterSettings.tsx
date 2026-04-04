import { useState, useEffect } from 'react';
import { usePrinter } from '@/hooks/use-printer';
import { usePOS } from '@/context/POSContext';
import { testPrint } from '@/lib/printer';
import { getCategoryRouting, setCategoryRoute, removeCategoryRoute, PrinterRole } from '@/lib/qz-tray';
import {
  Wifi, WifiOff, Loader2, Printer, RefreshCw, CheckCircle, XCircle,
  Clock, ChevronDown, ChevronRight, Download, AlertCircle, Info,
} from 'lucide-react';

const ROLES: { key: PrinterRole; label: string; desc: string }[] = [
  { key: 'receipt', label: 'Kasa Fisi', desc: 'Musteri fislerini ve odemeleri yazdirir' },
  { key: 'kitchen', label: 'Mutfak', desc: 'Yemek siparislerini mutfaga gonderir' },
  { key: 'bar', label: 'Bar', desc: 'Icecek siparislerini bara gonderir' },
];

export default function PrinterSettings() {
  const { status, printers, assignments, printLog, connect, disconnect, refreshPrinters, assignPrinter } = usePrinter();
  const { categories } = usePOS();
  const [routing, setRouting] = useState(getCategoryRouting());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testingRole, setTestingRole] = useState<PrinterRole | null>(null);

  // Auto-assign if only 1 printer found and nothing assigned yet
  useEffect(() => {
    if (printers.length === 1 && !assignments.receipt && !assignments.kitchen) {
      assignPrinter('receipt', printers[0]);
      assignPrinter('kitchen', printers[0]);
    }
  }, [printers, assignments, assignPrinter]);

  const handleCategoryRoute = (catId: string, role: string) => {
    if (role === '') {
      removeCategoryRoute(catId);
    } else {
      setCategoryRoute(catId, role as PrinterRole);
    }
    setRouting(getCategoryRouting());
  };

  const handleTestPrint = (role: PrinterRole) => {
    setTestingRole(role);
    testPrint(role);
    setTimeout(() => setTestingRole(null), 2000);
  };

  // Setup checklist
  const isConnected = status === 'connected';
  const hasPrinters = printers.length > 0;
  const hasReceipt = !!assignments.receipt;
  const hasKitchen = !!assignments.kitchen;

  const steps = [
    { done: true, label: 'QZ Tray bilgisayara yuklu', visible: true },
    { done: isConnected, label: 'QZ Tray baglantisi kuruldu', visible: true },
    { done: hasPrinters, label: 'Yazici bulundu', visible: isConnected },
    { done: hasReceipt, label: 'Kasa fisi yazicisi secildi', visible: hasPrinters },
    { done: hasKitchen, label: 'Mutfak yazicisi secildi', visible: hasPrinters },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold">Yazici Ayarlari</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Siparis fislerini ve mutfak bildirimlerini otomatik yazdirmak icin yazicilarinizi ayarlayin.
        </p>
      </div>

      {/* Setup Checklist */}
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          Kurulum Durumu
        </h3>
        <div className="space-y-2">
          {steps.filter(s => s.visible).map((step, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              {step.done ? (
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
              )}
              <span className={step.done ? 'text-foreground' : 'text-muted-foreground'}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* QZ Tray Connection */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Wifi className="w-5 h-5 text-green-600" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <WifiOff className="w-5 h-5 text-red-500" />
              </div>
            )}
            <div>
              <p className="font-semibold text-sm">Yazici Baglantisi</p>
              <p className="text-xs text-muted-foreground">
                {isConnected ? 'Yazicilar hazir' : 'QZ Tray programina baglanin'}
              </p>
            </div>
          </div>
          {isConnected ? (
            <button onClick={disconnect} className="px-4 py-2 text-sm border rounded-md hover:bg-muted font-medium pos-btn">
              Baglatiyi Kes
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={status === 'connecting'}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 font-bold pos-btn flex items-center gap-2 disabled:opacity-50"
            >
              {status === 'connecting' && <Loader2 size={14} className="animate-spin" />}
              Baglan
            </button>
          )}
        </div>

        {/* Help text when not connected */}
        {!isConnected && status !== 'connecting' && (
          <div className="rounded-md bg-muted/50 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-xs space-y-1.5">
                <p className="font-semibold text-foreground">Yazici baglantisi icin QZ Tray gereklidir</p>
                <p className="text-muted-foreground">QZ Tray, tarayiciniz ile yazicilariniz arasinda kopru gorevi gorur. Ucretsiz indirip kurun:</p>
                <ol className="text-muted-foreground space-y-1 ml-4 list-decimal">
                  <li><a href="https://qz.io/download/" target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">qz.io/download</a> adresinden indirin</li>
                  <li>Bilgisayariniza kurun ve calistirin</li>
                  <li>Bu sayfada &quot;Baglan&quot; butonuna basin</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Printer count when connected */}
        {isConnected && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Printer size={14} />
              <span>{printers.length === 0 ? 'Yazici bulunamadi' : `${printers.length} yazici bulundu`}</span>
            </div>
            <button onClick={refreshPrinters} className="flex items-center gap-1 text-xs text-primary hover:underline pos-btn">
              <RefreshCw size={12} /> Yenile
            </button>
          </div>
        )}
      </div>

      {/* Printer Role Assignments */}
      {isConnected && hasPrinters && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-sm">Yazici Atamalari</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Her islem icin hangi yazicinin kullanilacagini secin</p>
          </div>
          <div className="space-y-4">
            {ROLES.map(({ key, label, desc }) => (
              <div key={key} className="rounded-md border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  {assignments[key] && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold uppercase">Atandi</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={assignments[key] || ''}
                    onChange={e => assignPrinter(key, e.target.value)}
                    className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
                  >
                    <option value="">Yazici secin...</option>
                    {printers.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button
                    onClick={() => handleTestPrint(key)}
                    disabled={!assignments[key] || testingRole === key}
                    className="px-3 py-2 text-xs border rounded-md hover:bg-muted disabled:opacity-40 font-medium pos-btn flex items-center gap-1"
                  >
                    {testingRole === key ? (
                      <><Loader2 size={12} className="animate-spin" /> Yazdiriliyor</>
                    ) : (
                      <>Test Yazdir</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Routing */}
      {isConnected && hasPrinters && categories.length > 0 && (assignments.kitchen || assignments.bar) && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-sm">Kategori Yonlendirme</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {assignments.bar
                ? 'Hangi kategorilerin bara, hangilerinin mutfaga gidecegini belirleyin'
                : 'Tum siparisler mutfak yazicisina gonderilir'}
            </p>
          </div>
          {assignments.bar && (
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                  <span className="text-sm font-medium truncate">{cat.icon ? `${cat.icon} ` : ''}{cat.name}</span>
                  <select
                    value={routing[cat.id] || ''}
                    onChange={e => handleCategoryRoute(cat.id, e.target.value)}
                    className="w-44 border rounded-md px-2 py-1.5 text-sm bg-background"
                  >
                    <option value="">Mutfak (varsayilan)</option>
                    <option value="kitchen">Mutfak</option>
                    <option value="bar">Bar</option>
                  </select>
                </div>
              ))}
            </div>
          )}
          {!assignments.bar && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
              Bar yazicisi atandiginda, icecek kategorilerini bara yonlendirebilirsiniz.
            </div>
          )}
        </div>
      )}

      {/* Advanced Section (Logs) */}
      {printLog.length > 0 && (
        <div className="rounded-lg border bg-card">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-muted/50 pos-btn"
          >
            <span className="flex items-center gap-2">
              {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Yazici Gecmisi
            </span>
            <span className="text-xs text-muted-foreground">{printLog.length} islem</span>
          </button>
          {showAdvanced && (
            <div className="px-4 pb-4">
              <div className="max-h-60 overflow-y-auto space-y-1">
                {printLog.slice(0, 50).map(job => (
                  <div key={job.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      {job.status === 'success' && <CheckCircle size={12} className="text-green-500" />}
                      {job.status === 'failed' && <XCircle size={12} className="text-red-500" />}
                      {(job.status === 'pending' || job.status === 'printing') && <Clock size={12} className="text-yellow-500" />}
                      <span className="font-medium">
                        {job.role === 'receipt' ? 'Kasa' : job.role === 'kitchen' ? 'Mutfak' : 'Bar'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === 'success' && <span className="text-green-600">Basarili</span>}
                      {job.status === 'failed' && <span className="text-red-500">Basarisiz{job.attempts > 1 ? ` (${job.attempts} deneme)` : ''}</span>}
                      {job.status === 'pending' && <span className="text-yellow-600">Bekliyor</span>}
                      {job.status === 'printing' && <span className="text-yellow-600">Yazdiriliyor</span>}
                      <span className="text-muted-foreground">
                        {job.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Not connected empty state */}
      {!isConnected && status !== 'connecting' && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center space-y-3">
          <Download className="w-10 h-10 text-muted-foreground mx-auto" />
          <div>
            <p className="font-semibold text-sm">Yazici ayarlari icin QZ Tray gerekli</p>
            <p className="text-xs text-muted-foreground mt-1">
              QZ Tray programini kurup calistirdiktan sonra yazicilarinizi buradan yonetebilirsiniz.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
