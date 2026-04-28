import { corsHeaders, adminClient, json, validateAgentToken } from '../_shared/auth.ts';

/**
 * GET /functions/v1/agent-poll-jobs
 *
 * Requires: x-agent-token header
 * Returns:  { jobs: PrintJob[] }
 *
 * Atomically:
 *   1. Fetches up to 20 pending jobs for this restaurant
 *   2. Claims them (sets status = 'printing', claimed_at = now())
 *
 * If no jobs are pending, returns { jobs: [] } immediately.
 * Agent should poll every 1–5 seconds while active.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const agent = await validateAgentToken(req);
  if (!agent) return json({ error: 'Unauthorized' }, 401);

  const db = adminClient();

  // Step 1: Get pending jobs for this tenant
  const { data: jobs, error: fetchError } = await db.rpc('get_pending_print_jobs', {
    p_restaurant_id: agent.restaurantId,
    p_limit:         20,
  });

  if (fetchError) return json({ error: fetchError.message }, 500);
  if (!jobs?.length) return json({ jobs: [] });

  // Step 2: Claim them atomically
  const jobIds = (jobs as { id: string }[]).map((j) => j.id);
  const { data: claimed, error: claimError } = await db.rpc('claim_print_jobs', {
    p_job_ids: jobIds,
  });

  if (claimError) return json({ error: claimError.message }, 500);

  return json({ jobs: claimed ?? [] });
});
