import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, LogIn, Loader2, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLogin() {
  const { session, loginWithEmail, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Auto-redirect if already logged in as admin
  if (session?.type === 'admin') {
    const path = session.role === 'super_admin' ? '/admin/dashboard' : `/pos/${session.slug}/dashboard`;
    navigate(path, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Email ve şifre gereklidir');
      return;
    }
    const result = await loginWithEmail(email, password);
    if (result.success) {
      // loginWithEmail sets session — read it fresh from context won't work inline,
      // but we can extract role from the RPC result pattern:
      // The auth context already set the session, so we navigate based on stored session.
      // Re-read from localStorage since state update is async.
      const raw = localStorage.getItem('auth_session');
      if (raw) {
        const s = JSON.parse(raw);
        const path = s.role === 'super_admin' ? '/admin/dashboard' : `/pos/${s.slug}/dashboard`;
        toast.success(`Hoş geldiniz, ${s.name}!`);
        navigate(path);
      }
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Lezzet-i Ala POS</h1>
        <p className="text-muted-foreground text-lg">Yonetici Girisi</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="email">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ornek@mail.com"
              className="w-full pl-10 pr-4 py-3 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="password">Sifre</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="********"
              className="w-full pl-10 pr-4 py-3 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full py-3.5 rounded-md bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 pos-btn disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
          Giris Yap
        </button>
      </form>

      <button
        onClick={() => navigate('/pos')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Geri
      </button>
    </div>
  );
}
