import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Shield, Monitor, ArrowRight, Loader2, Store } from 'lucide-react';

const rolePaths: Record<string, string> = {
  super_admin: '/super-admin',
  restoran_admin: '/admin',
  garson: '/garson',
  mutfak: '/mutfak',
  manager: '/garson',
};

interface RestaurantOption {
  id: string;
  name: string;
  slug: string;
}

export default function RoleSelection() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (session) {
      const path = rolePaths[session.role] || '/';
      navigate(path, { replace: true });
    }
  }, [session, navigate]);

  // Fetch available restaurants
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, slug')
        .eq('active', true)
        .order('name');
      setRestaurants((data as RestaurantOption[]) || []);
      setLoadingRestaurants(false);
    })();
  }, []);

  const handlePOSEntry = () => {
    const trimmed = slug.trim().toLowerCase();
    if (!trimmed) return;
    navigate(`/pos/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 p-6 bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Lezzet-i Ala POS</h1>
        <p className="text-muted-foreground text-lg">Giris turunu secin</p>
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* Admin Login */}
        <button
          onClick={() => navigate('/login')}
          className="w-full flex items-center gap-4 p-5 rounded-lg border bg-card hover:bg-muted transition-colors active:scale-[0.98]"
        >
          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <div className="text-left flex-1">
            <p className="font-bold text-lg">Yonetici Girisi</p>
            <p className="text-sm text-muted-foreground">Super Admin veya Restoran Yoneticisi</p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* POS Staff Login */}
        <div className="p-5 rounded-lg border bg-card space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Monitor className="w-7 h-7 text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-lg">POS Girisi</p>
              <p className="text-sm text-muted-foreground">Personel PIN ile giris</p>
            </div>
          </div>

          {/* Restaurant list */}
          {loadingRestaurants ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : restaurants.length > 0 ? (
            <div className="space-y-2">
              {restaurants.map(r => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/pos/${encodeURIComponent(r.slug)}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-md border bg-background hover:bg-muted transition-colors text-left active:scale-[0.98]"
                >
                  <Store className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">/{r.slug}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">Henuz kayitli restoran yok</p>
          )}

          {/* Manual slug entry */}
          <div className="flex gap-2 pt-1 border-t">
            <input
              value={slug}
              onChange={e => setSlug(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePOSEntry()}
              placeholder="veya restoran kodu yazin..."
              className="flex-1 px-4 py-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handlePOSEntry}
              disabled={!slug.trim()}
              className="px-5 py-3 rounded-md bg-primary text-primary-foreground font-bold text-sm pos-btn disabled:opacity-40 flex items-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" /> Git
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
