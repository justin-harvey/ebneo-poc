// EBNEO CMS — prebuild materialize: Supabase -> src/content/polls/*.md (S6)
//
// Regenerates one markdown file per poll, reproducing the exact frontmatter shape
// the `polls` content collection and vote.astro already consume, so the voting
// render pipeline is untouched. Supabase is the source of truth; the .md files
// become a build artifact. Byte-identical to the hand-authored seed files.
//
// Usage (Node 22):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/materialize-polls.mjs [--out <dir>] [--no-clean]

import { createClient } from '@supabase/supabase-js';
import { readdir, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const OUT_DIR = outIdx !== -1 ? argv[outIdx + 1] : join(__dirname, '..', 'src', 'content', 'polls');
const NO_CLEAN = argv.includes('--no-clean');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

// Double-quote a YAML scalar as the seed files do (defensive escaping only fires
// on future content with quotes/backslashes, so the current data stays identical).
function q(v) {
  return '"' + String(v ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// Reproduce the seed poll frontmatter exactly: quoted month/question, unquoted
// status, the options list (every option carries all five keys), optional frozen
// results with quoted integer keys, one blank line, then the body.
function serialize(row) {
  const lines = [
    `month: ${q(row.month)}`,
    `question: ${q(row.question)}`,
    `status: ${row.status}`,
    'options:',
  ];
  for (const o of row.options || []) {
    lines.push(`  - title: ${q(o.title)}`);
    lines.push(`    authors: ${q(o.authors)}`);
    lines.push(`    journal: ${q(o.journal)}`);
    lines.push(`    date: ${q(o.date)}`);
    lines.push(`    url: ${q(o.url)}`);
  }
  if (row.results && Object.keys(row.results).length) {
    lines.push('results:');
    for (const k of Object.keys(row.results).sort((a, b) => Number(a) - Number(b))) {
      lines.push(`  ${q(k)}: ${row.results[k]}`);
    }
  }
  return `---\n${lines.join('\n')}\n---\n\n${row.body ?? ''}`;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from('polls')
    .select('month,question,status,options,results,body');

  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }

  // Polls can be legitimately empty only before any ballot exists; still, a zero
  // result here most likely means a misconfig, so skip the cleanup wipe and warn.
  if (rows.length === 0) {
    console.warn('No polls returned; leaving existing poll files untouched.');
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });

  if (!NO_CLEAN) {
    const existing = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.md'));
    const keep = new Set(rows.map((r) => `${r.month}.md`));
    for (const f of existing) {
      if (!keep.has(f)) { await unlink(join(OUT_DIR, f)); console.log(`  removed stale ${f}`); }
    }
  }

  for (const row of rows) {
    await writeFile(join(OUT_DIR, `${row.month}.md`), serialize(row), 'utf8');
  }

  console.log(`Materialized ${rows.length} polls -> ${OUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
