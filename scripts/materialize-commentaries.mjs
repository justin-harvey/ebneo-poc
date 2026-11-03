// EBNEO CMS — prebuild materialize: Supabase -> markdown (plan S2)
//
// Fetches every status='published' commentary and writes one
// src/content/commentaries/<slug>.md file, reproducing the exact frontmatter
// shape the archive already uses, so the downstream Astro content-collection /
// [slug].astro / Pagefind / facet / sitemap pipeline is untouched. The markdown
// files become a build artifact, not hand-edited source.
//
// Runs before `astro build` (see package.json "build"). Supabase is the source
// of truth; this step regenerates the files the site builds from.
//
// Usage (Node 22):
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/materialize-commentaries.mjs [--out <dir>] [--no-clean]
//
// --out <dir>   write to <dir> instead of src/content/commentaries (for diffing)
// --no-clean    do not delete existing .md first (used by the byte-diff test)
//
// The service-role key bypasses RLS and is build-env only. Never ship to a browser.

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = join(__dirname, '..', 'src', 'content', 'commentaries');

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const OUT_DIR = outIdx !== -1 ? argv[outIdx + 1] : DEFAULT_OUT;
const NO_CLEAN = argv.includes('--no-clean');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

// Double-quote a string field exactly as the archive does. The current data has
// no embedded quotes/backslashes; escaping is defensive and only fires if future
// content introduces them (so it never perturbs the byte-identical case).
function q(v) {
  return '"' + String(v ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// Format a Postgres date (YYYY-MM-DD or ISO) to the unquoted YYYY-MM-DD used in
// the frontmatter. Null/empty -> empty (unquoted), matching how a dateless row
// would serialize; the current archive has a date on every row.
function dateOnly(v) {
  if (!v) return '';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : String(v);
}

// Reproduce the archive's exact frontmatter: key order + which fields are quoted.
// No blank line between the closing --- and the body; body already carries its
// own trailing newline. See scripts notes / SUPABASE-SETUP.md.
function serialize(row) {
  const fm = [
    `title: ${q(row.title)}`,
    `slug: ${q(row.slug)}`,
    `publish_date: ${dateOnly(row.publish_date)}`,
    `investigation: ${q(row.investigation)}`,
    `pmid: ${q(row.pmid)}`,
    `doi: ${q(row.doi)}`,
    `reviewer_email: ${q(row.reviewer_email)}`,
    `status: ${row.status}`,
  ].join('\n');
  return `---\n${fm}\n---\n${row.body}`;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from('commentaries')
    .select('slug,title,publish_date,investigation,pmid,doi,reviewer_email,status,body')
    .eq('status', 'published');

  if (error) {
    console.error('Fetch failed:', error.message);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  // Keep the output dir an exact mirror of published rows: remove .md files that
  // no longer correspond to a published commentary (e.g. unpublished/renamed).
  if (!NO_CLEAN) {
    const existing = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.md'));
    const keep = new Set(rows.map((r) => `${r.slug}.md`));
    for (const f of existing) {
      if (!keep.has(f)) {
        await unlink(join(OUT_DIR, f));
        console.log(`  removed stale ${f}`);
      }
    }
  }

  for (const row of rows) {
    await writeFile(join(OUT_DIR, `${row.slug}.md`), serialize(row), 'utf8');
  }

  console.log(`Materialized ${rows.length} published commentaries -> ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
