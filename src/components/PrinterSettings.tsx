import { useState, useRef, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { usePrinter } from '@/hooks/use-printer';
import { usePOS } from '@/context/POSContext';
import { testPrint } from '@/lib/printer';
import { removeCategoryRoute, removePrinterForStation } from '@/lib/qz-tray';
import { PrintStation, PrintStationPurpose, ReceiptSettings, DEFAULT_RECEIPT_SETTINGS } from '@/types/pos';
import {
  Wifi, WifiOff, Loader2, Printer, RefreshCw, CheckCircle, XCircle,
  Clock, ChevronDown, ChevronRight, Download, AlertCircle, Info,
  Plus, Trash2, Pencil, Check, X,
} from 'lucide-react';

function genId(): string {
  return 'st_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

export default function PrinterSettings() {
  const { status, error, printers, assignments, printLog, connect, disconnect, refreshPrinters, assignPrinter, isQZLoaded } = usePrinter();
  const { categories, printerConfig, updatePrinterConfig } = usePOS();
  const [routing, setRouting] = useState<Record<string, string>>(printerConfig.categoryRouting || {});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCategoryRouting, setShowCategoryRouting] = useState(false);
  const [testingStation, setTestingStation] = useState<string | null>(null);
  const [newStationName, setNewStationName] = useState('');
  const [newStationPurpose, setNewStationPurpose] = useState<PrintStationPurpose>('prep');

  const stations = printerConfig.stations;
  const receiptSettings = printerConfig.receiptSettings || DEFAULT_RECEIPT_SETTINGS;
  const prepStations = stations.filter(s => s.purpose === 'prep' && s.active);

  // ─── Draft stations (explicit save) ────────────────
  const [draftStations, setDraftStations] = useState<PrintStation[]>(stations);
  const stationsDirty = useMemo(() => JSON.stringify(draftStations) !== JSON.stringify(stations), [draftStations, stations]);
  const stationsJson = JSON.stringify(stations);
  useEffect(() => { setDraftStations(JSON.parse(stationsJson)); }, [stationsJson]);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPurpose, setEditPurpose] = useState<PrintStationPurpose>('prep');

  // Auto-create default Kasa + Mutfak stations on first setup
  const didAutoCreate = useRef(false);
  useEffect(() => {
    if (stations.length === 0 && !didAutoCreate.current) {
      didAutoCreate.current = true;
      updatePrinterConfig({
        ...printerConfig,
        stations: [
          { id: 'receipt', name: 'Kasa', purpose: 'receipt', isDefault: true, active: true },
          { id: 'kitchen', name: 'Mutfak', purpose: 'prep', isDefault: true, active: true },
        ],
        defaultPrepStationId: 'kitchen',
      });
    }
  }, [stations.length, printerConfig, updatePrinterConfig]);

  // ─── Station management ────────────────────────

  const addStation = () => {
    const name = newStationName.trim();
    if (!name) return;
    const station: PrintStation = {
      id: genId(),
      name,
      purpose: newStationPurpose,
      isDefault: newStationPurpose === 'receipt' ? !draftStations.some(s => s.purpose === 'receipt') : !draftStations.some(s => s.purpose === 'prep' && s.isDefault),
      active: true,
    };
    setDraftStations(prev => [...prev, station]);
    setNewStationName('');
  };

  const removeStation = (id: string) => {
    setDraftStations(prev => prev.filter(s => s.id !== id));
  };

  const setDefaultStation = (id: string) => {
    const target = draftStations.find(s => s.id === id);
    if (!target) return;
    setDraftStations(prev => prev.map(s => ({
      ...s,
      isDefault: s.purpose === target.purpose ? s.id === id : s.isDefault,
    })));
  };

  const saveStations = async () => {
    const removedIds = stations.filter(s => !draftStations.some(d => d.id === s.id)).map(s => s.id);
    for (const id of removedIds) removePrinterForStation(id);
    const newCategoryRouting = { ...printerConfig.categoryRouting };
    for (const [catId, stationId] of Object.entries(newCategoryRouting)) {
      if (removedIds.includes(stationId)) { delete newCategoryRouting[catId]; removeCategoryRoute(catId); }
    }
    const prepDraft = draftStations.filter(s => s.purpose === 'prep');
    const defaultPrep = prepDraft.find(s => s.isDefault)?.id || prepDraft[0]?.id;
    const ok = await updatePrinterConfig({ ...printerConfig, stations: draftStations, categoryRouting: newCategoryRouting, defaultPrepStationId: defaultPrep });
    if (ok) {
      toast.success('Yazdirma noktalari kaydedildi');
      setRouting(newCategoryRouting);
      setEditingId(null);
    } else {
      toast.error('Kaydetme basarisiz oldu');
    }
  };

  const resetStations = () => { setDraftStations(stations); setEditingId(null); };

  const startEdit = (s: PrintStation) => { setEditingId(s.id); setEditName(s.name); setEditPurpose(s.purpose); };
  const confirmEdit = () => {
    if (!editingId || !editName.trim()) return;
    setDraftStations(prev => prev.map(s => s.id === editingId ? { ...s, name: editName.trim(), purpose: editPurpose } : s));
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);

  // ─── Category routing ─────────────────────────

  const handleCategoryRoute = async (catId: string, stationId: string) => {
    // Single source of truth: only save to Supabase printerConfig
    const newRouting = { ...printerConfig.categoryRouting };
    if (stationId === '') {
      delete newRouting[catId];
    } else {
      newRouting[catId] = stationId;
    }
    setRouting(newRouting);
    const ok = await updatePrinterConfig({ ...printerConfig, categoryRouting: newRouting });
    if (!ok) toast.error('Kategori yonlendirme kaydedilemedi');
  };

  // ─── Receipt settings (draft mode) ─────────────────────────

  const [draftReceipt, setDraftReceipt] = useState<ReceiptSettings>(receiptSettings);
  const receiptDirty = useMemo(() => JSON.stringify(draftReceipt) !== JSON.stringify(receiptSettings), [draftReceipt, receiptSettings]);
  const updateReceipt = (patch: Partial<ReceiptSettings>) => {
    setDraftReceipt(prev => ({ ...prev, ...patch }));
  };
  const saveReceiptSettings = async () => {
    const ok = await updatePrinterConfig({ ...printerConfig, receiptSettings: draftReceipt });
    if (ok) toast.success('Fis ayarlari kaydedildi');
    else toast.error('Fis ayarlari kaydedilemedi');
  };
  const resetReceiptSettings = () => {
    setDraftReceipt(receiptSettings);
  };

  // Receipt preview generator
  const receiptPreview = useMemo(() => {
    const s = draftReceipt;
    const w = s.paperWidth === 58 ? 32 : 48;
    const sep = '-'.repeat(w);
    const ctr = (t: string) => { const p = Math.max(0, Math.floor((w - t.length) / 2)); return ' '.repeat(p) + t; };
    const rw = (l: string, v: string) => { const g = w - l.length - v.length; return g < 1 ? l + ' ' + v : l + ' '.repeat(g) + v; };
    const lines: string[] = [];
    const logo = s.showLogo ? (s.logoText || 'RESTORAN ADI').toUpperCase() : 'RESTORAN ADI';
    if (s.fontSize === 'large') lines.push(ctr(`[ ${logo} ]`));
    else lines.push(ctr(logo));
    if (s.headerText) lines.push(ctr(s.headerText));
    lines.push('');
    lines.push(sep);
    lines.push(rw('Tarih:', '04.04.2026'));
    lines.push(rw('Saat:', '14:30'));
    lines.push(rw('Masa:', 'Masa 5'));
    if (s.showStaffName) lines.push(rw('Kasiyer:', 'Ali'));
    lines.push(sep);
    lines.push(rw('2x Adana Kebap', '240 TL'));
    if (s.showModifiers) lines.push(rw('    + Acili', '+10 TL'));
    lines.push(rw('1x Ayran', '25 TL'));
    lines.push(rw('1x Baklava', '80 TL'));
    lines.push(sep);
    lines.push(rw('TOPLAM', '355 TL'));
    if (s.showPaymentBreakdown) {
      lines.push(sep.replace(/-/g, '.'));
      lines.push(rw('Nakit', '200 TL'));
      lines.push(rw('Kart', '155 TL'));
    }
    lines.push('');
    lines.push(ctr(s.footerText || 'Tesekkur ederiz!'));
    lines.push('');
    return lines.join('\n');
  }, [draftReceipt]);

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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Yazdirma Noktalari</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Yazdirma noktasi ekleyin ve her birine yazici atayin</p>
          </div>
          {stationsDirty && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">Kaydedilmedi</span>
          )}
        </div>

        {/* Existing stations */}
        <div className="space-y-3">
          {draftStations.map(station => (
            <div key={station.id} className="rounded-md border p-4 space-y-2">
              <div className="flex items-center justify-between">
                {editingId === station.id ? (
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmEdit()} className="flex-1 border rounded-md px-2 py-1 text-sm bg-background" autoFocus />
                    <select value={editPurpose} onChange={e => setEditPurpose(e.target.value as PrintStationPurpose)} className="w-28 border rounded-md px-2 py-1 text-sm bg-background">
                      <option value="prep">Hazirlik</option>
                      <option value="receipt">Kasa</option>
                    </select>
                    <button onClick={confirmEdit} className="p-1.5 rounded hover:bg-green-50 text-green-600 pos-btn"><Check size={14} /></button>
                    <button onClick={cancelEdit} className="p-1.5 rounded hover:bg-muted text-muted-foreground pos-btn"><X size={14} /></button>
                  </div>
                ) : (
                <>
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
                  <button onClick={() => startEdit(station)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground pos-btn"><Pencil size={14} /></button>
                  {!station.isDefault && (
                    <button onClick={() => setDefaultStation(station.id)} className="text-[10px] px-2 py-1 rounded border hover:bg-muted pos-btn">
                      Varsayilan Yap
                    </button>
                  )}
                  <button onClick={() => removeStation(station.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 pos-btn">
                    <Trash2 size={14} />
                  </button>
                </div>
                </>
                )}
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

        {/* Save / Reset station buttons */}
        {stationsDirty && (
          <div className="flex items-center gap-2 pt-3 border-t">
            <button onClick={saveStations} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 font-bold pos-btn">Kaydet</button>
            <button onClick={resetStations} className="px-4 py-2 text-sm border rounded-md hover:bg-muted font-medium pos-btn">Sifirla</button>
          </div>
        )}
      </div>

      {/* ═══ Category Routing (Advanced) ═══ */}
      {prepStations.length > 1 && categories.length > 0 && (
        <div className="rounded-lg border bg-card">
          <button
            onClick={() => setShowCategoryRouting(!showCategoryRouting)}
            className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-muted/50 pos-btn"
          >
            <span className="flex items-center gap-2">
              {showCategoryRouting ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Gelismis: Kategori Yonlendirme
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Opsiyonel</span>
          </button>
          {showCategoryRouting && (
            <div className="px-5 pb-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                Birden fazla hazirlik noktaniz varsa, hangi kategorilerin hangi noktaya gidecegini belirleyin. Varsayilan olarak tum siparisler varsayilan mutfak yazicisina gider.
              </p>
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
        </div>
      )}

      {/* ═══ Receipt Design Settings ═══ */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Fis Tasarimi</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Musteri fislerinin gorunumunu ayarlayin</p>
          </div>
          {receiptDirty && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">Kaydedilmedi</span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Settings controls */}
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
                    draftReceipt.paperWidth === w ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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
                <input type="checkbox" checked={draftReceipt.showLogo} onChange={e => updateReceipt({ showLogo: e.target.checked })} className="rounded" />
                Goster
              </label>
            </div>
            {draftReceipt.showLogo && (
              <input
                value={draftReceipt.logoText || ''}
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
              value={draftReceipt.headerText || ''}
              onChange={e => updateReceipt({ headerText: e.target.value })}
              placeholder="Opsiyonel baslik satiri"
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            />
          </div>

          {/* Footer text */}
          <div className="space-y-1">
            <label className="text-sm">Alt Bilgi</label>
            <input
              value={draftReceipt.footerText}
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
                    draftReceipt.fontSize === fs ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
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
                  onClick={() => updateReceipt({ [key]: !draftReceipt[key] })}
                  className={`w-10 h-6 rounded-full transition-colors relative pos-btn ${
                    draftReceipt[key] ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    draftReceipt[key] ? 'translate-x-4' : 'translate-x-0.5'
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
                    draftReceipt.copies === n ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          </div>

          {/* Right: Live Preview */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Onizleme</p>
            <div className={`mx-auto bg-white text-black rounded-md shadow-inner border p-3 ${
              draftReceipt.paperWidth === 58 ? 'max-w-[240px]' : 'max-w-[340px]'
            }`}>
              <pre className="text-[10px] leading-[14px] font-mono whitespace-pre overflow-x-auto">{receiptPreview}</pre>
            </div>
          </div>
        </div>

        {/* Save / Reset buttons */}
        {receiptDirty && (
          <div className="flex items-center gap-2 pt-3 border-t">
            <button
              onClick={saveReceiptSettings}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 font-bold pos-btn"
            >
              Kaydet
            </button>
            <button
              onClick={resetReceiptSettings}
              className="px-4 py-2 text-sm border rounded-md hover:bg-muted font-medium pos-btn"
            >
              Sifirla
            </button>
          </div>
        )}
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
