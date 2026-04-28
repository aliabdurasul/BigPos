import { corsHeaders, adminClient, json, validateSession } from '../_shared/auth.ts';

/**
 * POST /functions/v1/create-install-token
 *
 * Requires:  x-session-token header (restoran_admin or super_admin role)
 * Returns:   { token: string (plaintext, show ONCE), hint: string (last 6 chars) }
 *
 * The plaintext token is NEVER stored — only SHA-256 hash goes to DB.
 * Expires in 24 h. One-time use.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const session = await validateSession(req);
  if (!session) return json({ error: 'Unauthorized' }, 401);
  if (!['super_admin', 'restoran_admin'].includes(session.role)) {
    return json({ error: 'Forbidden: insufficient role' }, 403);
  }

  // Generate 32 cryptographically random bytes → hex token
  const rawBytes = crypto.getRandomValues(new Uint8Array(32));
  const rawToken = Array.from(rawBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // SHA-256 hash — stored in DB (never the plaintext)
  const msgBuf  = new TextEncoder().encode(rawToken);
  const hashBuf = await crypto.subtle.digest('SHA-256', msgBuf);
  const tokenHash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const db = adminClient();
  const { error } = await db.from('agent_install_tokens').insert({
    restaurant_id: session.restaurantId,
    token_hash:    tokenHash,
    token_hint:    rawToken.slice(-6),
    status:        'pending',
    expires_at:    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  if (error) return json({ error: error.message }, 500);

  return json({ token: rawToken, hint: rawToken.slice(-6) });
});
