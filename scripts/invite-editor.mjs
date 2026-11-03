// EBNEO CMS — invite an editor (plan S3)
//
// Invite-only passwordless onboarding. Creates (or finds) the Supabase Auth user,
// emails them a magic link, and records them in public.editors with a role so RLS
// lets them in. Run by an admin from a trusted shell (service-role key required).
//
// Usage (Node 22):
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   [SITE_URL=https://ebneo-poc.netlify.app] \
//   node scripts/invite-editor.mjs <email> [editor|admin]
//
// Note: the project's built-in email has a low hourly rate limit on the free tier.
// For production volume, configure custom SMTP (see SUPABASE-SETUP.md / S7).

import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
const role = (process.argv[3] || 'editor').toLowerCase();

if (!email || !/.+@.+\..+/.test(email)) {
  console.error('Usage: node scripts/invite-editor.mjs <email> [editor|admin]');
  process.exit(1);
}
if (!['editor', 'admin'].includes(role)) {
  console.error(`Invalid role "${role}" — use editor or admin.`);
  process.exit(1);
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const SITE_URL = process.env.SITE_URL || 'https://ebneo-poc.netlify.app';
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function findUserByEmail(addr) {
  // listUsers is paginated; scan until found (editor counts are tiny).
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === addr.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  let userId;

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${SITE_URL}/studio`,
  });

  if (error) {
    // Already registered: find them and (re)grant the role. We do not auto-resend
    // here; an existing editor just logs in from /studio (magic link on demand).
    const existing = await findUserByEmail(email);
    if (!existing) {
      console.error('Invite failed and user not found:', error.message);
      process.exit(1);
    }
    userId = existing.id;
    console.log(`User already existed (${email}); updating role to ${role}.`);
  } else {
    userId = data.user.id;
    console.log(`Invited ${email}; magic-link email sent.`);
  }

  const { error: upErr } = await supabase
    .from('editors')
    .upsert({ id: userId, email, role }, { onConflict: 'id' });
  if (upErr) {
    console.error('Failed to upsert editors row:', upErr.message);
    process.exit(1);
  }

  console.log(`editors row set: ${email} -> ${role}. They log in at ${SITE_URL}/studio.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
