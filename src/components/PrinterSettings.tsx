import { useState, useCallback, useRef } from 'react';
import { usePrinter } from '@/hooks/use-printer';
import { usePOS } from '@/context/POSContext';
import { testPrint } from '@/lib/printer';
import { getCategoryRouting, setCategoryRoute, removeCategoryRoute } from '@/lib/qz-tray';
import { PrintStation, PrintStationPurpose, ReceiptSettings, DEFAULT_RECEIPT_SETTINGS } from '@/types/pos';
import {
  Wifi, WifiOff, Loader2, Printer, RefreshCw, CheckCircle, XCircle,
  Clock, ChevronDown, ChevronRight, Download, AlertCircle, Info,
  Plus, Trash2,
} from 'lucide-react';

function genId(): string {
  return 'st_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

export default function PrinterSettings() {
  const { status, error, printers, assignments, printLog, connect, disconnect, refreshPrinters, assignPrinter, isQZLoaded } = usePrinter();
  const { categories, printerConfig, updatePrinterConfig } = usePOS();
  const [routing, setRouting] = useState(getCategoryRouting());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testingStation, setTestingStation] = useState<string | null>(null);
  const [newStationName, setNewStationName] = useState('');
  const [newStationPurpose, setNewStationPurpose] = useState<PrintStationPurpose>('prep');

  // Debounced save
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const saveConfig = useCallback((partial: Partial<typeof printerConfig>) => {
    const next = { ...printerConfig, ...partial };
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => updatePrinterConfig(next), 500);
  }, [printerConfig, updatePrinterConfig]);

  const stations = printerConfig.stations;
  const receiptSettings = printerConfig.receiptSettings || DEFAULT_RECEIPT_SETTINGS;
  const prepStations = stations.filter(s => s.purpose === 'prep' && s.active);

  // ─── Station management ────────────────────────

  const addStation = () => {
    const name = newStationName.trim();
    if (!name) return;
    const station: PrintStation = {
      id: genId(),
      name,
      purpose: newStationPurpose,
      isDefault: newStationPurpose === 'receipt' ? !stations.some(s => s.purpose === 'receipt') : !stations.some(s => s.purpose === 'prep' && s.isDefault),
      active: true,
    };
    saveConfig({ stations: [...stations, station] });
    setNewStationName('');
  };

  const removeStation = (id: string) => {
    saveConfig({ stations: stations.filter(s => s.id !== id) });
  };

  const setDefaultStation = (id: string) => {
    const target = stations.find(s => s.id === id);
    if (!target) return;
    const updated = stations.map(s => ({
      ...s,
      isDefault: s.purpose === target.purpose ? s.id === id : s.isDefault,
    }));
    const patch: Partial<typeof printerConfig> = { stations: updated };
    if (target.purpose === 'prep') patch.defaultPrepStationId = id;
    saveConfig(patch);
  };

  // ─── Category routing ─────────────────────────

  const handleCategoryRoute = (catId: string, stationId: string) => {
    if (stationId === '') {
      removeCategoryRoute(catId);
    } else {
      setCategoryRoute(catId, stationId);
    }
    setRouting(getCategoryRouting());
    // Also save to printerConfig for persistence
    const newRouting = { ...printerConfig.categoryRouting };
    if (stationId === '') {
      delete newRouting[catId];
    } else {
      newRouting[catId] = stationId;
    }
    saveConfig({ categoryRouting: newRouting });
  };

  // ─── Receipt settings ─────────────────────────

  const updateReceipt = (patch: Partial<ReceiptSettings>) => {
    saveConfig({ receiptSettings: { ...receiptSettings, ...patch } });
  };

  // ─── Test print ────────────────────────────────

  const handleTestPrint = (stationId: string) => {
    setTestingStation(stationId);
    testPrint(stationId, receiptSettings.paperWidth);
    setTimeout(() => setTestingStation(null), 2000);
  };

  // ─── Setup checklist ──────────────────────────

  const isConnected = status === 'connected';
  const hasPrinters = printers.length > 0;
  const hasReceiptStation = stations.some(s => s.purpose === 'receipt');
  const hasPrepStation = stations.some(s => s.purpose === 'prep');
  const hasAnyAssignment = Object.keys(assignments).length > 0;

  const steps = [
    { done: isQZLoaded, label: isQZLoaded ? 'QZ Tray kutuphanesi yuklendi' : 'QZ Tray kutuphanesi yuklenemedi — sayfayi yenileyin', visible: true },
    { done: isConnected, label: 'QZ Tray baglantisi kuruldu', visible: true },
    { done: hasPrinters, label: 'Yazici bulundu', visible: isConnected },
    { done: hasReceiptStation, label: 'Kasa istasyonu tanimlandi', visible: true },
    { done: hasPrepStation, label: 'Hazirlik istasyonu tanimlandi', visible: true },
    { done: hasAnyAssignment, label: 'En az bir yazici atandi', visible: hasPrinters },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold">Yazici Ayarlari</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Yazdirma noktalarinizi tanimlayin, yazici atayin ve fis tasarimini ayarlayin.
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
          ) : status === 'error' ? (
            <button
              onClick={connect}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 font-bold pos-btn flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Tekrar Dene
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

        {status === 'connecting' && (
          <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 flex items-start gap-2">
            <Loader2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0 animate-spin" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-foreground">Baglanti kuruluyor...</p>
              <p className="text-muted-foreground">QZ Tray ekraninda izin istegi cikarsa &quot;Izin Ver&quot; basin. Yaklasik 10 saniye icinde baglanmazsa otomatik iptal edilecek.</p>
            </div>
          </div>
        )}

        {status === 'error' && error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-red-700 dark:text-red-400">{error}</p>
              <p className="text-muted-foreground">QZ Tray programini kontrol edin ve &quot;Tekrar Dene&quot; butonuna basin.</p>
            </div>
          </div>
        )}

        {!isConnected && status !== 'connecting' && status !== 'error' && (
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

      {/* ═══ Print Stations ═══ */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-sm">Yazdirma Noktalari</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Yazdirma noktasi ekleyin ve her birine yazici atayin</p>
        </div>

        {/* Existing stations */}
        <div className="space-y-3">
          {stations.map(station => (
            <div key={station.id} className="rounded-md border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{station.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    station.purpose === 'receipt' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {station.purpose === 'receipt' ? 'Kasa' : 'Hazirlik'}
                  </span>
                  {station.isDefault && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold uppercase">Varsayilan</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!station.isDefault && (
                    <button onClick={() => setDefaultStation(station.id)} className="text-[10px] px-2 py-1 rounded border hover:bg-muted pos-btn">
                      Varsayilan Yap
                    </button>
                  )}
                  <button onClick={() => removeStation(station.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 pos-btn">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Printer assignment (when connected) */}
              {isConnected && hasPrinters && (
                <div className="flex items-center gap-2">
                  <select
                    value={assignments[station.id] || ''}
                    onChange={e => assignPrinter(station.id, e.target.value)}
                    className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
                  >
                    <option value="">Yazici secin...</option>
                    {printers.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button
                    onClick={() => handleTestPrint(station.id)}
                    disabled={!assignments[station.id] || testingStation === station.id}
                    className="px-3 py-2 text-xs border rounded-md hover:bg-muted disabled:opacity-40 font-medium pos-btn flex items-center gap-1"
                  >
                    {testingStation === station.id ? (
                      <><Loader2 size={12} className="animate-spin" /> Yazdiriliyor</>
                    ) : (
                      <>Test Yazdir</>
                    )}
                  </button>
                </div>
              )}
              {!isConnected && assignments[station.id] && (
                <p className="text-xs text-muted-foreground">Atanan: {assignments[station.id]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Add new station */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <input
            value={newStationName}
            onChange={e => setNewStationName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStation()}
            placeholder="Yeni istasyon adi..."
            className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
          />
          <select
            value={newStationPurpose}
            onChange={e => setNewStationPurpose(e.target.value as PrintStationPurpose)}
            className="w-32 border rounded-md px-2 py-2 text-sm bg-background"
          >
            <option value="prep">Hazirlik</option>
            <option value="receipt">Kasa</option>
          </select>
          <button
            onClick={addStation}
            disabled={!newStationName.trim()}
            className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 font-medium pos-btn flex items-center gap-1 disabled:opacity-40"
          >
            <Plus size={14} /> Ekle
          </button>
        </div>
      </div>

      {/* ═══ Category Routing ═══ */}
      {prepStations.length > 1 && categories.length > 0 && (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-sm">Kategori Yonlendirme</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hangi kategorilerin hangi hazirlik noktasina gidecegini belirleyin
            </p>
          </div>
          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                <span className="text-sm font-medium truncate">{cat.icon ? `${cat.icon} ` : ''}{cat.name}</span>
                <select
                  value={routing[cat.id] || ''}
                  onChange={e => handleCategoryRoute(cat.id, e.target.value)}
                  className="w-48 border rounded-md px-2 py-1.5 text-sm bg-background"
                >
                  <option value="">Varsayilan</option>
                  {prepStations.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Receipt Design Settings ═══ */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-sm">Fis Tasarimi</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Musteri fislerinin gorunumunu ayarlayin</p>
        </div>

        <div className="space-y-4">
          {/* Paper width */}
          <div className="flex items-center justify-between">
            <label className="text-sm">Kagit Genisligi</label>
            <div className="flex rounded-md border overflow-hidden">
              {([58, 80] as const).map(w => (
                <button
                  key={w}
                  onClick={() => updateReceipt({ paperWidth: w })}
                  className={`px-4 py-1.5 text-sm font-medium pos-btn ${
                    receiptSettings.paperWidth === w ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  {w}mm
                </button>
              ))}
            </div>
          </div>

          {/* Logo text */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm">Logo Metni</label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={receiptSettings.showLogo} onChange={e => updateReceipt({ showLogo: e.target.checked })} className="rounded" />
                Goster
              </label>
            </div>
            {receiptSettings.showLogo && (
              <input
                value={receiptSettings.logoText || ''}
                onChange={e => updateReceipt({ logoText: e.target.value })}
                placeholder="Restoran adi kullanilir"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              />
            )}
          </div>

          {/* Header text */}
          <div className="space-y-1">
            <label className="text-sm">Baslik Metni</label>
            <input
              value={receiptSettings.headerText || ''}
              onChange={e => updateReceipt({ headerText: e.target.value })}
              placeholder="Opsiyonel baslik satiri"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            />
          </div>

          {/* Footer text */}
          <div className="space-y-1">
            <label className="text-sm">Alt Bilgi</label>
            <input
              value={receiptSettings.footerText}
              onChange={e => updateReceipt({ footerText: e.target.value })}
              placeholder="Tesekkur ederiz!"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            />
          </div>

          {/* Font size */}
          <div className="flex items-center justify-between">
            <label className="text-sm">Yazi Boyutu</label>
            <div className="flex rounded-md border overflow-hidden">
              {(['normal', 'large'] as const).map(fs => (
                <button
                  key={fs}
                  onClick={() => updateReceipt({ fontSize: fs })}
                  className={`px-4 py-1.5 text-sm font-medium pos-btn ${
                    receiptSettings.fontSize === fs ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  {fs === 'normal' ? 'Normal' : 'Buyuk'}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2 border-t">
            {[
              { key: 'showPaymentBreakdown' as const, label: 'Odeme Detayi Goster' },
              { key: 'showModifiers' as const, label: 'Modifier Goster' },
              { key: 'showStaffName' as const, label: 'Personel Adi Goster' },
              { key: 'openDrawer' as const, label: 'Cekmece Ac' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-sm">{label}</label>
                <button
                  onClick={() => updateReceipt({ [key]: !receiptSettings[key] })}
                  className={`w-10 h-6 rounded-full transition-colors relative pos-btn ${
                    receiptSettings[key] ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    receiptSettings[key] ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>

          {/* Copies */}
          <div className="flex items-center justify-between pt-2 border-t">
            <label className="text-sm">Kopya Sayisi</label>
            <div className="flex rounded-md border overflow-hidden">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => updateReceipt({ copies: n })}
                  className={`px-4 py-1.5 text-sm font-medium pos-btn ${
                    receiptSettings.copies === n ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Print Log ═══ */}
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
                      <span className="font-medium">{job.stationId}</span>
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
