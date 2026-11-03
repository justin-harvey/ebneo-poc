# EBNEO Supabase CMS — Setup & Secrets

Operational reference for the Supabase-backed headless CMS. Pairs with the
milestone plan (`../SUPABASE-CMS-PLAN.md`) and handoff (`../SUPABASE-CMS-HANDOFF.md`),
which live one level up and are **not** tracked in this deploy repo.

**Status:** S0–S5 complete. Schema applied, 196 rows imported, byte-identical build from
Supabase, invite-only passwordless auth + RLS verified, `/studio` admin built, and the
publish -> rebuild pipeline is armed (needs the Netlify Build Hook URL set once). **S6 (rosters +
polls) built** (code done + DB-free build verified; needs migration applied + ETL run). S7
partially done (Decap removed, editor guide rewritten); SMTP/backups/RLS-rerun remain.

## 0. Project coordinates

- **Project ref:** `zdvkbkivihiscnmffkrr` (EU)
- **`SUPABASE_URL`:** `https://zdvkbkivihiscnmffkrr.supabase.co`
- **anon key** (`PUBLIC_SUPABASE_ANON_KEY`, safe in the browser, RLS-gated):
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkdmtia2l2aWhpc2NubWZma3JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NzA2MDksImV4cCI6MjEwOTI0NjYwOX0.ywUqmYwFL3jD5C_7UHMDAzxOqpSDezN6ZhVS4HYW1t4`
- **service-role key:** fetch when needed from the dashboard (Settings → API) or the
  Management API; it is a secret, so it is **not** recorded here. Build-env only.
- Justin holds a Supabase **personal access token** (`sbp_...`, Management API). It can
  mint the service-role key and run SQL; treated as a per-session secret, never persisted.

---

## 1. Decisions locked (plan §3)

Confirmed by Justin, 2026-11-02:

| # | Decision | Choice |
|---|----------|--------|
| 1 | Supabase region | **EU** (society is Sweden-registered; editor emails are GDPR PII) |
| 2 | Admin UI framework | **React SPA** on a client-rendered Astro `/studio` route |
| 3 | Figures | **Leave the 196 existing figures in-repo** (`/img/...`); only new uploads go to Supabase Storage |
| 4 | Review model | **Draft / Published** enum + optional `needs_review` flag (no multi-column workflow) |
| 5 | Migration scope | **Commentaries first** (S1–S5); rosters + polls later/optional (S6) |
| 6 | Cost tier | **Free tier** (hundreds of rows, low-traffic admin, build-time reads) |

### Deviation from the plan to note

The plan called `investigation` an **enum**. The legacy data is actually
free-form text (75 "Treatment" plus ~40 unique freeform values, including stray
template placeholders), so a hard enum would mangle ~40 rows and break the
byte-identical materialization S2 requires. **`investigation` is stored as
`text`**, matching the current Astro `z.string()` schema; faceting stays exactly
as it is today (render-time). `status` is a real enum.

---

## 2. Keys & environment

Three secrets, three homes. **Never ship the service-role key to the browser.**

| Secret | Where it lives | Used by |
|--------|----------------|---------|
| `SUPABASE_URL` | Netlify build env + local shell + SPA public config | everything |
| **service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) | **Netlify build env only** + your local shell for the one-time ETL | ETL import (S1), prebuild materialize (S2) |
| **anon key** (`PUBLIC_SUPABASE_ANON_KEY`) | SPA build-time public var | the `/studio` admin SPA (S3/S4), gated by RLS |

Rules:
- The **service-role key bypasses RLS**. It is only ever set in a trusted place:
  your terminal session or the Netlify **build** environment. It must never be
  referenced by any `src/pages/**` or client-rendered code.
- The **anon key** is safe in the browser *because* RLS denies anon all access to
  `commentaries`/`editors`; only an authenticated invited editor's JWT unlocks them.
- Local use: `export` the vars in your shell for a one-off; do not commit a `.env`.
  `.gitignore` should cover `.env*` before any SPA work (S4).

---

## 3. Schema

`supabase/migrations/0001_init.sql` — tables, enums, trigger, RLS. Summary:

- **`commentaries`** — `id, slug (UNIQUE), title, publish_date, investigation (text),
  pmid, doi, reviewer_email, status (enum draft|published), needs_review (bool),
  body (markdown), author_id, created_at, updated_at`. `updated_at` auto-bumps via trigger.
- **`editors`** — `id (-> auth.users), email, role (enum editor|admin), created_at`.
  Invite-only; populated in S3.
- **Enums** — `commentary_status`, `editor_role`.
- **RLS** — enabled on both tables. Authenticated invited editors get full
  read/write on `commentaries`; anon gets nothing; admins manage the `editors`
  roster. Helpers `is_editor()` / `is_admin()` back the policies. The build reads
  via the service role, which bypasses RLS. (S3 verifies/extends.)

---

## 4. Applying the migration

Pick one; the SQL is idempotent-ish (uses `if not exists` / `do $$` guards).

**A. Supabase Dashboard (no tooling needed):**
SQL Editor -> paste the contents of `supabase/migrations/0001_init.sql` -> Run.

**B. Supabase CLI** (not installed in this environment; install if preferred):
```
npx supabase link --project-ref <ref>
npx supabase db push
```

**C. psql with the connection string:**
```
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
```

---

## 5. Running the ETL (S1 import)

Node 22 (`nvm use 22`). Dry run needs no credentials and validates the parse:

```
node scripts/etl-import-commentaries.mjs --dry-run
```

Live import (upserts 196 rows, keyed on slug, re-runnable):

```
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
node scripts/etl-import-commentaries.mjs
```

Acceptance: 196 rows; slugs match the live site 1:1; spot-check 10 bodies/dates.

---

## 6. Build-time materialize (S2)

`scripts/materialize-commentaries.mjs` fetches `status='published'` rows and
regenerates `src/content/commentaries/*.md` byte-identically (same frontmatter
key order + quoting, no blank line after frontmatter, trailing newline). It mirrors
the DB: stale `.md` with no published row are removed (skip with `--no-clean`).

Wiring: `netlify.toml` build command is `npm run materialize && npm run build`.
Netlify **must** have `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set in the build
env; the materialize step exits non-zero if they are missing (no silent stale build).
`npm run build` on its own stays DB-free for local dev.

Verified 2026-11-02: materialize -> source tree byte-clean; full build = 207 pages
(== baseline), Pagefind indexed all 196 commentaries.

## 7. Auth + editors + RLS (S3)

**Auth config (set via Management API):** invite-only (`disable_signup=true`),
email provider on, anonymous sign-in off, `site_url=https://ebneo-poc.netlify.app`,
redirect allow-list covers `/**` on the Netlify site, ebneo.org / www, and localhost
:4321 (astro dev) / :3000. Login is **email magic link** (passwordless).

**Invite an editor:**
```
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/invite-editor.mjs <email> [editor|admin]
```
Creates/locates the auth user, emails a magic link (redirect -> `/studio`), and
upserts the `public.editors` row with the role. Invite-only is enforced twice:
signups are disabled AND RLS requires an `editors` row (`is_editor()`).

**RLS verification** (`scripts/verify-rls.mjs`, re-run in the S7 security pass):
```
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/verify-rls.mjs
```
Verified 2026-11-02 — ALL PASS: anon read=0 rows / write denied (42501); invited
editor read+write OK; non-invited authenticated user blocked.

**Operational note:** the project's built-in email has a low hourly send limit on
the free tier. For real editor onboarding, configure **custom SMTP** in the Supabase
dashboard (Auth -> SMTP). Tracked for S7. A full end-to-end "click emailed link ->
reach admin" test is deferred to S4, when `/studio` exists (no dead-end links sent).

## 8. The /studio admin SPA (S4)

React 18 + `@astrojs/react@3`, mounted `client:only` on `src/pages/studio/index.astro`
(noindex). Single-file app: `src/components/studio/StudioApp.jsx` + `supabaseClient.js`.
Uses the **anon key only** (build-inlined); RLS is the boundary. Verified the built
bundle contains the anon key but **not** the service-role key or the `sbp_` PAT.

Features: magic-link login (invite-only) -> authorization check against `editors` ->
searchable list -> create/edit with the 9-section template, metadata fields, figure
upload to the `figures` bucket, live markdown preview, Save draft / Publish / Delete.
Built for non-technical doctors (plain language, inline help, section checklist).

**Required public build env (Netlify + local `.env`):**
`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`. See `.env.example`. Local `.env` is
gitignored. (The build also needs the service-role vars from §2 for materialize.)

Storage: `supabase/migrations/0002_storage.sql` creates the public-read `figures`
bucket; only invited editors can write (policies on `storage.objects`).

Smoke-tested 2026-11-02 (headless Chromium): app mounts, login screen renders, **zero
JS errors**. Remaining QA = the logged-in flow through the real UI (list/edit/publish/
upload), best done live via magic link after deploy, or a headless authed test.

## 9. Publish -> rebuild pipeline (S5)

Pure SQL, no Edge Function: `supabase/migrations/0003_deploy_trigger.sql` adds `pg_net`,
a locked-down `deploy_control` table (holds the hook URL + debounce window; RLS denies
all, only SECURITY DEFINER functions read it), a trigger on `commentaries`
(`commentaries_deploy`) that POSTs the Netlify Build Hook when the **published set could
change** (publish / edit-while-published / unpublish / delete), **debounced** (default
60s) so edit bursts don't stampede builds, and `request_deploy()` (RPC, editors only) for
the admin's manual **"Deploy site now"** button.

**One-time setup — set the hook URL:** in Netlify, Site config -> Build & deploy -> Build
hooks -> Add build hook, copy the URL, then run (service role / Management API):
```
update public.deploy_control set hook_url = 'https://api.netlify.com/build_hooks/XXXX' where id = 1;
```
Until that is set the trigger is a safe no-op. Verified 2026-11-03: publish fires exactly
one build, a rapid second write is debounced (one POST total), hook reset to null after test.

## 10. Rosters + polls (S6)

`supabase/migrations/0004_rosters_polls.sql` adds three tables and moves the last two content
stores off JSON/Netlify Blobs onto Supabase:

- **`roster_members`** (`grp` = board|founders, name/role/aff/img/x/linkedin, `sort_order`) — the
  home-page Executive Board + Founders lists. Materialized to `src/data/board.json` /
  `founders.json` at build. Editor-only RLS (reuses `is_editor()`).
- **`polls`** (`month` unique, question, `status` open|closed, `options` jsonb, optional frozen
  `results`, `body`) — the monthly ballots. Materialized to `src/content/polls/*.md` at build.
  Editor-only RLS.
- **`poll_tallies`** (`month` PK, `tallies` jsonb) — live runtime vote counts, replacing the
  Netlify Blobs store. Written only by the `/api/vote` + `/api/results` functions via the
  service-role key. RLS denies everyone (service role bypasses); never read by the browser.

Both content tables fire the S5 debounced deploy via a status-agnostic `trigger_deploy_always()`
(any change rebuilds; safe no-op until the hook URL is set).

**Apply + migrate (one-time, service-role / Management PAT):**
```
# 1. apply the migration (dashboard SQL editor or Management API)
#    -> supabase/migrations/0004_rosters_polls.sql
# 2. import the existing data (idempotent):
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/etl-import-rosters.mjs
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/etl-import-polls.mjs
```
Both ETL scripts take `--dry-run` (no creds, validates the parse). Build wiring: `npm run
materialize` now runs all three materializers (commentaries + rosters + polls). Admin: `/studio`
gains **Board & Founders** and **Polls** tabs.

Round-trip verified offline 2026-11-03: poll materialize is byte-identical to the seed `.md`;
`board.json` byte-identical; `founders.json` re-emitted in clean 2-space JSON (values identical, so
the rendered home page is unchanged). **Deploy ordering:** apply the migration + run both ETL
imports **before** the first deploy that ships the new `/api/vote` functions, or voting 500s until
the tables exist. (Nothing deploys until pushed, so this is controllable.)

Old Netlify Blobs store `ebneo-polls` is retired; `@netlify/blobs` dropped from `package.json`.
The live `2026-11` test votes in Blobs are not migrated (they get wiped at launch anyway).

## 11. What's next

- **S7 (in progress):**
  - ✅ Decap decommissioned: `public/admin/` (config.yml + index.html) deleted, the
    Netlify Identity widget removed from `src/layouts/Base.astro`, `robots.txt` now
    disallows `/studio/` instead of `/admin/`. DB-free build verified (207 pages, 196
    commentaries indexed); no `netlify-identity` refs remain in `dist/`.
  - ✅ `CMS-SETUP.md` rewritten as a plain-language Supabase Studio editor guide.
  - ⬜ Custom SMTP in the Supabase dashboard (Auth → SMTP) — needs dashboard access.
  - ⬜ Backups (PITR/dumps) + a tested restore — needs dashboard access (PITR is paid;
    on free tier use scheduled logical dumps).
  - ⬜ Re-run `verify-rls.mjs` as the final security check — needs the keys.
