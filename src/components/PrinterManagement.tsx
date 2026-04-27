/**
 * PrinterManagement — DB-backed printer registry admin UI
 *
 * Replaces the old QZ Tray-based PrinterSettings for the new agent-based system.
 * Allows admins to:
 *  - View printer status (online/offline/error) from agent heartbeat
 *  - Add/edit/delete printers
 *  - Set category → printer routing
 *  - Manage agents (view last_seen, generate install tokens)
 *  - Send test print jobs
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { usePOS } from '@/context/POSContext';
import { supabase } from '@/lib/supabase';
import { testPrint } from '@/lib/printer';
import { setCategoryRoute, removeCategoryRoute } from '@/lib/qz-tray';
import type { DbPrinter, RestaurantAgent, PrinterStationType, PrinterStatus, ReceiptSettings } from '@/types/pos';
import { DEFAULT_RECEIPT_SETTINGS } from '@/types/pos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Wifi, WifiOff, Loader2, Printer, RefreshCw, CheckCircle, XCircle,
  Clock, Plus, Trash2, Pencil, Check, X, Bot, AlertCircle, Receipt,
} from 'lucide-react';

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PrinterStatus }) {
  const map: Record<PrinterStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    online:  { label: 'Çevrimiçi',  variant: 'default',     icon: <CheckCircle className="w-3 h-3" /> },
    offline: { label: 'Çevrimdışı', variant: 'secondary',   icon: <WifiOff className="w-3 h-3" /> },
    error:   { label: 'Hata',       variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
    unknown: { label: 'Bilinmiyor', variant: 'outline',     icon: <Clock className="w-3 h-3" /> },
  };
  const { label, variant, icon } = map[status];
  return (
    <Badge variant={variant} className="gap-1 text-xs">
      {icon}{label}
    </Badge>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PrinterManagement() {
  const { restaurantId, categories, printerConfig, updatePrinterConfig } = usePOS();
  const [printers, setPrinters] = useState<DbPrinter[]>([]);
  const [agents, setAgents] = useState<RestaurantAgent[]>([]);
  const [categoryRouting, setCategoryRoutingState] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Add/edit form
  const [showAddForm, setShowAddForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    stationType: 'kitchen' as PrinterStationType,
    ipAddress: '',
    port: 9100,
    paperWidth: 80 as 58 | 80,
    agentId: '',
  });

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [printersRes, agentsRes, routesRes] = await Promise.all([
        supabase.from('printers').select('*').eq('restaurant_id', restaurantId).order('created_at'),
        supabase.from('restaurant_agents').select('*').eq('restaurant_id', restaurantId).eq('status', 'active'),
        supabase.from('printer_category_routes').select('category_id, printer_id').eq('restaurant_id', restaurantId),
      ]);

      setPrinters((printersRes.data ?? []).map(mapPrinter));
      setAgents((agentsRes.data ?? []).map(mapAgent));

      const routing: Record<string, string> = {};
      for (const r of routesRes.data ?? []) routing[r.category_id] = r.printer_id;
      setCategoryRoutingState(routing);
    } catch (err) {
      toast.error('Yüklenirken hata oluştu');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  // ─── Realtime printer status ──────────────────

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`printers:${restaurantId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'printers',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setPrinters(prev => prev.map(p =>
            p.id === (payload.new as { id: string }).id ? { ...p, ...mapPrinter(payload.new) } : p
          ));
        } else {
          load();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, load]);

  // ─── CRUD ─────────────────────────────────────

  const resetForm = () => {
    setForm({ name: '', stationType: 'kitchen', ipAddress: '', port: 9100, paperWidth: 80, agentId: '' });
    setEditId(null);
    setShowAddForm(false);
  };

  const startEdit = (p: DbPrinter) => {
    setForm({
      name:        p.name,
      stationType: p.stationType,
      ipAddress:   p.ipAddress,
      port:        p.port,
      paperWidth:  p.paperWidth,
      agentId:     p.agentId ?? '',
    });
    setEditId(p.id);
    setShowAddForm(true);
  };

  const savePrinter = async () => {
    if (!restaurantId) return;
    if (!form.name.trim() || !form.ipAddress.trim()) {
      toast.error('İsim ve IP adresi zorunludur');
      return;
    }

    const payload = {
      restaurant_id: restaurantId,
      agent_id:      form.agentId || null,
      name:          form.name.trim(),
      station_type:  form.stationType,
      ip_address:    form.ipAddress.trim(),
      port:          form.port,
      paper_width:   form.paperWidth,
      active:        true,
    };

    const { error } = editId
      ? await supabase.from('printers').update(payload).eq('id', editId)
      : await supabase.from('printers').insert(payload);

    if (error) {
      toast.error('Kaydetme hatası: ' + error.message);
    } else {
      toast.success(editId ? 'Yazıcı güncellendi' : 'Yazıcı eklendi');
      resetForm();
      await load();
    }
  };

  const deletePrinter = async (id: string) => {
    const { error } = await supabase.from('printers').delete().eq('id', id);
    if (error) {
      toast.error('Silme hatası');
    } else {
      toast.success('Yazıcı silindi');
      await load();
    }
  };

  const toggleActive = async (p: DbPrinter) => {
    const { error } = await supabase.from('printers').update({ active: !p.active }).eq('id', p.id);
    if (!error) {
      setPrinters(prev => prev.map(pp => pp.id === p.id ? { ...pp, active: !p.active } : pp));
    }
  };

  // ─── Category routing ─────────────────────────

  const handleSetRoute = async (categoryId: string, printerId: string) => {
    if (!restaurantId) return;
    if (printerId) {
      await setCategoryRoute(restaurantId, categoryId, printerId);
      setCategoryRoutingState(prev => ({ ...prev, [categoryId]: printerId }));
    } else {
      await removeCategoryRoute(restaurantId, categoryId);
      setCategoryRoutingState(prev => { const n = { ...prev }; delete n[categoryId]; return n; });
    }
  };

  // ─── Test print ───────────────────────────────

  const handleTestPrint = async (p: DbPrinter) => {
    if (!restaurantId) return;
    setTestingId(p.id);
    await testPrint(p.id, restaurantId);
    setTimeout(() => setTestingId(null), 2000);
  };

  // ─── Receipt settings ────────────────────────

  const [draftReceipt, setDraftReceipt] = useState<ReceiptSettings>(
    printerConfig?.receiptSettings ?? DEFAULT_RECEIPT_SETTINGS
  );
  const [receiptDirty, setReceiptDirty] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);

  // Sync when printerConfig loads from DB
  useEffect(() => {
    if (printerConfig?.receiptSettings) {
      setDraftReceipt(printerConfig.receiptSettings);
      setReceiptDirty(false);
    }
  }, [printerConfig?.receiptSettings]);

  function patchReceipt<K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) {
    setDraftReceipt(prev => ({ ...prev, [key]: value }));
    setReceiptDirty(true);
  }

  const saveReceiptSettings = async () => {
    if (!printerConfig) return;
    setSavingReceipt(true);
    const ok = await updatePrinterConfig({ ...printerConfig, receiptSettings: draftReceipt });
    setSavingReceipt(false);
    if (ok !== false) {
      toast.success('Fiş ayarları kaydedildi');
      setReceiptDirty(false);
    } else {
      toast.error('Kaydedilemedi');
    }
  };

  // ─── Install token generation ─────────────────

  const generateInstallToken = async () => {
    if (!restaurantId) return;
    // Generate a random 32-byte token
    const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Hash it
    const msgBuf = new TextEncoder().encode(raw);
    const hashBuf = await crypto.subtle.digest('SHA-256', msgBuf);
    const hash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const { error } = await supabase.from('agent_install_tokens').insert({
      restaurant_id: restaurantId,
      token_hash:    hash,
      token_hint:    raw.slice(-6),
    });

    if (error) {
      toast.error('Token oluşturulamadı: ' + error.message);
    } else {
      // Show the raw token once — it won't be recoverable after this
      navigator.clipboard?.writeText(raw).catch(() => { /* ignore */ });
      toast.success(
        `Kurulum token'ı oluşturuldu ve panoya kopyalandı:\n${raw.slice(0, 16)}...`,
        { duration: 10_000 }
      );
    }
  };

  // ─── Render ───────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 p-8">
        <Loader2 className="animate-spin w-5 h-5" />
        <span>Yazıcılar yükleniyor...</span>
      </div>
    );
  }

  const kitchenPrinters = printers.filter(p => p.stationType !== 'cashier' && p.active);
  const receiptPrinters = printers.filter(p => p.stationType === 'cashier' && p.active);

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Printer className="w-5 h-5" />
          Yazıcı Yönetimi
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Yenile
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Yazıcı Ekle
          </Button>
        </div>
      </div>

      {/* ─── Add/Edit Form ─── */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editId ? 'Yazıcı Düzenle' : 'Yeni Yazıcı'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Yazıcı Adı</label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="örn: Mutfak Yazıcı 1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">IP Adresi</label>
                <Input
                  value={form.ipAddress}
                  onChange={e => setForm(f => ({ ...f, ipAddress: e.target.value }))}
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Port</label>
                <Input
                  type="number"
                  value={form.port}
                  onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Yazıcı Tipi</label>
                <Select value={form.stationType} onValueChange={v => setForm(f => ({ ...f, stationType: v as PrinterStationType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kitchen">Mutfak</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="cashier">Kasa</SelectItem>
                    <SelectItem value="label">Etiket</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Kağıt Genişliği</label>
                <Select value={String(form.paperWidth)} onValueChange={v => setForm(f => ({ ...f, paperWidth: Number(v) as 58 | 80 }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58">58mm</SelectItem>
                    <SelectItem value="80">80mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {agents.length > 0 && (
                <div>
                  <label className="text-sm font-medium">Agent</label>
                  <Select value={form.agentId} onValueChange={v => setForm(f => ({ ...f, agentId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seçin (opsiyonel)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— Yok —</SelectItem>
                      {agents.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.hostname ?? a.id.slice(0, 8)} ({a.tokenHint})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={savePrinter}><Check className="w-4 h-4 mr-1" />Kaydet</Button>
              <Button variant="outline" onClick={resetForm}><X className="w-4 h-4 mr-1" />İptal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Printer List ─── */}
      {printers.length === 0 ? (
        <div className="text-center text-gray-500 py-12 border-2 border-dashed rounded-lg">
          <Printer className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="font-medium">Henüz yazıcı eklenmedi</p>
          <p className="text-sm">Agent kurulursa otomatik olarak yazıcılar tespit edilecektir.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {printers.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 border rounded-lg bg-white">
              <Printer className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{p.name}</span>
                  <StatusBadge status={p.status} />
                  {!p.active && <Badge variant="outline" className="text-xs">Pasif</Badge>}
                </div>
                <div className="text-xs text-gray-500">
                  {p.ipAddress}:{p.port} · {p.paperWidth}mm · {stationTypeLabel(p.stationType)}
                  {p.lastPingOkAt && ` · Son ping: ${new Date(p.lastPingOkAt).toLocaleTimeString('tr-TR')}`}
                </div>
                {p.errorMessage && (
                  <div className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3" />{p.errorMessage}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost" size="sm"
                  onClick={() => handleTestPrint(p)}
                  disabled={testingId === p.id}
                >
                  {testingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => toggleActive(p)}
                  title={p.active ? 'Pasife al' : 'Aktife al'}
                >
                  {p.active ? <Wifi className="w-4 h-4 text-green-600" /> : <WifiOff className="w-4 h-4 text-gray-400" />}
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => deletePrinter(p.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Category Routing ─── */}
      {categories.length > 0 && printers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kategori → Yazıcı Yönlendirme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-3">
                <span className="w-40 truncate text-sm font-medium">{cat.name}</span>
                <Select
                  value={categoryRouting[cat.id] ?? ''}
                  onValueChange={v => handleSetRoute(cat.id, v)}
                >
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Varsayılan yazıcı" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Varsayılan —</SelectItem>
                    {kitchenPrinters.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ─── Agent Management ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Agent Yönetimi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {agents.length === 0 ? (
            <p className="text-sm text-gray-500">Aktif agent bulunamadı.</p>
          ) : (
            agents.map(a => (
              <div key={a.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <div className="text-sm font-medium">{a.hostname ?? 'Bilinmeyen sunucu'}</div>
                  <div className="text-xs text-gray-500">
                    IP: {a.localIp ?? '?'} · v{a.agentVersion ?? '?'} · Token: …{a.tokenHint}
                    {a.lastSeenAt && ` · Son görülme: ${new Date(a.lastSeenAt).toLocaleString('tr-TR')}`}
                  </div>
                </div>
                <Badge variant={a.status === 'active' ? 'default' : 'secondary'}>
                  {a.status === 'active' ? 'Aktif' : a.status}
                </Badge>
              </div>
            ))
          )}
          <Button variant="outline" size="sm" onClick={generateInstallToken}>
            <Plus className="w-4 h-4 mr-1" />
            Yeni Kurulum Token'ı Oluştur
          </Button>
          <p className="text-xs text-gray-500">
            Token sadece bir kez gösterilir ve panoya kopyalanır. Agent kurulum sırasında bu token'ı kullanır.
          </p>
        </CardContent>
      </Card>
      {/* ─── Receipt Settings ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Fiş Ayarları
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Kağıt Genişliği</label>
              <Select
                value={String(draftReceipt.paperWidth)}
                onValueChange={v => patchReceipt('paperWidth', Number(v) as 58 | 80)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="58">58mm</SelectItem>
                  <SelectItem value="80">80mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Kopya Sayısı</label>
              <Input
                type="number" min={1} max={5}
                value={draftReceipt.copies}
                onChange={e => patchReceipt('copies', Math.max(1, Number(e.target.value)))}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Başlık Metni</label>
            <Input
              value={draftReceipt.headerText ?? ''}
              onChange={e => patchReceipt('headerText', e.target.value)}
              placeholder="ör: Restoran Adı, Adres..."
            />
          </div>
          <div>
            <label className="text-sm font-medium">Alt Bilgi Metni</label>
            <Input
              value={draftReceipt.footerText}
              onChange={e => patchReceipt('footerText', e.target.value)}
              placeholder="ör: Teşekkür ederiz!"
            />
          </div>
          <div className="space-y-3 pt-1">
            {([
              ['showLogo',             'Logo göster'],
              ['showModifiers',        'Modifier detaylarını göster'],
              ['showPaymentBreakdown', 'Ödeme dökümünü göster'],
              ['showStaffName',        'Personel adını göster'],
              ['openDrawer',           'Fiş yazdırınca para çekmecesini aç'],
            ] as [keyof ReceiptSettings, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-sm">{label}</label>
                <Switch
                  checked={!!draftReceipt[key]}
                  onCheckedChange={v => patchReceipt(key, v as ReceiptSettings[typeof key])}
                />
              </div>
            ))}
          </div>
          <Button onClick={saveReceiptSettings} disabled={!receiptDirty || savingReceipt}>
            {savingReceipt ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
            Kaydet
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stationTypeLabel(t: PrinterStationType): string {
  const m: Record<PrinterStationType, string> = {
    kitchen: 'Mutfak', bar: 'Bar', cashier: 'Kasa', label: 'Etiket',
  };
  return m[t] ?? t;
}

function mapPrinter(row: Record<string, unknown>): DbPrinter {
  return {
    id:           row.id as string,
    restaurantId: row.restaurant_id as string,
    agentId:      row.agent_id as string | null,
    name:         row.name as string,
    stationType:  row.station_type as PrinterStationType,
    ipAddress:    row.ip_address as string,
    port:         row.port as number,
    paperWidth:   row.paper_width as 58 | 80,
    status:       row.status as PrinterStatus,
    lastPingOkAt: row.last_ping_ok_at as string | null,
    errorMessage: row.error_message as string | null,
    active:       row.active as boolean,
    createdAt:    row.created_at as string,
    updatedAt:    row.updated_at as string,
  };
}

function mapAgent(row: Record<string, unknown>): RestaurantAgent {
  return {
    id:           row.id as string,
    restaurantId: row.restaurant_id as string,
    tokenHint:    row.token_hint as string,
    hostname:     row.hostname as string | null,
    localIp:      row.local_ip as string | null,
    agentVersion: row.agent_version as string | null,
    lastSeenAt:   row.last_seen_at as string | null,
    status:       row.status as RestaurantAgent['status'],
    createdAt:    row.created_at as string,
  };
}
