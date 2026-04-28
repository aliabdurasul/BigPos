import { corsHeaders, adminClient, json } from '../_shared/auth.ts';

/**
 * POST /functions/v1/register-agent
 *
 * No session required — called by the agent installer with the one-time install token.
 * Body: { token: string, hostname?: string, local_ip?: string, version?: string }
 * Returns: { agent_id, agent_token (plaintext — store securely), restaurant_id }
 *
 * The plaintext agent_token is NEVER stored in DB.
 * If you lose it, generate a new install token and re-register.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: {
    token?: string;
    hostname?: string;
    local_ip?: string;
    version?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.token) return json({ error: 'token is required' }, 400);

  const db = adminClient();
  const { data, error } = await db.rpc('register_agent_with_token', {
    p_token:    body.token,
    p_hostname: body.hostname ?? null,
    p_local_ip: body.local_ip ?? null,
    p_version:  body.version  ?? null,
  });

  if (error) return json({ error: error.message }, 500);
  if (data?.error) return json({ error: data.error }, 400);

  return json(data);
});
