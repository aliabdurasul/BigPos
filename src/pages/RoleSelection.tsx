import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Shield, Monitor, ArrowRight } from 'lucide-react';

const rolePaths: Record<string, string> = {
  super_admin: '/super-admin',
  restoran_admin: '/admin',
  garson: '/garson',
  mutfak: '/mutfak',
  manager: '/garson',
};

export default function RoleSelection() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');

  // Auto-redirect if already logged in
  useEffect(() => {
    if (session) {
      const path = rolePaths[session.role] || '/';
      navigate(path, { replace: true });
    }
  }, [session, navigate]);

  const handlePOSEntry = () => {
    const trimmed = slug.trim().toLowerCase();
    if (!trimmed) return;
    navigate(`/pos/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 p-6 bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tight mb-2">Lezzet-i Ala POS</h1>
        <p className="text-muted-foreground text-lg">Giris turunu secin</p>
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* Admin Login */}
        <button
          onClick={() => navigate('/login')}
          className="w-full flex items-center gap-4 p-5 rounded-2xl border bg-card hover:bg-muted transition-colors active:scale-[0.98]"
        >
          <div className="w-14 h-14 rounded-xl bg-pos-info/10 flex items-center justify-center shrink-0">
            <Shield className="w-7 h-7 text-pos-info" />
          </div>
          <div className="text-left flex-1">
            <p className="font-bold text-lg">Yonetici Girisi</p>
            <p className="text-sm text-muted-foreground">Super Admin veya Restoran Yoneticisi</p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* POS Staff Login */}
        <div className="p-5 rounded-2xl border bg-card space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Monitor className="w-7 h-7 text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-lg">POS Girisi</p>
              <p className="text-sm text-muted-foreground">Personel PIN ile giris</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={slug}
              onChange={e => setSlug(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePOSEntry()}
              placeholder="Restoran kodu (orn: lezzet-i-ala)"
              className="flex-1 px-4 py-3 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handlePOSEntry}
              disabled={!slug.trim()}
              className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm pos-btn disabled:opacity-40 flex items-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" /> Git
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
