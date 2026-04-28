import { corsHeaders, adminClient, json, validateAgentToken } from '../_shared/auth.ts';

/**
 * POST /functions/v1/agent-complete-job
 *
 * Requires: x-agent-token header
 * Body: { job_id: string, status: 'done' | 'failed', error?: string }
 * Returns: { ok: true }
 *
 * Verifies the job belongs to the agent's restaurant before updating.
 * Delegates retry/backoff logic to complete_print_job() SECURITY DEFINER RPC.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const agent = await validateAgentToken(req);
  if (!agent) return json({ error: 'Unauthorized' }, 401);

  let body: { job_id?: string; status?: 'done' | 'failed'; error?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.job_id)  return json({ error: 'job_id is required' }, 400);
  if (!body.status)  return json({ error: 'status is required' }, 400);
  if (!['done', 'failed'].includes(body.status)) {
    return json({ error: 'status must be "done" or "failed"' }, 400);
  }

  const db = adminClient();

  // Verify the job belongs to this agent's restaurant (tenant isolation)
  const { data: job } = await db
    .from('print_jobs')
    .select('restaurant_id')
    .eq('id', body.job_id)
    .maybeSingle();

  if (!job || job.restaurant_id !== agent.restaurantId) {
    return json({ error: 'Job not found' }, 404);
  }

  const { error } = await db.rpc('complete_print_job', {
    p_job_id: body.job_id,
    p_status: body.status,
    p_error:  body.error ?? null,
  });

  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});
