// GET /api/results?month=2026-11  — current tallies for a poll (index -> votes).
import { getStore } from '@netlify/blobs';

const MONTH_RE = /^\d{4}-\d{2}$/;

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });

export default async (req) => {
  const month = new URL(req.url).searchParams.get('month') || '';
  if (!MONTH_RE.test(month)) return json({ error: 'bad_month' }, { status: 400 });

  const store = getStore('ebneo-polls');
  const tallies = (await store.get(month, { type: 'json' })) || {};
  return json({ month, tallies });
};

export const config = { path: '/api/results' };
