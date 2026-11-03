// POST /api/vote  — record one vote for an option in a monthly poll.
// Tallies live in Supabase (public.poll_tallies), written with the service-role
// key (server-side only, same key the build uses). One vote per browser per month
// via a cookie — this matches the current site's no-login behavior and is
// intentionally not fraud-proof. Body: { month: "2026-11", option: 0 }.
//
// Replaces the former Netlify Blobs store (S6 consolidation onto Supabase). The
// public request/response contract and the cookie dedupe are unchanged, so the
// /vote page front-end is untouched.
import { createClient } from '@supabase/supabase-js';

const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_OPTIONS = 10; // guardrail; real ballots are 2–4 options

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
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });
  if (!supabase) return json({ error: 'not_configured' }, { status: 500 });

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad_json' }, { status: 400 });
  }

  const month = String(payload?.month ?? '');
  const option = Number(payload?.option);
  if (!MONTH_RE.test(month)) return json({ error: 'bad_month' }, { status: 400 });
  if (!Number.isInteger(option) || option < 0 || option >= MAX_OPTIONS)
    return json({ error: 'bad_option' }, { status: 400 });

  // Current tallies for the month ({} if none yet).
  const { data: existing, error: readErr } = await supabase
    .from('poll_tallies')
    .select('tallies')
    .eq('month', month)
    .maybeSingle();
  if (readErr) return json({ error: 'read_failed' }, { status: 500 });
  const tallies = existing?.tallies || {};

  // Already voted this month from this browser? Return current tallies, don't double-count.
  const voteCookie = `ebneo_voted_${month}`;
  const cookie = req.headers.get('cookie') || '';
  const already = cookie
    .split(';')
    .some((c) => c.trim().startsWith(`${voteCookie}=`));
  if (already) return json({ already: true, tallies });

  const key = String(option);
  tallies[key] = (tallies[key] || 0) + 1;

  const { error: writeErr } = await supabase
    .from('poll_tallies')
    .upsert({ month, tallies }, { onConflict: 'month' });
  if (writeErr) return json({ error: 'write_failed' }, { status: 500 });

  // 180-day cookie, SameSite=Lax, Secure (Netlify serves HTTPS).
  const setCookie = `${voteCookie}=1; Path=/; Max-Age=15552000; SameSite=Lax; Secure`;
  return json({ ok: true, tallies }, { headers: { 'set-cookie': setCookie } });
};

export const config = { path: '/api/vote' };
