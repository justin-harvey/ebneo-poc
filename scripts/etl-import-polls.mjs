// EBNEO CMS — S6 one-time ETL: src/content/polls/*.md -> Supabase.
//
// Imports each monthly ballot into public.polls, keyed on `month` (idempotent
// upsert). Frozen `results` and the intro `body` are carried over so the build
// can reproduce the poll files byte-for-byte.
//
// Live vote tallies are NOT imported: the only tallies in the old Netlify Blobs
// store are throwaway test votes (per the handoff), and the launch step wipes
// them. poll_tallies starts empty; the first real vote creates its row.
//
// Usage (Node 22):
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/etl-import-polls.mjs [--dry-run]

import { createClient } from '@supabase/supabase-js';
import matter from 'gray-matter';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POLLS_DIR = join(__dirname, '..', 'src', 'content', 'polls');

const DRY = process.argv.includes('--dry-run');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DRY && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or pass --dry-run).');
  process.exit(1);
}

function toRow(parsed) {
  const d = parsed.data;
  // gray-matter strips the single blank line after the frontmatter; restore the
  // leading newline so body round-trips to `---\n...\n---\n\n<body>`.
  const body = parsed.content.replace(/^\n/, '');
  return {
    month: String(d.month),
    question: d.question ?? 'Which study is most likely to impact neonatal care?',
    status: d.status ?? 'open',
    options: (d.options || []).map((o) => ({
      title: o.title ?? '',
      authors: o.authors ?? '',
      journal: o.journal ?? '',
      date: o.date != null ? String(o.date) : '',
      url: o.url ?? '',
    })),
    results: d.results
      ? Object.fromEntries(Object.entries(d.results).map(([k, v]) => [String(k), Number(v)]))
      : null,
    body,
  };
}

async function main() {
  const files = (await readdir(POLLS_DIR)).filter((f) => f.endsWith('.md'));
  const rows = [];
  for (const f of files.sort()) {
    const parsed = matter(await readFile(join(POLLS_DIR, f), 'utf8'));
    const row = toRow(parsed);
    rows.push(row);
    console.log(`${f}: month=${row.month} status=${row.status} options=${row.options.length}` +
      (row.results ? ' (frozen results)' : ''));
  }

  if (DRY) {
    console.log('\n--dry-run: parsed OK, no writes.');
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.from('polls').upsert(rows, { onConflict: 'month' });
  if (error) { console.error('upsert failed:', error.message); process.exit(1); }
  console.log(`Imported ${rows.length} polls.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
