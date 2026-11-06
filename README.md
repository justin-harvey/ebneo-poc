# EBNEO

Evidence-Based Neonatology, the EBNEO website. A static site whose commentaries, board/founder
rosters, and monthly journal-club polls are authored by clinicians through a custom, purpose-built
CMS and published automatically.

## Live site

**https://ebneo-poc.netlify.app**

- Home, commentaries, and the full archive are public, just open the link above.
- Editor admin ("Studio"): **https://ebneo-poc.netlify.app/studio** (invite-only; sign in with a
  magic link sent to an approved email, there is no public sign-up).

## A custom headless CMS

Off-the-shelf Git-based editors didn't fit, non-technical doctors won't manage GitHub, so EBNEO runs
its own lightweight CMS built on Supabase:

- **Passwordless, invite-only authoring.** Editors sign in at `/studio` with a magic link (no
  passwords, no public sign-up). Roles and access are enforced in the database with row-level
  security.
- **Supabase is the source of truth, but the published site stays fully static.** The database is
  read only at *build time*: a prebuild step *materializes* published rows into the site's content
  files, so visitors are served plain CDN HTML and the live site never depends on a database at
  request time.
- **One admin for everything.** Commentaries (with figure uploads), the home-page Board & Founders
  lists, and the monthly polls are all edited in the same React app.
- **Publish means publish.** Saving a published change fires a Netlify build hook that rebuilds and
  redeploys the static site automatically.
- **Built for clinicians, not engineers.** Studio opens with a dismissible guided walkthrough on an
  editor's first sign-in (replayable from the **Guide** button), inline `?` tooltips on the
  non-obvious fields, and plain-language help throughout, no Git or Markdown knowledge required.

## Database availability

The published website is fully static and never touches a database at request time, so the public
site stays up regardless. The **Supabase** project only matters for editing in Studio and for live
vote tallies. On the free plan a Supabase project **pauses after 7 days with no activity**, so two
layers keep it awake:

- **Automated keep-alive.** A scheduled GitHub Action
  (`.github/workflows/supabase-keepalive.yml`) pings the database every 3 days, well inside the
  7-day window. It needs two repo secrets, `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- **In-app health bar.** A status strip under the Studio header shows at a glance whether the
  database is awake, green when healthy (with response time), amber once it has been idle 5+ days,
  red if it is unreachable. A **Ping now** button lets an editor wake it on demand. A ping only
  reads, it never changes data.

> On a production (non-free) Supabase plan, project pausing goes away entirely; at that point both
> the workflow and the health bar's warnings become unnecessary and the workflow can be deleted.

## Tech stack

Astro · React (Studio admin) · Supabase (Postgres + Auth + Storage, RLS-gated) · Pagefind
full-text search · Netlify (hosting + build hooks). Node 22+.

## Local development

```bash
nvm use 22
npm install

# Studio + build read Supabase; set these in a local .env (never commit it):
#   PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY   (public, browser-safe)
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY         (build-only; materialize)

npm run dev         # local dev server
npm run materialize # pull published content from Supabase into content files
npm run build       # astro build + pagefind index into dist/
```

Deploys automatically from `main` to Netlify. Operational details, Supabase coordinates, and the
editor guide live in `SUPABASE-SETUP.md`, `CMS-SETUP.md`, and `RUNBOOK.md`.
