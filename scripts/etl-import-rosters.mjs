// EBNEO CMS — S6 one-time ETL: src/data/{board,founders}.json -> Supabase.
//
// Imports the two home-page people lists into public.roster_members, preserving
// display order via sort_order. Idempotent: it replaces the rows for each group
// (delete-by-group then insert) so re-running mirrors the JSON exactly.
//
// Usage (Node 22):
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/etl-import-rosters.mjs [--dry-run]
//
// The service-role key bypasses RLS and is build-env/terminal only.

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data');

const DRY = process.argv.includes('--dry-run');
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DRY && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or pass --dry-run).');
  process.exit(1);
}

const GROUPS = [
  { grp: 'board', file: 'board.json' },
  { grp: 'founders', file: 'founders.json' },
];

function toRows(grp, members) {
  return members.map((m, i) => ({
    grp,
    name: m.name ?? '',
    role: m.role ?? '',
    aff: m.aff ?? '',
    img: m.img ?? '',
    x: m.x ?? '',
    linkedin: m.linkedin ?? '',
    sort_order: i,
  }));
}

async function main() {
  const all = [];
  for (const { grp, file } of GROUPS) {
    const json = JSON.parse(await readFile(join(DATA_DIR, file), 'utf8'));
    const rows = toRows(grp, json.members || []);
    all.push({ grp, rows });
    console.log(`${file}: ${rows.length} ${grp} members`);
  }

  if (DRY) {
    console.log('\n--dry-run: parsed OK, no writes.');
    console.log(JSON.stringify(all.flatMap((g) => g.rows), null, 2));
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  for (const { grp, rows } of all) {
    const del = await supabase.from('roster_members').delete().eq('grp', grp);
    if (del.error) { console.error(`delete ${grp} failed:`, del.error.message); process.exit(1); }
    const ins = await supabase.from('roster_members').insert(rows);
    if (ins.error) { console.error(`insert ${grp} failed:`, ins.error.message); process.exit(1); }
    console.log(`Imported ${rows.length} ${grp} members.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
