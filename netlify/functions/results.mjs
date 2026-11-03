// GET /api/results?month=2026-11  — current tallies for a poll (index -> votes).
// Reads from Supabase (public.poll_tallies) with the service-role key. Replaces
// the former Netlify Blobs store (S6). Response contract unchanged.
import { createClient } from '@supabase/supabase-js';

const MONTH_RE = /^\d{4}-\d{2}$/;

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

export default async (req) => {
  const month = new URL(req.url).searchParams.get('month') || '';
  if (!MONTH_RE.test(month)) return json({ error: 'bad_month' }, { status: 400 });
  if (!supabase) return json({ error: 'not_configured' }, { status: 500 });

  const { data, error } = await supabase
    .from('poll_tallies')
    .select('tallies')
    .eq('month', month)
    .maybeSingle();
  if (error) return json({ error: 'read_failed' }, { status: 500 });

  return json({ month, tallies: data?.tallies || {} });
};

export const config = { path: '/api/results' };
