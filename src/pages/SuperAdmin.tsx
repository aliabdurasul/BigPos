import { useState, useEffect } from 'react';
import { ArrowLeft, Building2, CreditCard, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, BarChart3, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Restaurant, LicensePlan } from '@/types/pos';
import { toast } from 'sonner';

type Tab = 'restoranlar' | 'abonelikler';

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('restoranlar');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Form state ──
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', slug: '', ownerName: '', phone: '', address: '',
    licensePlan: 'starter' as LicensePlan,
    ownerEmail: '', ownerPassword: '',
  });

  // ── Fetch restaurants ──
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) { console.error(error); setLoading(false); return; }

      setRestaurants((data || []).map((r: Record<string, unknown>): Restaurant => ({
        id: r.id as string,
        name: r.name as string,
        slug: (r.slug as string) || undefined,
        ownerName: (r.owner_name as string) || undefined,
        phone: (r.phone as string) || undefined,
        address: (r.address as string) || undefined,
        licensePlan: (r.license_plan as LicensePlan) || 'free',
        active: r.active as boolean,
        createdAt: r.created_at ? new Date(r.created_at as string) : undefined,
      })));
      setLoading(false);
    })();
  }, []);

  // ── Create restaurant + owner (atomic) ──
  const handleCreate = async () => {
    if (!form.name || !form.slug || !form.ownerEmail || !form.ownerPassword) {
      toast.error('Gerekli alanlar: Ad, Slug, Sahibi Email, Sifre');
      return;
    }
    if (form.ownerPassword.length < 4) {
      toast.error('Sifre en az 4 karakter olmali');
      return;
    }
    setSaving(true);
    try {
      const { data: newId, error } = await supabase.rpc('create_restaurant_with_admin', {
        p_name: form.name,
        p_slug: form.slug.toLowerCase().trim(),
        p_owner_name: form.ownerName || form.name,
        p_phone: form.phone || '',
        p_address: form.address || '',
        p_email: form.ownerEmail,
        p_password: form.ownerPassword,
        p_plan: form.licensePlan,
      });

      if (error) {
        if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
          toast.error('Bu slug veya email zaten kullaniliyor');
        } else {
          toast.error('Restoran olusturulamadi: ' + error.message);
        }
        return;
      }

      setRestaurants(prev => [{
        id: newId, name: form.name, slug: form.slug, ownerName: form.ownerName, ownerEmail: form.ownerEmail,
        phone: form.phone, address: form.address, licensePlan: form.licensePlan,
        active: true, createdAt: new Date(),
      }, ...prev]);

      setForm({ name: '', slug: '', ownerName: '', phone: '', address: '', licensePlan: 'starter', ownerEmail: '', ownerPassword: '' });
      setShowForm(false);
      toast.success('Restoran + sahip hesabi olusturuldu');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ──
  const toggleActive = async (id: string, active: boolean) => {
    setRestaurants(prev => prev.map(r => r.id === id ? { ...r, active } : r));
    await supabase.from('restaurants').update({ active }).eq('id', id);
    toast.success(active ? 'Restoran aktif edildi' : 'Restoran pasif edildi');
  };

  // ── Delete ──
  const handleDelete = async (id: string) => {
    if (!confirm('Bu restorani silmek istediginize emin misiniz?')) return;
    setRestaurants(prev => prev.filter(r => r.id !== id));
    await supabase.from('restaurants').delete().eq('id', id);
    toast.success('Restoran silindi');
  };

  // ── Logout ──
  const handleLogout = () => { logout(); navigate('/admin/login'); };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b shrink-0">
        <button onClick={() => navigate('/admin/login')} className="p-2 rounded-lg hover:bg-muted active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Super Admin</h1>
        {session?.type === 'admin' && <span className="text-sm text-muted-foreground">{session.name}</span>}
        <button onClick={handleLogout} className="ml-auto p-2 rounded-lg hover:bg-muted pos-btn" title="Cikis">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="w-56 shrink-0 border-r bg-card p-3 space-y-1">
          <button
            onClick={() => setActiveTab('restoranlar')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-semibold transition-all active:scale-[0.97] ${activeTab === 'restoranlar' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            <Building2 className="w-5 h-5" /> Restoranlar
          </button>
          <button
            onClick={() => setActiveTab('abonelikler')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-semibold transition-all active:scale-[0.97] ${activeTab === 'abonelikler' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            <BarChart3 className="w-5 h-5" /> Analitik
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && activeTab === 'restoranlar' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Restoran Yonetimi</h2>
                <button onClick={() => setShowForm(v => !v)} className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-1.5 active:scale-[0.97]">
                  <Plus className="w-4 h-4" /> Yeni Restoran
                </button>
              </div>

              {showForm && (
                <div className="bg-card border rounded-lg p-5 mb-6 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">Restoran Adi *</label>
                      <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-md border bg-card text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">Slug (URL kodu) *</label>
                      <input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value.replace(/[^a-z0-9-]/g, '') }))} placeholder="ornek: kebapci-mehmet" className="w-full px-4 py-2.5 rounded-md border bg-card text-sm mt-1 font-mono" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">Sahip Adi</label>
                      <input value={form.ownerName} onChange={e => setForm(p => ({ ...p, ownerName: e.target.value }))} className="w-full px-4 py-2.5 rounded-md border bg-card text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">Telefon</label>
                      <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="w-full px-4 py-2.5 rounded-md border bg-card text-sm mt-1" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase">Adres</label>
                      <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="w-full px-4 py-2.5 rounded-md border bg-card text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">Sahip Email *</label>
                      <input type="email" autoComplete="off" value={form.ownerEmail} onChange={e => setForm(p => ({ ...p, ownerEmail: e.target.value }))} className="w-full px-4 py-2.5 rounded-md border bg-card text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">Sahip Sifre *</label>
                      <input type="password" autoComplete="new-password" value={form.ownerPassword} onChange={e => setForm(p => ({ ...p, ownerPassword: e.target.value }))} className="w-full px-4 py-2.5 rounded-md border bg-card text-sm mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">Plan</label>
                      <select value={form.licensePlan} onChange={e => setForm(p => ({ ...p, licensePlan: e.target.value as LicensePlan }))} className="w-full px-4 py-2.5 rounded-md border bg-card text-sm mt-1">
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-md bg-muted font-semibold text-sm">Iptal</button>
                    <button onClick={handleCreate} disabled={saving} className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-1.5 disabled:opacity-40">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Olustur
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {restaurants.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-4 bg-card rounded-lg border">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${r.active ? 'bg-pos-success' : 'bg-muted-foreground'}`} />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground">/{r.slug} {r.ownerName ? `• ${r.ownerName}` : ''}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${r.active ? 'bg-pos-success/10 text-pos-success' : 'bg-muted text-muted-foreground'}`}>
                        {r.active ? 'Aktif' : 'Pasif'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                        {r.licensePlan}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      <button onClick={() => toggleActive(r.id, !r.active)} className="p-2 rounded-lg hover:bg-muted" title={r.active ? 'Pasif Yap' : 'Aktif Yap'}>
                        {r.active ? <ToggleRight className="w-5 h-5 text-pos-success" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {restaurants.length === 0 && (
                  <p className="text-muted-foreground text-center py-12">Henuz restoran yok.</p>
                )}
              </div>
            </div>
          )}

          {!loading && activeTab === 'abonelikler' && (
            <div>
              <h2 className="text-lg font-bold mb-4">Platform Analitik</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-card rounded-lg border text-center">
                  <p className="text-3xl font-bold text-primary">{restaurants.length}</p>
                  <p className="text-sm text-muted-foreground">Toplam Restoran</p>
                </div>
                <div className="p-4 bg-card rounded-lg border text-center">
                  <p className="text-3xl font-bold text-pos-success">{restaurants.filter(r => r.active).length}</p>
                  <p className="text-sm text-muted-foreground">Aktif</p>
                </div>
                <div className="p-4 bg-card rounded-lg border text-center">
                  <p className="text-3xl font-bold text-muted-foreground">{restaurants.filter(r => !r.active).length}</p>
                  <p className="text-sm text-muted-foreground">Pasif</p>
                </div>
              </div>
              <div className="space-y-3">
                {restaurants.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-4 bg-card rounded-lg border">
                    <div>
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-sm text-muted-foreground">{r.licensePlan} plan{r.ownerName ? ` • ${r.ownerName}` : ''}</p>
                    </div>
                    <span className={`text-sm font-bold ${r.active ? 'text-pos-success' : 'text-muted-foreground'}`}>
                      {r.active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
