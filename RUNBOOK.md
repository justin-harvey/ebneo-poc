# EBNEO site — operations runbook

Ops reference for the static Astro site deployed on Netlify. Day-to-day editing lives in
`CMS-SETUP.md`; this is for deploys, backups, rollback, the voting backend, and incidents.

## At a glance
- **Repo:** `justin-harvey/ebneo-poc` (`main`). Netlify builds `main` on every push.
- **Build:** `npm run build` → `astro build && pagefind --site dist`; publish dir `dist`; Node 22
  (all pinned in `netlify.toml`).
- **Hosting:** Netlify (CDN + Functions). Auth + content live in **Supabase** (see `SUPABASE-SETUP.md`).
- **Source of truth:** **Supabase.** Commentaries, the Board/Founders rosters, and the monthly polls
  all live in Postgres; the build **materializes** them into `src/content/**` and `src/data/*.json`
  (those files are build artifacts, though committed copies serve local dev). The site code is in Git;
  live poll vote tallies live in Supabase (`poll_tallies`).
- **Live preview URL:** `ebneo-poc.netlify.app` (custom domain `ebneo.org` set in Netlify DNS at launch).

## Deploy
- **Normal:** merge/push to `main` → Netlify builds and publishes (~1–2 min). Editors never touch Git:
  publishing in `/studio` writes to Supabase, which fires a debounced Netlify build hook (S5), and the
  build materializes the latest content. "Deploy site now" in `/studio` forces a rebuild.
- **Manual:** Netlify dashboard → *Deploys → Trigger deploy → Deploy site*.
- **Preview code changes:** open a PR → Netlify posts a **deploy preview** URL per branch. Nothing is
  public until it hits `main`. (Content/roster/poll edits go live via the Supabase publish path above.)

## Rollback
The fastest, safest rollback is Netlify's, because content and code are both in the deploy:
1. Netlify → *Deploys* → find the last-known-good deploy → **Publish deploy**. Instant, no rebuild.
2. If the bad change was a Git commit, also revert it so the next build doesn't republish it:
   `git revert <sha> && git push`.
3. A reverted CMS content change is just a revert of that content commit.

## Backups
- **Code:** the Git repo. Optionally mirror to a second remote.
- **Content, rosters, polls, editor accounts, vote tallies:** all in **Supabase** now. Back these up
  with Supabase dumps / PITR (tracked in S7). The committed `src/content/**` + `src/data/*.json` are a
  recent materialized snapshot, so Git is a coarse secondary copy of published content.
- **Uploaded images:** legacy figures committed under `public/img/uploads/` (Git); new uploads go to
  the Supabase `figures` bucket (back up with Storage).

## Voting backend (Functions + Supabase)
- Endpoints (routes set in-code via `export const config`), unchanged public contract:
  - `POST /api/vote` — body `{ "month": "2026-11", "option": 0 }` → increments a tally; sets a
    180-day `ebneo_voted_<month>` cookie (one vote per browser).
  - `GET /api/results?month=2026-11` → `{ "month", "tallies": { "0": n, ... } }`.
- Store: Supabase table **`public.poll_tallies`** (`month` PK, `tallies` jsonb `{ optionIndex: count }`).
  The functions read/write it with the **service-role key** (needs `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` in the Netlify site env, which the build already sets). RLS denies
  everyone else, so the browser never reads tallies directly.
- **Quick health check** (replace host with the live domain):
  ```bash
  curl -s "https://ebneo.org/api/results?month=$(date +%Y-%m)"
  ```
- **Export tallies:** `GET /api/results?month=YYYY-MM`, or query `poll_tallies` in the Supabase dashboard.
- **Reset / edit a tally:** no public admin endpoint by design. Edit the `poll_tallies` row in the
  Supabase SQL editor (e.g. `delete from poll_tallies where month = '2026-11';` to wipe a month). A
  fresh month (`status: open` under a new `month`) starts at zero. Freezing a closed poll's final
  numbers into its `results` (via `/studio` → Polls) bakes them into the static archive page. Treat
  the cookie dedupe as best-effort, not a security control.

## Redirects
- `public/_redirects` holds the legacy WordPress → new-slug 301s (dated `/YYYY/MM/...` URLs) plus the
  preserved video post. Verified live post-deploy (301 → 200). Add a line when a slug ever changes.

## Robots / sitemap / SEO
- `public/robots.txt` allows all, disallows `/admin/`, and points to `/sitemap.xml`.
- `src/pages/sitemap.xml.ts` generates `sitemap.xml` at build (static pages + all published
  commentaries + the legacy video post; excludes `/admin` and `/api`).
- At launch: submit `https://ebneo.org/sitemap.xml` in Google Search Console.

## Accessibility
- Structural audit done in M5 (one `h1` per page, labelled form controls, alt text, landmarks,
  `aria-current` nav, zoomable viewport, decorative SVGs hidden).
- Before launch, run a real browser audit (Lighthouse in Chrome DevTools, or `npx pa11y <url>`)
  against a deploy preview — needs a browser, so it's a CI/manual step, not part of `npm run build`.

## Incident quick reference
| Symptom | First check |
|---|---|
| Site down / stale | Netlify *Deploys* — is the latest build green? Re-publish last-good deploy. |
| Build failing | Netlify build log. Reproduce locally: `nvm use 22 && npm run build`. |
| CMS login/publish broken | Identity + **Git Gateway** enabled? (`CMS-SETUP.md` one-time setup.) |
| Votes not recording | `curl .../api/results?month=…`; check the function log in Netlify → *Functions*. |
| Old URL 404s | Add/verify the 301 in `public/_redirects`. |
