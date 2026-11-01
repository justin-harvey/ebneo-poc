// POST /api/vote  — record one vote for an option in a monthly poll.
// Tallies live in Netlify Blobs (KV, same account, $0). One vote per browser per month
// via a cookie — this matches the current site's no-login behavior and is intentionally
// not fraud-proof. Body: { month: "2026-11", option: 0 }.
import { getStore } from '@netlify/blobs';

const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_OPTIONS = 10; // guardrail; real ballots are 2–4 options

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

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

  const store = getStore('ebneo-polls');
  const tallies = (await store.get(month, { type: 'json' })) || {};

  // Already voted this month from this browser? Return current tallies, don't double-count.
  const voteCookie = `ebneo_voted_${month}`;
  const cookie = req.headers.get('cookie') || '';
  const already = cookie
    .split(';')
    .some((c) => c.trim().startsWith(`${voteCookie}=`));
  if (already) return json({ already: true, tallies });

  tallies[option] = (tallies[option] || 0) + 1;
  await store.setJSON(month, tallies);

  // 180-day cookie, SameSite=Lax, Secure (Netlify serves HTTPS).
  const setCookie = `${voteCookie}=1; Path=/; Max-Age=15552000; SameSite=Lax; Secure`;
  return json({ ok: true, tallies }, { headers: { 'set-cookie': setCookie } });
};

export const config = { path: '/api/vote' };
