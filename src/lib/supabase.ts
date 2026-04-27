import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// ─── Session token — set after login, read by the custom fetch wrapper ───────
// The DB pre-request hook reads the x-session-token header and sets
// app.current_restaurant_id so RLS tenant-isolation policies apply.

let _sessionToken: string | null = null;

export function setSessionToken(token: string | null): void {
  _sessionToken = token;
}

export function getSessionToken(): string | null {
  return _sessionToken;
}

// ─── Supabase client with dynamic session header injection ───────────────────

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
      global: {
        fetch: (input, init = {}) => {
          if (_sessionToken) {
            const headers = new Headers(init.headers);
            headers.set('x-session-token', _sessionToken);
            return fetch(input, { ...init, headers });
          }
          return fetch(input, init);
        },
      },
    })
  : (null as unknown as SupabaseClient);
