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
  loginWithPin: (pin: string, restaurantId: string) => Promise<LoginResult>;
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
        return { success: false, error: 'Bir hata oluştu. Tekrar deneyin.' };
      }

      const rows = data as { id: string; email: string; name: string; role: string; restaurant_id: string | null; active: boolean }[];

      if (!rows || rows.length === 0) {
        return { success: false, error: 'Geçersiz email veya şifre' };
      }

      const user = rows[0];

      if (!user.active) {
        return { success: false, error: 'Hesap aktif değil' };
      }

      const newSession: AuthSession = {
        type: 'admin',
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role as 'super_admin' | 'restoran_admin',
        restaurantId: user.restaurant_id,
      };

      setSession(newSession);
      saveSession(newSession);
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── PIN Login ──────────────────────────────

  const loginWithPin = useCallback(async (pin: string, restaurantId: string): Promise<LoginResult> => {
    setLoading(true);
    try {
      // Check if any active staff exist for this restaurant
      const { count } = await supabase
        .from('staff')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('active', true);

      if (count === 0) {
        return { success: false, error: 'no_staff' };
      }

      // Lookup by PIN
      const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('pin', pin)
        .limit(1);

      if (!data || data.length === 0) {
        return { success: false, error: 'Geçersiz PIN' };
      }

      const staff = data[0] as { id: string; name: string; role: string; active: boolean };

      if (!staff.active) {
        return { success: false, error: 'Hesap aktif değil' };
      }

      const newSession: AuthSession = {
        type: 'staff',
        staffId: staff.id,
        name: staff.name,
        role: staff.role as 'garson' | 'mutfak' | 'manager',
        restaurantId,
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
      navigate('/', { replace: true });
    } else if (!allowedRoles.includes(session.role)) {
      navigate('/', { replace: true });
    }
  }, [session, allowedRoles, navigate]);

  if (!session || !allowedRoles.includes(session.role)) {
    return null;
  }

  return <>{children}</>;
}
