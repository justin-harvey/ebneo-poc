# EBNEO

Evidence-Based Neonatology — the EBNEO website. A static site whose commentaries,
board/founder rosters, and monthly journal-club polls are authored by clinicians through a
lightweight admin and published automatically.

## 🔗 Live site

**https://ebneo-poc.netlify.app**

- Home, commentaries, and the full archive are public — just open the link above.
- Editor admin ("Studio"): **https://ebneo-poc.netlify.app/studio** (invite-only; sign in with a
  magic link sent to an approved email — there is no public sign-up).

## What it is

- **Static Astro site** (fast, CDN-served) with Pagefind full-text search over ~196 commentaries.
- **Supabase is the source of truth** for content. A prebuild step *materializes* published rows
  back into the site's content files, so the static render pipeline stays simple and the published
  site never depends on a live database at request time.
- **Passwordless, invite-only editing** at `/studio`: a React admin for commentaries, the
  home-page Board & Founders lists, and the monthly polls. Publishing fires a Netlify build hook
  that rebuilds and redeploys the static site.

## Tech stack

Astro · React (Studio admin) · Supabase (Postgres + Auth + Storage, RLS-gated) · Pagefind ·
Netlify (hosting + build hooks). Node 22+.

## Local development

```bash
nvm use 22
npm install

# Studio + build read Supabase; set these in a local .env (never commit it):
#   PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY   (public, browser-safe)
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY         (build-only; materialize)

npm run dev        # local dev server
npm run materialize # pull published content from Supabase -> content files
npm run build      # astro build + pagefind index -> dist/
```

Deploys automatically from `main` to Netlify. Operational details, Supabase coordinates, and the
editor guide live in `SUPABASE-SETUP.md`, `CMS-SETUP.md`, and `RUNBOOK.md`.
