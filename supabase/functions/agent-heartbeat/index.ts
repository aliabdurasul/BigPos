import { corsHeaders, adminClient, json, validateAgentToken } from '../_shared/auth.ts';

/**
 * GET | POST /functions/v1/agent-heartbeat
 *
 * Requires: x-agent-token header
 * Body (optional, POST): { hostname?, local_ip?, version? }
 * Returns:  { ok: true, commands: AgentCommand[] }
 *
 * Agent should call this every 30 s to:
 *  1. Update last_seen_at + metadata in restaurant_agents
 *  2. Receive any pending agent_commands (e.g., reload-printers, restart)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const agent = await validateAgentToken(req);
  if (!agent) return json({ error: 'Unauthorized' }, 401);

  // Optional body with metadata update
  let body: { hostname?: string; local_ip?: string; version?: string } = {};
  if (req.method === 'POST') {
    try {
      body = await req.json();
    } catch {
      // body is optional — ignore parse errors
    }
  }

  const db = adminClient();

  await db.rpc('agent_heartbeat_update', {
    p_agent_id: agent.agentId,
    p_hostname: body.hostname ?? null,
    p_local_ip: body.local_ip ?? null,
    p_version:  body.version  ?? null,
  });

  // Return any pending commands for this agent
  const { data: commands } = await db
    .from('agent_commands')
    .select('id, command, payload')
    .eq('agent_id', agent.agentId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return json({ ok: true, commands: commands ?? [] });
});
