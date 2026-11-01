# EBNEO site — merge log

A running, reverse-chronological record of substantive merges to `main`
(which auto-deploys to Netlify). Newest first. Each entry: date, what changed,
why, and anything a future session needs to know.

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
