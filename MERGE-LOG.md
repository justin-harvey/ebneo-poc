# EBNEO site — merge log

A running, reverse-chronological record of substantive merges to `main`
(which auto-deploys to Netlify). Newest first. Each entry: date, what changed,
why, and anything a future session needs to know.

---

## 2026-11-02 — CMS: first-run help card + photo-field reassurance hint

**What:** Added editor onboarding guidance to `/admin/`. (1) A dismissible, fixed-position "Need a
hand publishing?" help card in `public/admin/index.html` that walks the left-to-right Workflow board
(Drafts → In review → Ready → Publish) and repeats the photo tip; it's a sibling of Decap's React root
so re-renders can't break it, and it remembers collapsed state in localStorage. (2) A native `hint` on
both `society` photo fields: "If the preview stays blank after uploading, don't worry: the photo still
saves and appears on the live site." Also scrubbed em dashes from editor-facing admin copy (title, list
summaries, hints) per the house no-em-dash style; two `#` dev comments left as-is.

**Why:** First-time editors found the blank image preview confusing (the Decap + git-gateway preview
quirk) and the workflow non-obvious. Pure `public/` assets, no build impact.

---

## 2026-11-02 — Board/founders: LinkedIn alongside X on PersonCard

**What:** Added an optional **LinkedIn** social link to the board + founders cards, next to the
existing X/Twitter link. `PersonCard.astro` now wraps both in a `.social` flex row; `Icon.astro`
gained a Feather-style `linkedin` glyph; `global.css` `.person .x` rule generalised to `.person
.social a`. CMS `config.yml` has a `linkedin` field on both `society` collections (stores the vanity
ID after `linkedin.com/in/`, not a full URL — mirrors the `x` handle-only convention).

**Why:** Requested — board members want LinkedIn shown too. No data entered yet (0 rendered); add
per-member via `/admin/` → Society, or directly in `src/data/board.json`/`founders.json`. Build green
at 206 pages; home still renders 14 X links, 0 LinkedIn until populated.

---

## 2026-11-02 — CMS engine: Sveltia → Decap (git-gateway restored) + config fixes

**What:** Swapped `public/admin/index.html` to load **Decap CMS `3.17.3`** (pinned) instead of
Sveltia. Also in `public/admin/config.yml`: added an `x` (X/Twitter handle) field to the board +
founders `society` collections, and pointed `logo_url` at the official `/img/ebneo-logo.png`.
Reworded `CMS-SETUP.md` to Decap (version-pin note + local proxy `npx decap-server`).

**Why:** The first real CMS login attempt failed — **Sveltia dropped support for the `git-gateway`
backend**, which the whole invite-only/no-GitHub-account editor model (and the already-enabled
Netlify Git Gateway) depends on. Decap is the maintained Netlify-CMS fork and still supports
git-gateway, so `config.yml` backend is unchanged and `CMS-SETUP.md` stays accurate. The `x`-field
gap was a silent data-loss risk: 14 board handles weren't declared in the CMS, so a roster save
could have dropped them.

**For next session:** the live `/admin/` login/publish test still needs to be run end-to-end on the
deploy (Decap renders its own "Login with Netlify Identity" button; the invite→redirect is handled by
the Netlify Identity widget already in `Base.astro`). Caveat: Netlify Identity/Git Gateway are on a
long-term deprecation path — fine for now, revisit before relying on it heavily. The HANDOFF.md still
calls the CMS "Sveltia" in a few places; update when touched.

---

## 2026-11-01 — M15 tail: 301s for legacy pages + news posts (no 404s at cutover)

**What:** Added a labelled 301 block to `_redirects` (via `legacy_redirects.py`, one
level up) so no old WordPress URL 404s at the DNS cutover: 19 legacy pages, 2 tag-archive
wildcards, the external `/twitter/` → X, and 46 news/announcement posts → `/about/`
(the preserved `.../gordon-guyatt` video page is excluded — it's a real route).

**Dispositions (per Justin):** conferences → `/about/`; `/membership/` + `/checkout/*`
deferred (301 to `/about/`/`/`, membership model to be vetted with the client);
`/archive/` + tag archives → `/reviews/`; `/contribute/`,`/newsletters/`,`/welcome/` → `/`.
Two pages left un-redirected pending a content check: `/developing-countries/` and the
`/documents/` *page*. `_redirects` is now 323 lines; build green at 206 pages.

**Why:** M15 is the launch-blocking pre-cutover audit; stray old URLs would drop link
equity and break inbound links. This clears the last bulk piece before go-live.

**Files:** `public/_redirects`.

---

## 2026-11-01 — Add "Article of the Year" to the top nav

**What:** `/impact/` (Article of the Year) was only linked in the footer, not the
header menu, so it was effectively unreachable from the top of the site. Added it
to `SiteHeader.astro`'s `nav` array between Vote and Authors (icon `award2`, to
distinguish from Vote's `award`).

**Why:** Justin flagged there was no way to navigate to Impact from the menu.

**Files:** `src/components/SiteHeader.astro`.

---

## 2026-11-01 — M15 archive re-migration: +113 commentaries (83 → 196)

**What:** Migrated the 113 commentaries that the M15 coverage audit found had
never been captured. The collection went from 83 → **196**; the site builds green
at **206 pages**.

- Scraped all 113 live URLs (new `scrape_missing.py`, targeted + polite) — the
  original crawler was a BFS hard-capped at 100 pages, the root cause of the gap.
- Parsed with the validated M3 parser unchanged (`parse_missing.py`): 113/113
  genuine commentaries, 0 non-conforming.
- Installed + wired redirects (`finalize_migration.py`): added **68 dated→flat
  301s** to `_redirects` for the missing commentaries that live at dated
  `/YYYY/MM/slug/` canonical URLs (the audit's "no redirect gap" held only for
  the original 83). Inserted surgically so the hand-edited page section survived.
- Rehosted the 2 hotlinked figures (`parental-depression-and-anxiety-nicu`) to
  `public/img/uploads/`; collection now 100% free of `wp-content` hotlinks.
- Resolved one slug collision: `/extubation-readiness` and
  `/2020/12/extubation-readiness` are two different commentaries → the dated one
  became `extubation-readiness-predictive-model` (+301 from its dated URL).
- Hand-fixed 5 newer-format posts the 2015–2020-era parser mangled (multi-line
  YAML that broke the build, a plural `### QUESTIONS` heading, one inline
  bold-label post, one `**** Treatment` artifact).

**Why:** Launching with <half the archive would have dropped ~113 pages holding
inbound scholarly citations and search ranking — the audit's biggest go-live blocker.

**Files:** `+113` in `src/content/commentaries/`, `+2` in `public/img/uploads/`,
modified `public/_redirects`. Migration scripts + working record live one level up
in `/home/nah/ebneo/` (not in this repo): `scrape_missing.py`, `parse_missing.py`,
`finalize_migration.py`, `MIGRATION-COVERAGE-AUDIT.md`.

**Still open:** disposition ~47 news posts + ~22 legacy pages; remaining
sub-sitemaps; live redirect spot-check on the deploy preview; D5 membership
decision; a cleanup pass on the messy `investigation` facet taxonomy (pre-existing).
