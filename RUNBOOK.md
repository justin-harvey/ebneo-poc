# EBNEO site — operations runbook

Ops reference for the static Astro site deployed on Netlify. Day-to-day editing lives in
`CMS-SETUP.md`; this is for deploys, backups, rollback, the voting backend, and incidents.

## At a glance
- **Repo:** `justin-harvey/ebneo-poc` (`main`). Netlify builds `main` on every push.
- **Build:** `npm run build` → `astro build && pagefind --site dist`; publish dir `dist`; Node 22
  (all pinned in `netlify.toml`).
- **Hosting:** Netlify (CDN + Functions + Blobs + Identity/Git Gateway for the CMS).
- **Source of truth:** Git. The site, content (`src/content/**`), and roster JSON are all in the repo.
  The **only** state that lives outside Git is the poll vote tallies (Netlify Blobs).
- **Live preview URL:** `ebneo-poc.netlify.app` (custom domain `ebneo.org` set in Netlify DNS at launch).

## Deploy
- **Normal:** merge/push to `main` → Netlify builds and publishes (~1–2 min). CMS "Publish" does this
  for you by committing to `main`.
- **Manual:** Netlify dashboard → *Deploys → Trigger deploy → Deploy site*.
- **Preview a change first:** open a PR / use the CMS editorial workflow → Netlify posts a
  **deploy preview** URL per branch. Nothing is public until it hits `main`.

## Rollback
The fastest, safest rollback is Netlify's, because content and code are both in the deploy:
1. Netlify → *Deploys* → find the last-known-good deploy → **Publish deploy**. Instant, no rebuild.
2. If the bad change was a Git commit, also revert it so the next build doesn't republish it:
   `git revert <sha> && git push`.
3. A reverted CMS content change is just a revert of that content commit.

## Backups
- **Code + content + rosters:** the Git repo *is* the backup. Optionally mirror to a second remote.
- **Uploaded images:** committed under `public/img/uploads/` → covered by Git.
- **Vote tallies (Blobs):** the one thing **not** in Git. If tallies matter long-term, export them
  (see below) or freeze them into each poll's front-matter `results:` when you close it
  (`CMS-SETUP.md` → "Freeze final results"). Frozen results are then in Git like everything else.

## Voting backend (Functions + Netlify Blobs)
- Endpoints (routes set in-code via `export const config`):
  - `POST /api/vote` — body `{ "month": "2026-11", "option": 0 }` → increments a tally; sets a
    180-day `ebneo_voted_<month>` cookie (one vote per browser).
  - `GET /api/results?month=2026-11` → `{ "month", "tallies": { "0": n, ... } }`.
- Store: Netlify Blobs store **`ebneo-polls`**, one JSON object per month (`{ optionIndex: count }`).
  Auto-provisions with the site; no setup, no cost tier to pick.
- **Quick health check** (replace host with the live domain):
  ```bash
  curl -s "https://ebneo.org/api/results?month=$(date +%Y-%m)"
  ```
- **Export tallies:** `GET /api/results?month=YYYY-MM` for each month and save the JSON.
- **Reset / edit a tally:** there is no admin endpoint by design. To wipe or correct a month, use the
  Netlify CLI against the site: `netlify blobs:delete ebneo-polls <YYYY-MM>` (or `blobs:set` to
  overwrite). Starting a fresh month (`status: open` under a new `month`) always begins at zero, so a
  reset is rarely needed. Treat the cookie dedupe as best-effort, not a security control.

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
