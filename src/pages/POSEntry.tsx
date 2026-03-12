import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, Shield, Store } from 'lucide-react';

function getRolePath(slug: string, role: string): string {
  switch (role) {
    case 'garson':
    case 'manager':
      return `/pos/${slug}/tables`;
    case 'mutfak':
      return `/pos/${slug}/kitchen`;
    case 'cashier':
      return `/pos/${slug}/cashier`;
    case 'restoran_admin':
      return `/pos/${slug}/dashboard`;
    case 'super_admin':
      return '/admin/dashboard';
    default:
      return '/pos';
  }
}

export default function POSEntry() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');

  // Auto-redirect if already logged in (must be in useEffect, not during render)
  useEffect(() => {
    if (!session) return;
    const s = session.type === 'staff' ? session.slug : (session.slug || '');
    if (s) {
      navigate(getRolePath(s, session.role), { replace: true });
    } else if (session.role === 'super_admin') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [session, navigate]);

  const handleGo = () => {
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (clean) navigate(`/pos/${encodeURIComponent(clean)}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 p-6 bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tight mb-2">Lezzet-i Ala POS</h1>
        <p className="text-muted-foreground">Restoran yonetim sistemi</p>
      </div>

      {/* Slug input */}
      <div className="w-full max-w-sm space-y-3">
        <label className="text-sm font-semibold flex items-center gap-2">
          <Store className="w-4 h-4" /> Restoran Kodu
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleGo()}
            placeholder="ornek-restoran"
            className="flex-1 px-4 py-3 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleGo}
            disabled={!slug.trim()}
            className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2 pos-btn disabled:opacity-40 shadow-lg shadow-primary/20"
          >
            <ArrowRight className="w-4 h-4" /> Git
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Restoran yoneticinizden aldiginiz kodu girin</p>
      </div>

      {/* Admin link */}
      <button
        onClick={() => navigate('/admin/login')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Shield className="w-4 h-4" /> Yonetici Girisi
      </button>
    </div>
  );
}
