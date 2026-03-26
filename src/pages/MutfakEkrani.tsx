import { useAuth } from '@/context/AuthContext';
import { LogOut, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MutfakEkrani() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    const s = JSON.parse(localStorage.getItem('auth_session') || '{}');
    logout();
    navigate(`/pos/${s.slug || ''}`);
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
      <Printer className="w-16 h-16 text-muted-foreground mb-6" />
      <h1 className="text-2xl font-bold mb-2">Mutfak Ekranı Kaldırıldı</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        Siparişler artık yazıcıdan takip edilmektedir. Mutfak ekranı devre dışı bırakılmıştır.
      </p>
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-bold pos-btn"
      >
        <LogOut className="w-5 h-5" /> Çıkış Yap
      </button>
    </div>
  );
}
