import { useState, useMemo } from 'react';
import { usePOS } from '@/context/POSContext';
import { useAuth } from '@/context/AuthContext';
import { MenuItem, Staff, ModifierGroup } from '@/types/pos';
import { ArrowLeft, Plus, Trash2, UtensilsCrossed, Grid3X3, Tag, Users, Store, BarChart3, Edit3, X, Layers, LogOut, Settings2, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import AdminDashboard from '@/components/AdminDashboard';

type Tab = 'raporlar' | 'menu' | 'kategori' | 'modifierler' | 'masa' | 'personel' | 'katlar';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'raporlar', label: 'Raporlar', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'menu', label: 'Menu', icon: <UtensilsCrossed className="w-5 h-5" /> },
  { id: 'kategori', label: 'Kategoriler', icon: <Tag className="w-5 h-5" /> },
  { id: 'modifierler', label: 'Modifierler', icon: <Settings2 className="w-5 h-5" /> },
  { id: 'masa', label: 'Masalar', icon: <Grid3X3 className="w-5 h-5" /> },
  { id: 'katlar', label: 'Katlar', icon: <Layers className="w-5 h-5" /> },
  { id: 'personel', label: 'Personel', icon: <Users className="w-5 h-5" /> },
];

export default function RestoranAdmin() {
  const {
    categories, menuItems, tables, floors, orders,
    addCategory, removeCategory, addMenuItem, updateMenuItem, removeMenuItem,
    addTable, removeTable, addFloor, removeFloor,
    staff, addStaff, removeStaff, updateStaff,
    restaurantId, modifierGroups, productModifierMap, setProductModifiers,
    addModifierGroup, updateModifierGroup, removeModifierGroup,
    addModifierOption, removeModifierOption,
  } = usePOS();
  const { session, logout } = useAuth();
  const staffName = session?.name || null;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('raporlar');

  // Menu form state
  const [showMenuDialog, setShowMenuDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState({
    name: '', description: '', price: '', categoryId: '',
    portionInfo: '', allergenInfo: '', spiceLevel: 0, kitchenNote: '',
  });

  // Category form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');

  // Table form
  const [newTableName, setNewTableName] = useState('');
  const [newTableFloor, setNewTableFloor] = useState(floors[0] || '');

  // Floor form
  const [newFloorName, setNewFloorName] = useState('');

  // Staff form
  const [showStaffDialog, setShowStaffDialog] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', role: 'garson' as string, pin: '' });

  // Modifier form
  const [newModGroupName, setNewModGroupName] = useState('');
  const [newModGroupType, setNewModGroupType] = useState<'checkbox' | 'radio'>('checkbox');
  const [expandedModGroup, setExpandedModGroup] = useState<string | null>(null);
  const [newOptName, setNewOptName] = useState('');
  const [newOptPrice, setNewOptPrice] = useState('');

  // Menu dialog modifier selection
  const [menuModifierIds, setMenuModifierIds] = useState<string[]>([]);

  const openMenuDialog = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      setMenuForm({
        name: item.name,
        description: item.description || '',
        price: String(item.price),
        categoryId: item.categoryId,
        portionInfo: item.portionInfo || '',
        allergenInfo: item.allergenInfo || '',
        spiceLevel: item.spiceLevel || 0,
        kitchenNote: item.kitchenNote || '',
      });
      setMenuModifierIds(productModifierMap.get(item.id) || []);
    } else {
      setEditingItem(null);
      setMenuForm({ name: '', description: '', price: '', categoryId: categories[0]?.id || '', portionInfo: '', allergenInfo: '', spiceLevel: 0, kitchenNote: '' });
      setMenuModifierIds([]);
    }
    setShowMenuDialog(true);
  };

  const handleSaveMenuItem = async () => {
    if (!menuForm.name || !menuForm.price) return;
    const hasModifiers = menuModifierIds.length > 0;
    const data = {
      name: menuForm.name,
      description: menuForm.description || undefined,
      price: Number(menuForm.price),
      categoryId: menuForm.categoryId,
      hasModifiers,
      portionInfo: menuForm.portionInfo || undefined,
      allergenInfo: menuForm.allergenInfo || undefined,
      spiceLevel: menuForm.spiceLevel,
      kitchenNote: menuForm.kitchenNote || undefined,
    };
    try {
      if (editingItem) {
        await updateMenuItem(editingItem.id, data);
        setProductModifiers(editingItem.id, menuModifierIds);
        toast.success('Urun guncellendi');
      } else {
        await addMenuItem(data);
        // Link modifiers to newly created item (find by name — item was just added to state)
        const created = menuItems.find(m => m.name === data.name);
        if (created && menuModifierIds.length > 0) {
          setProductModifiers(created.id, menuModifierIds);
        }
        toast.success('Urun eklendi');
      }
      setShowMenuDialog(false);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? (err as Error).message : String(err);
      toast.error('Menu islemi basarisiz: ' + msg);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName) return;
    try {
      await addCategory({ name: newCategoryName, icon: newCategoryIcon || undefined });
      setNewCategoryName('');
      setNewCategoryIcon('');
      toast.success('Kategori eklendi');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? (err as Error).message : String(err);
      toast.error('Kategori eklenemedi: ' + msg);
    }
  };

  const handleAddTable = async () => {
    if (!newTableName) return;
    try {
      await addTable({ name: newTableName, status: 'available', floor: newTableFloor });
      setNewTableName('');
      toast.success('Masa eklendi');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? (err as Error).message : String(err);
      toast.error('Masa eklenemedi: ' + msg);
    }
  };

  const handleAddFloor = async () => {
    if (!newFloorName) return;
    try {
      await addFloor(newFloorName);
      setNewFloorName('');
      toast.success('Kat eklendi');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? (err as Error).message : String(err);
      toast.error('Kat eklenemedi: ' + msg);
    }
  };

  const handleAddStaff = async () => {
    if (!staffForm.name || !staffForm.pin) return;
    if (staffForm.pin.length < 4) { toast.error('PIN en az 4 haneli olmali'); return; }
    try {
      await addStaff({
        restaurantId,
        name: staffForm.name,
        role: staffForm.role as Staff['role'],
        pin: staffForm.pin,
        active: true,
      });
      setShowStaffDialog(false);
      setStaffForm({ name: '', role: 'garson', pin: '' });
      toast.success('Personel eklendi');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? (err as Error).message : String(err);
      toast.error('Personel eklenemedi: ' + msg);
    }
  };

  const sessionSlug = session?.type === 'admin' ? session.slug : (session?.type === 'staff' ? session.slug : '');

  const handleLogout = () => {
    logout();
    navigate(`/pos/${sessionSlug}`);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 px-4 py-3 bg-card border-b shrink-0">
        <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-muted pos-btn">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Store className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-black">Restoran Yonetimi</h1>
        <div className="ml-auto flex items-center gap-2">
          {staffName && <span className="text-sm text-muted-foreground font-medium">{staffName}</span>}
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-muted pos-btn" title="Cikis Yap">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="w-56 shrink-0 border-r bg-card p-3 space-y-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold pos-btn ${
                activeTab === t.id ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-muted'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'raporlar' && <AdminDashboard />}

          {activeTab === 'menu' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black">Menu Yonetimi</h2>
                <button onClick={() => openMenuDialog()} className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 pos-btn shadow-md">
                  <Plus className="w-4 h-4" /> Yeni Urun
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {menuItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-card rounded-xl border hover:shadow-md transition-shadow">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm">{item.name}</p>
                      {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
                      <p className="text-primary font-black text-sm">{item.price} TL</p>
                      <p className="text-xs text-muted-foreground">{categories.find(c => c.id === item.categoryId)?.name}</p>
                      {item.portionInfo && <p className="text-[10px] text-muted-foreground">Porsiyon: {item.portionInfo}</p>}
                      {item.allergenInfo && <p className="text-[10px] text-pos-warning">Alerjen: {item.allergenInfo}</p>}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => openMenuDialog(item)} className="p-2 text-muted-foreground hover:bg-muted rounded-xl pos-btn">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeMenuItem(item.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-xl pos-btn">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'kategori' && (
            <div>
              <h2 className="text-lg font-black mb-4">Kategori Yonetimi</h2>
              <div className="flex gap-2 mb-6">
                <input value={newCategoryIcon} onChange={e => setNewCategoryIcon(e.target.value)} placeholder="Ikon" className="px-4 py-3 rounded-xl border bg-card text-sm w-24" />
                <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Kategori adi" className="px-4 py-3 rounded-xl border bg-card text-sm flex-1" />
                <button onClick={handleAddCategory} className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 pos-btn shadow-md">
                  <Plus className="w-4 h-4" /> Ekle
                </button>
              </div>
              <div className="space-y-2">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-4 bg-card rounded-xl border">
                    <span className="font-bold flex items-center gap-2">{c.icon} {c.name}</span>
                    <button onClick={() => removeCategory(c.id)} className="p-2.5 text-destructive hover:bg-destructive/10 rounded-xl pos-btn">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'modifierler' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black">Modifier Yonetimi</h2>
                <button
                  onClick={async () => {
                    try {
                      const g1 = await addModifierGroup({ name: 'Porsiyon', type: 'radio' });
                      await addModifierOption(g1, { name: 'Tek', extraPrice: 0 });
                      await addModifierOption(g1, { name: 'Double', extraPrice: 15 });
                      const g2 = await addModifierGroup({ name: 'Ekstralar', type: 'checkbox' });
                      await addModifierOption(g2, { name: 'Extra Sos', extraPrice: 5 });
                      await addModifierOption(g2, { name: 'Extra Kaşar', extraPrice: 10 });
                      await addModifierOption(g2, { name: 'Soğansız', extraPrice: 0 });
                      toast.success('Hazır şablonlar eklendi');
                    } catch { toast.error('Şablon eklenemedi'); }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-muted font-semibold text-sm pos-btn"
                >
                  ✨ Hazır Şablonlar
                </button>
              </div>
              {/* Add new group */}
              <div className="flex gap-2 mb-6">
                <input value={newModGroupName} onChange={e => setNewModGroupName(e.target.value)} placeholder="Grup adı (ör: Porsiyon)" className="px-4 py-3 rounded-xl border bg-card text-sm flex-1" />
                <select value={newModGroupType} onChange={e => setNewModGroupType(e.target.value as 'checkbox' | 'radio')} className="px-4 py-3 rounded-xl border bg-card text-sm">
                  <option value="checkbox">Çoklu Seçim</option>
                  <option value="radio">Tekli Seçim</option>
                </select>
                <button onClick={async () => {
                  if (!newModGroupName) return;
                  try {
                    await addModifierGroup({ name: newModGroupName, type: newModGroupType });
                    setNewModGroupName('');
                    toast.success('Modifier grubu eklendi');
                  } catch { toast.error('Grup eklenemedi'); }
                }} className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 pos-btn shadow-md">
                  <Plus className="w-4 h-4" /> Ekle
                </button>
              </div>
              {/* Group list */}
              <div className="space-y-3">
                {modifierGroups.map(group => {
                  const isExpanded = expandedModGroup === group.id;
                  return (
                    <div key={group.id} className="bg-card rounded-xl border overflow-hidden">
                      <div className="flex items-center justify-between p-4">
                        <button onClick={() => setExpandedModGroup(isExpanded ? null : group.id)} className="flex items-center gap-2 flex-1 text-left pos-btn">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <span className="font-bold text-sm">{group.name}</span>
                          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">{group.type === 'radio' ? 'Tekli' : 'Çoklu'}</span>
                          <span className="text-xs text-muted-foreground">({group.options.length} seçenek)</span>
                        </button>
                        <button onClick={async () => {
                          try { await removeModifierGroup(group.id); toast.success('Grup silindi'); } catch { toast.error('Silinemedi'); }
                        }} className="p-2.5 text-destructive hover:bg-destructive/10 rounded-xl pos-btn">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t pt-3 space-y-2">
                          {group.options.map(opt => (
                            <div key={opt.id} className="flex items-center justify-between px-3 py-2.5 bg-muted/50 rounded-lg">
                              <div>
                                <span className="text-sm font-medium">{opt.name}</span>
                                {opt.extraPrice > 0 && <span className="text-xs text-primary font-bold ml-2">+{opt.extraPrice} ₺</span>}
                              </div>
                              <button onClick={async () => {
                                try { await removeModifierOption(opt.id, group.id); toast.success('Seçenek silindi'); } catch { toast.error('Silinemedi'); }
                              }} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg pos-btn">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {/* Add option */}
                          <div className="flex gap-2 pt-1">
                            <input value={newOptName} onChange={e => setNewOptName(e.target.value)} placeholder="Seçenek adı" className="flex-1 px-3 py-2.5 rounded-lg border bg-card text-sm" />
                            <input value={newOptPrice} onChange={e => setNewOptPrice(e.target.value)} type="number" placeholder="Fiyat" className="w-24 px-3 py-2.5 rounded-lg border bg-card text-sm" />
                            <button onClick={async () => {
                              if (!newOptName) return;
                              try {
                                await addModifierOption(group.id, { name: newOptName, extraPrice: Number(newOptPrice) || 0 });
                                setNewOptName('');
                                setNewOptPrice('');
                                toast.success('Seçenek eklendi');
                              } catch { toast.error('Eklenemedi'); }
                            }} className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm pos-btn">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {modifierGroups.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">Henüz modifier grubu eklenmemiş. "Hazır Şablonlar" ile hızlıca başlayabilirsiniz.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'masa' && (
            <div>
              <h2 className="text-lg font-black mb-4">Masa Yonetimi</h2>
              <div className="flex gap-2 mb-6">
                <input value={newTableName} onChange={e => setNewTableName(e.target.value)} placeholder="Masa adi (or: Masa 13)" className="px-4 py-3 rounded-xl border bg-card text-sm flex-1" />
                <select value={newTableFloor} onChange={e => setNewTableFloor(e.target.value)} className="px-4 py-3 rounded-xl border bg-card text-sm">
                  {floors.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <button onClick={handleAddTable} className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 pos-btn shadow-md">
                  <Plus className="w-4 h-4" /> Ekle
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {tables.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-4 bg-card rounded-xl border">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${t.status === 'available' ? 'bg-pos-success' : t.status === 'waiting_payment' ? 'bg-pos-warning' : 'bg-pos-danger'}`} />
                      <div>
                        <span className="font-bold text-sm">{t.name}</span>
                        <p className="text-[10px] text-muted-foreground">{t.floor}</p>
                      </div>
                    </div>
                    <button onClick={() => removeTable(t.id)} className="p-2.5 text-destructive hover:bg-destructive/10 rounded-xl pos-btn">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'katlar' && (
            <div>
              <h2 className="text-lg font-black mb-4">Kat Yonetimi</h2>
              <div className="flex gap-2 mb-6">
                <input value={newFloorName} onChange={e => setNewFloorName(e.target.value)} placeholder="Kat adi (or: Bahce)" className="px-4 py-3 rounded-xl border bg-card text-sm flex-1" />
                <button onClick={handleAddFloor} className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 pos-btn shadow-md">
                  <Plus className="w-4 h-4" /> Ekle
                </button>
              </div>
              <div className="space-y-2">
                {floors.map(f => (
                  <div key={f} className="flex items-center justify-between p-4 bg-card rounded-xl border">
                    <span className="font-bold text-sm">{f}</span>
                    <button onClick={() => removeFloor(f)} className="p-2.5 text-destructive hover:bg-destructive/10 rounded-xl pos-btn">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'personel' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black">Personel Yonetimi</h2>
                <button onClick={() => setShowStaffDialog(true)} className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 pos-btn shadow-md">
                  <Plus className="w-4 h-4" /> Yeni Personel
                </button>
              </div>
              <div className="space-y-3">
                {staff.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4 bg-card rounded-xl border">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="font-bold text-sm">{s.name}</span>
                        <p className="text-xs text-muted-foreground capitalize">{s.role === 'garson' ? 'Garson' : s.role === 'mutfak' ? 'Mutfak' : 'Admin'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-muted px-2 py-1 rounded-lg">PIN: {s.pin}</span>
                      <button onClick={() => removeStaff(s.id)} className="p-2.5 text-destructive hover:bg-destructive/10 rounded-xl pos-btn">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {staff.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">Henuz personel eklenmemis</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu Item Dialog */}
      {showMenuDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowMenuDialog(false)}>
          <div className="bg-card rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-black text-base">{editingItem ? 'Urun Duzenle' : 'Yeni Urun Ekle'}</h3>
              <button onClick={() => setShowMenuDialog(false)} className="p-2 rounded-lg hover:bg-muted pos-btn">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Urun Adi *</label>
                <input value={menuForm.name} onChange={e => setMenuForm(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-3 rounded-xl border bg-card text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Aciklama</label>
                <input value={menuForm.description} onChange={e => setMenuForm(p => ({ ...p, description: e.target.value }))} className="w-full px-4 py-3 rounded-xl border bg-card text-sm mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Fiyat (TL) *</label>
                  <input type="number" value={menuForm.price} onChange={e => setMenuForm(p => ({ ...p, price: e.target.value }))} className="w-full px-4 py-3 rounded-xl border bg-card text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase">Kategori</label>
                  <select value={menuForm.categoryId} onChange={e => setMenuForm(p => ({ ...p, categoryId: e.target.value }))} className="w-full px-4 py-3 rounded-xl border bg-card text-sm mt-1">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Porsiyon Bilgisi</label>
                <input value={menuForm.portionInfo} onChange={e => setMenuForm(p => ({ ...p, portionInfo: e.target.value }))} placeholder="or: 200g, 2 kisilik" className="w-full px-4 py-3 rounded-xl border bg-card text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Alerjen Bilgisi</label>
                <input value={menuForm.allergenInfo} onChange={e => setMenuForm(p => ({ ...p, allergenInfo: e.target.value }))} placeholder="or: Gluten, Sut, Yumurta" className="w-full px-4 py-3 rounded-xl border bg-card text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Aci Seviyesi (0-5)</label>
                <input type="number" min="0" max="5" value={menuForm.spiceLevel} onChange={e => setMenuForm(p => ({ ...p, spiceLevel: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl border bg-card text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Mutfak Notu</label>
                <input value={menuForm.kitchenNote} onChange={e => setMenuForm(p => ({ ...p, kitchenNote: e.target.value }))} placeholder="or: Az pisirmek, extra sos" className="w-full px-4 py-3 rounded-xl border bg-card text-sm mt-1" />
              </div>
              {/* Modifier Groups */}
              {modifierGroups.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Modifier Grupları</label>
                  <div className="space-y-1.5">
                    {modifierGroups.map(g => {
                      const isChecked = menuModifierIds.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setMenuModifierIds(prev => isChecked ? prev.filter(id => id !== g.id) : [...prev, g.id])}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm pos-btn border-2 ${isChecked ? 'border-primary bg-primary/10 text-primary' : 'border-transparent bg-muted/50 hover:bg-muted'}`}
                        >
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isChecked ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                            {isChecked && <span className="text-primary-foreground text-[10px] font-black">✓</span>}
                          </span>
                          <span className="font-medium">{g.name}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{g.type === 'radio' ? 'Tekli' : 'Çoklu'} · {g.options.length} seçenek</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex gap-2">
              <button onClick={() => setShowMenuDialog(false)} className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm pos-btn">Iptal</button>
              <button onClick={handleSaveMenuItem} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm pos-btn shadow-lg">{editingItem ? 'Guncelle' : 'Ekle'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Dialog */}
      {showStaffDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowStaffDialog(false)}>
          <div className="bg-card rounded-2xl w-full max-w-sm mx-4 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-black text-base">Yeni Personel</h3>
              <button onClick={() => setShowStaffDialog(false)} className="p-2 rounded-lg hover:bg-muted pos-btn">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Ad Soyad *</label>
                <input value={staffForm.name} onChange={e => setStaffForm(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-3 rounded-xl border bg-card text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Rol</label>
                <select value={staffForm.role} onChange={e => setStaffForm(p => ({ ...p, role: e.target.value }))} className="w-full px-4 py-3 rounded-xl border bg-card text-sm mt-1">
                  <option value="garson">Garson</option>
                  <option value="mutfak">Mutfak</option>
                  <option value="cashier">Kasa</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">PIN Kodu *</label>
                <input type="text" maxLength={6} value={staffForm.pin} onChange={e => setStaffForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))} placeholder="4-6 haneli" className="w-full px-4 py-3 rounded-xl border bg-card text-sm mt-1 font-mono tracking-widest" />
              </div>
            </div>
            <div className="p-4 border-t flex gap-2">
              <button onClick={() => setShowStaffDialog(false)} className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm pos-btn">Iptal</button>
              <button onClick={handleAddStaff} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm pos-btn shadow-lg">Ekle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
