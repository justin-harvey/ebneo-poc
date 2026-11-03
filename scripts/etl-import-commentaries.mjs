// EBNEO CMS — one-time ETL: markdown archive -> Supabase (plan S1)
//
// Reads every src/content/commentaries/*.md, parses frontmatter + body, and
// UPSERTS a row per commentary keyed on the exact slug (so live URLs never
// move). Idempotent: safe to re-run; re-running reconciles rows to the files.
//
// Usage (Node 22):
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/etl-import-commentaries.mjs [--dry-run]
//
// The service-role key bypasses RLS and must only ever be used in a trusted
// environment (your shell, the Netlify build env). Never ship it to a browser.

import { createClient } from '@supabase/supabase-js';
import matter from 'gray-matter';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'src', 'content', 'commentaries');

const DRY_RUN = process.argv.includes('--dry-run');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error(
    'Missing env. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or pass --dry-run.',
  );
  process.exit(1);
}

// Normalize a frontmatter date (gray-matter may give a Date or a string) to
// YYYY-MM-DD, or null. We use UTC parts to avoid an off-by-one from TZ.
function toDateOnly(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function rowFromFile(fileName, raw) {
  const { data, content } = matter(raw);
  const slug = (data.slug || basename(fileName, '.md')).trim();
  if (!data.slug) {
    console.warn(`  ! ${fileName}: no slug in frontmatter, derived "${slug}"`);
  }
  return {
    slug,
    title: (data.title || '').trim(),
    publish_date: toDateOnly(data.publish_date),
    investigation: (data.investigation ?? '').toString(),
    pmid: (data.pmid ?? '').toString(),
    doi: (data.doi ?? '').toString(),
    reviewer_email: (data.reviewer_email ?? '').toString(),
    status: (data.status || 'published').toString().trim(),
    body: content.replace(/^\n+/, ''), // drop the blank line after frontmatter
  };
}

async function main() {
  const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith('.md'));
  console.log(`Found ${files.length} markdown files in ${CONTENT_DIR}`);

  const rows = [];
  for (const f of files) {
    const raw = await readFile(join(CONTENT_DIR, f), 'utf8');
    rows.push(rowFromFile(f, raw));
  }

  // Guard: slugs must be unique across the file set.
  const seen = new Map();
  for (const r of rows) {
    if (seen.has(r.slug)) {
      console.error(`DUPLICATE slug "${r.slug}" — aborting.`);
      process.exit(1);
    }
    seen.set(r.slug, true);
  }
  // Guard: every status must be a valid enum value.
  const badStatus = rows.filter((r) => !['draft', 'published'].includes(r.status));
  if (badStatus.length) {
    console.error(
      `Invalid status values: ${[...new Set(badStatus.map((r) => r.status))].join(', ')} — aborting.`,
    );
    process.exit(1);
  }

  console.log(`Parsed ${rows.length} rows; slugs unique; statuses valid.`);

  if (DRY_RUN) {
    console.log('\n--dry-run: no writes. Sample row:');
    console.log(JSON.stringify({ ...rows[0], body: rows[0].body.slice(0, 120) + '…' }, null, 2));
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Upsert in batches, keyed on the unique slug.
  const BATCH = 50;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from('commentaries')
      .upsert(batch, { onConflict: 'slug' });
    if (error) {
      console.error(`Batch at ${i} failed:`, error.message);
      process.exit(1);
    }
    done += batch.length;
    console.log(`  upserted ${done}/${rows.length}`);
  }

  const { count, error: countErr } = await supabase
    .from('commentaries')
    .select('*', { count: 'exact', head: true });
  if (countErr) console.warn('Count check failed:', countErr.message);
  else console.log(`\nDone. commentaries row count = ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
