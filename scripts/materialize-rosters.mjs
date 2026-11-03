// EBNEO CMS — prebuild materialize: Supabase -> src/data/{board,founders}.json (S6)
//
// Fetches roster_members ordered by display order and regenerates the two JSON
// files the home/about/contact pages import, so the render pipeline is untouched.
// Supabase is the source of truth; these files become a build artifact.
//
// Output shape matches board.json exactly (JSON.stringify(_, null, 2) + trailing
// newline, empty fields omitted). founders.json is re-emitted in the same clean
// shape; its whitespace differs from the hand-authored original but the rendered
// output is identical (the pages read values, not formatting).
//
// Usage (Node 22):
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/materialize-rosters.mjs [--out <dir>]

import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const OUT_DIR = outIdx !== -1 ? argv[outIdx + 1] : join(__dirname, '..', 'src', 'data');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const GROUPS = [
  { grp: 'board', file: 'board.json' },
  { grp: 'founders', file: 'founders.json' },
];

// Emit only the keys the JSON used, in the original order, dropping empty ones
// so the output matches the hand-authored objects (absent img/x stay absent).
function member(r) {
  const m = { name: r.name, role: r.role, aff: r.aff };
  if (r.img) m.img = r.img;
  if (r.x) m.x = r.x;
  if (r.linkedin) m.linkedin = r.linkedin;
  return m;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: rows, error } = await supabase
    .from('roster_members')
    .select('grp,name,role,aff,img,x,linkedin,sort_order')
    .order('grp', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) { console.error('Fetch failed:', error.message); process.exit(1); }

  // A roster is never legitimately empty; refuse to blank the home page.
  if (rows.length === 0) {
    console.error('Refusing to continue: 0 roster_members returned. Aborting the build.');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  for (const { grp, file } of GROUPS) {
    const members = rows.filter((r) => r.grp === grp).map(member);
    if (members.length === 0) {
      console.error(`Refusing to continue: 0 "${grp}" members. Aborting the build.`);
      process.exit(1);
    }
    await writeFile(join(OUT_DIR, file), JSON.stringify({ members }, null, 2) + '\n', 'utf8');
    console.log(`Materialized ${members.length} ${grp} members -> ${file}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
