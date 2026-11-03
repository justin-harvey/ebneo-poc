// EBNEO CMS — RLS verification (plan S3 acceptance; reused in S7 security pass)
//
// Proves the Row Level Security posture end-to-end against the live project:
//   1. anon key cannot read commentaries (and cannot write).
//   2. an INVITED editor (row in public.editors) can read and write commentaries.
//   3. a NON-invited authenticated user is blocked (invite-only is enforced in the
//      database, not just by the disabled-signup setting).
//
// Creates two throwaway auth users (via the admin API, with temporary passwords so
// the script can obtain a JWT without email round-trips) and deletes them at the end.
//
// Usage (Node 22):
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/verify-rls.mjs

import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Need SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const pass = (m) => console.log(`  PASS  ${m}`);
let failures = 0;
const fail = (m) => { console.log(`  FAIL  ${m}`); failures++; };

const stamp = Date.now();
const editorEmail = `rls-editor-${stamp}@example.com`;
const outsiderEmail = `rls-outsider-${stamp}@example.com`;
const tmpPass = `Rls!${stamp}aA`;
const createdUserIds = [];

async function makeUser(email) {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: tmpPass, email_confirm: true,
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);
  return data.user.id;
}

async function authedClient(email) {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: tmpPass });
  if (error) throw error;
  return c;
}

async function main() {
  console.log('--- 1. anon (unauthenticated) ---');
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  {
    const { data, error } = await anon.from('commentaries').select('slug').limit(1);
    if (error) pass(`anon read blocked (error: ${error.code || error.message})`);
    else if (!data || data.length === 0) pass('anon read returns 0 rows (RLS hides all)');
    else fail(`anon read returned ${data.length} row(s) — LEAK`);
  }
  {
    const { error } = await anon.from('commentaries')
      .insert({ slug: `anon-${stamp}`, title: 'x' });
    if (error) pass(`anon write blocked (${error.code || error.message})`);
    else fail('anon insert SUCCEEDED — LEAK');
  }

  console.log('--- 2. invited editor ---');
  const editorId = await makeUser(editorEmail);
  await admin.from('editors').upsert({ id: editorId, email: editorEmail, role: 'editor' });
  const ed = await authedClient(editorEmail);
  {
    const { data, error } = await ed.from('commentaries').select('slug').limit(5);
    if (error) fail(`editor read blocked (${error.message})`);
    else if (data && data.length > 0) pass(`editor read works (${data.length} rows visible)`);
    else fail('editor read returned 0 rows');
  }
  const draftSlug = `rls-draft-${stamp}`;
  {
    const { error } = await ed.from('commentaries')
      .insert({ slug: draftSlug, title: 'RLS test draft', status: 'draft' });
    if (error) fail(`editor insert blocked (${error.message})`);
    else pass('editor insert works');
  }

  console.log('--- 3. non-invited authenticated user ---');
  await makeUser(outsiderEmail); // deliberately NO editors row
  const out = await authedClient(outsiderEmail);
  {
    const { data, error } = await out.from('commentaries').select('slug').limit(1);
    if (error) pass(`outsider read blocked (${error.code || error.message})`);
    else if (!data || data.length === 0) pass('outsider read returns 0 rows (not an editor)');
    else fail(`outsider read returned ${data.length} row(s) — LEAK`);
  }
  {
    const { error } = await out.from('commentaries')
      .insert({ slug: `out-${stamp}`, title: 'x' });
    if (error) pass(`outsider write blocked (${error.code || error.message})`);
    else fail('outsider insert SUCCEEDED — LEAK');
  }

  // cleanup: remove test draft + editor rows + auth users
  await admin.from('commentaries').delete().eq('slug', draftSlug);
  await admin.from('editors').delete().eq('id', editorId);
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);

  console.log(`\n${failures === 0 ? 'ALL RLS CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('Error:', e.message);
  // best-effort cleanup
  for (const id of createdUserIds) { try { await admin.auth.admin.deleteUser(id); } catch {} }
  process.exit(1);
});
