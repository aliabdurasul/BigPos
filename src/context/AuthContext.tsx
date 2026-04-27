import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { AuthSession, Staff } from '@/types/pos';

// ─── Session Persistence ───────────────────────
const AUTH_KEY = 'auth_session';

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore corrupt data */ }
  return null;
}

function saveSession(session: AuthSession) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

function clearSessionStorage() {
  localStorage.removeItem(AUTH_KEY);
}

// ─── Types ─────────────────────────────────────

type LoginResult = { success: true } | { success: false; error: string };

interface AuthContextType {
  session: AuthSession | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<LoginResult>;
  loginWithPin: (pin: string, restaurantId: string, slug: string) => Promise<LoginResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ─────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(loadSession);
  const [loading, setLoading] = useState(false);

  // ── Email / Password Login ─────────────────

  const loginWithEmail = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('verify_platform_login', {
        p_email: email,
        p_password: password,
      });

      if (error) {
        const message = error.message?.includes('verify_platform_login')
          ? 'Sistem kurulumu eksik: verify_platform_login fonksiyonu bulunamadi.'
          : `Giris hatasi: ${error.message}`;
        return { success: false, error: message };
      }

      const rows = data as { id: string; email: string; name: string; role: string; restaurant_id: string | null; active: boolean }[];

      if (!rows || rows.length === 0) {
        return { success: false, error: 'Geçersiz email veya şifre' };
      }

      const user = rows[0];

      if (!user.active) {
        return { success: false, error: 'Hesap aktif değil' };
      }

      // Resolve slug for restoran_admin
      let slug: string | undefined;
      if (user.role === 'restoran_admin' && user.restaurant_id) {
        const { data: rData } = await supabase
          .from('restaurants')
          .select('slug')
          .eq('id', user.restaurant_id)
          .limit(1);
        if (rData && rData.length > 0) slug = rData[0].slug;
      }

      const newSession: AuthSession = {
        type: 'admin',
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'super_admin' | 'restoran_admin',
        restaurantId: user.restaurant_id,
        slug,
      };

      setSession(newSession);
      saveSession(newSession);
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── PIN Login ──────────────────────────────

  const loginWithPin = useCallback(async (pin: string, restaurantId: string, slug: string): Promise<LoginResult> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('verify_staff_pin', {
        p_pin: pin,
        p_restaurant_id: restaurantId,
      });

      if (error) {
        const message = error.message?.includes('verify_staff_pin')
          ? 'Sistem kurulumu eksik: verify_staff_pin fonksiyonu bulunamadi.'
          : `Giris hatasi: ${error.message}`;
        return { success: false, error: message };
      }

      const rows = data as { id: string; name: string; role: string; restaurant_id: string; active: boolean }[];

      if (!rows || rows.length === 0) {
        return { success: false, error: 'Geçersiz PIN' };
      }

      const staff = rows[0];

      const newSession: AuthSession = {
        type: 'staff',
        staffId: staff.id,
        name: staff.name,
        role: staff.role as 'garson' | 'mutfak' | 'manager' | 'cashier',
        restaurantId,
        slug,
      };

      setSession(newSession);
      saveSession(newSession);
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Logout ─────────────────────────────────

  const logout = useCallback(() => {
    setSession(null);
    clearSessionStorage();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, loginWithEmail, loginWithPin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ─── Route Guard Component ─────────────────────

export function ProtectedRoute({ allowedRoles, children }: { allowedRoles: string[]; children: React.ReactNode }) {
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) {
      navigate('/pos', { replace: true });
    } else if (!allowedRoles.includes(session.role)) {
      navigate('/pos', { replace: true });
    }
  }, [session, allowedRoles, navigate]);

  if (!session || !allowedRoles.includes(session.role)) {
    return null;
  }

  return <>{children}</>;
}
