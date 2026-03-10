import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { LogIn, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const rolePaths: Record<string, string> = {
  garson: '/garson',
  mutfak: '/mutfak',
  manager: '/garson',
  restoran_admin: '/admin',
};

export default function StaffLogin() {
  const { slug } = useParams<{ slug: string }>();
  const { session, loginWithPin, loading } = useAuth();
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [noStaff, setNoStaff] = useState(false);
  const [resolving, setResolving] = useState(true);
  const [pin, setPin] = useState('');

  // Auto-redirect if already logged in
  useEffect(() => {
    if (session) {
      const path = rolePaths[session.role] || '/';
      navigate(path, { replace: true });
    }
  }, [session, navigate]);

  // Resolve restaurant slug
  useEffect(() => {
    if (!slug) { setNotFound(true); setResolving(false); return; }

    (async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('slug', decodeURIComponent(slug).toLowerCase().trim())
        .eq('active', true)
        .limit(1);

      if (error || !data || data.length === 0) {
        setNotFound(true);
        setResolving(false);
        return;
      }

      const r = data[0] as { id: string; name: string };
      setRestaurant(r);
      setResolving(false);
    })();
  }, [slug]);

  const handlePinLogin = async () => {
    if (!restaurant || pin.length < 4) return;

    const result = await loginWithPin(pin, restaurant.id);
    if (result.success) {
      const raw = localStorage.getItem('auth_session');
      if (raw) {
        const s = JSON.parse(raw);
        toast.success(`Hos geldiniz, ${s.name}!`);
        navigate(rolePaths[s.role] || '/');
      }
    } else if (result.error === 'no_staff') {
      setNoStaff(true);
    } else {
      toast.error(result.error);
      setPin('');
    }
  };

  const handleNumPad = (digit: string) => {
    if (pin.length < 6) setPin(prev => prev + digit);
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  // ── Loading state ──
  if (resolving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Restoran yukleniyor...</p>
        </div>
      </div>
    );
  }

  // ── Restaurant not found ──
  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-background">
        <h1 className="text-2xl font-black">Restoran bulunamadi</h1>
        <p className="text-muted-foreground">Girdiginiz adres gecerli bir restorana ait degil.</p>
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-primary font-semibold">
          <ArrowLeft className="w-4 h-4" /> Ana Sayfa
        </button>
      </div>
    );
  }

  // ── No staff exist ──
  if (noStaff) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-background">
        <h1 className="text-2xl font-black">{restaurant?.name}</h1>
        <div className="bg-card border rounded-2xl p-6 max-w-sm text-center">
          <p className="text-muted-foreground">Personel hesabi bulunamadi.</p>
          <p className="text-muted-foreground mt-1">Lutfen yonetici ile iletisime gecin.</p>
        </div>
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-primary font-semibold">
          <ArrowLeft className="w-4 h-4" /> Ana Sayfa
        </button>
      </div>
    );
  }

  // ── PIN Login ──
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 bg-background">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight mb-1">{restaurant?.name}</h1>
        <p className="text-muted-foreground">PIN kodunuzu girerek giris yapin</p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        {/* PIN Display */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all ${
                pin.length > i ? 'border-primary bg-primary/10 text-primary' : 'border-muted bg-card'
              }`}
            >
              {pin.length > i ? '\u25CF' : ''}
            </div>
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key) => {
            if (key === '') return <div key="empty" />;
            if (key === 'back') {
              return (
                <button
                  key="back"
                  onClick={handleBackspace}
                  className="h-16 rounded-2xl bg-muted font-bold text-lg pos-btn flex items-center justify-center"
                >
                  &#8592;
                </button>
              );
            }
            return (
              <button
                key={key}
                onClick={() => handleNumPad(key)}
                className="h-16 rounded-2xl bg-card border font-bold text-xl pos-btn hover:bg-muted transition-colors"
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* Login Button */}
        <button
          onClick={handlePinLogin}
          disabled={pin.length < 4 || loading}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-lg flex items-center justify-center gap-2 pos-btn disabled:opacity-40 shadow-lg shadow-primary/20"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
          Giris Yap
        </button>
      </div>

      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Ana Sayfa
      </button>
    </div>
  );
}
