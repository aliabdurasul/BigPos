import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-session-token, x-agent-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/** Supabase client using service_role — bypasses RLS. Used only server-side. */
export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Validate x-session-token header against active_sessions table.
 * Returns { restaurantId, role } or null if invalid / expired.
 */
export async function validateSession(
  req: Request,
): Promise<{ restaurantId: string; role: string } | null> {
  const token = req.headers.get('x-session-token');
  if (!token) return null;

  const db = adminClient();
  const { data } = await db
    .from('active_sessions')
    .select('restaurant_id, role, expires_at')
    .eq('id', token)
    .maybeSingle();

  if (!data?.restaurant_id) return null;

  // Check expiry if the column exists
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  return { restaurantId: data.restaurant_id, role: data.role };
}

/**
 * Validate x-agent-token header via verify_agent_token() SECURITY DEFINER RPC.
 * Returns { agentId, restaurantId } or null if invalid / revoked.
 */
export async function validateAgentToken(
  req: Request,
): Promise<{ agentId: string; restaurantId: string } | null> {
  const token = req.headers.get('x-agent-token');
  if (!token) return null;

  const db = adminClient();
  const { data, error } = await db.rpc('verify_agent_token', { p_token: token });

  if (error || !data?.length) return null;
  return { agentId: data[0].agent_id, restaurantId: data[0].restaurant_id };
}
