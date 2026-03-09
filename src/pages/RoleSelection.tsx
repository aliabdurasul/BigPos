import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '@/context/POSContext';
import { LogIn, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const rolePaths: Record<string, string> = {
  garson: '/garson',
  mutfak: '/mutfak',
  restoran_admin: '/admin',
  super_admin: '/super-admin',
};

const roleColors: Record<string, string> = {
  garson: 'from-primary/20 to-primary/5',
  mutfak: 'from-pos-warning/20 to-pos-warning/5',
  restoran_admin: 'from-pos-info/20 to-pos-info/5',
  super_admin: 'from-pos-danger/20 to-pos-danger/5',
};

export default function RoleSelection() {
  const { role, loginWithPin, logout, staffName } = usePOS();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  // Restore session: if already logged in, redirect
  useEffect(() => {
    if (role && rolePaths[role]) {
      navigate(rolePaths[role]);
    }
  }, [role, navigate]);

  const handlePinLogin = async () => {
    if (pin.length < 4) {
      toast.error('PIN en az 4 haneli olmalıdır');
      return;
    }
    setLoading(true);
    const staff = await loginWithPin(pin);
    setLoading(false);
    if (staff) {
      toast.success(`Hoş geldiniz, ${staff.name}!`);
      const path = rolePaths[staff.role] || '/';
      navigate(path);
    } else {
      toast.error('Geçersiz PIN kodu');
      setPin('');
    }
  };

  const handleNumPad = (digit: string) => {
    if (pin.length < 6) setPin(prev => prev + digit);
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tight mb-2">Lezzet-i Ala POS</h1>
        <p className="text-muted-foreground text-lg">PIN kodunuzu girerek giriş yapın</p>
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
              {pin.length > i ? '●' : ''}
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
                  ←
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
          Giriş Yap
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-4">Varsayılan PIN: Admin 1234 | Garson 1111 | Mutfak 2222</p>
    </div>
  );
}
