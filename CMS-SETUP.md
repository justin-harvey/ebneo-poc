# EBNEO CMS — setup & editor guide (M2)

The site uses **Sveltia CMS** (a maintained, Decap/Netlify-CMS–compatible editor). It is
Git-based: editors fill a form in the browser, and every save becomes a commit that triggers a
Netlify build. No database, no server, no WordPress plugins.

- Admin UI: **`/admin/`** (e.g. `https://ebneo.org/admin/`)
- Config: `public/admin/config.yml`
- Content lives in: `src/content/commentaries/*.md`

---

## One-time Netlify setup (dashboard — ~10 min)

The CMS authenticates editors with **Netlify Identity** and writes to Git via **Git Gateway**.
Both are enabled once, in the Netlify dashboard for the connected site:

1. **Connect the repo** (if not already): Netlify → *Add new site → Import an existing project →*
   GitHub → select the `site/` repo. Build settings auto-fill from `netlify.toml`
   (command `npm run build`, publish `dist`, Node 22).
2. **Enable Identity:** Site config → *Identity* → **Enable Identity**.
3. **Registration:** Identity → *Registration preferences* → **Invite only**
   (editors are invited; the public can't self-register).
4. **Enable Git Gateway:** Identity → *Services* → **Enable Git Gateway**.
   (This is what lets the browser CMS commit to the repo on the editor's behalf.)
5. **Invite editors:** Identity → *Invite users* → enter each staffer's email.
   They get an email, set a password, and are redirected into `/admin/` (handled by the
   Netlify Identity snippet in `src/layouts/Base.astro`).

That's it — no editor needs a GitHub account.

### Optional hardening
- Pin the CMS version in `public/admin/index.html` (swap `@sveltia/cms` for `@sveltia/cms@<ver>`).
- Restrict uploads/roles later via Identity roles if guest authors are ever given logins.

---

## Publishing a commentary (editor workflow)

1. Go to `/admin/`, log in.
2. **Commentaries → New Commentary.**
3. Fill the form: Title, Publish date, Type of investigation, PMID/DOI (optional), reviewer email.
4. The **Commentary (structured)** body opens pre-filled with the 9 section headings
   (Citation, Reviewed By, Type of Investigation, Question, Methods, Main Results, Conclusion,
   Commentary, References). Paste each section under its heading. Keep the headings.
5. **Save** → the entry enters the editorial workflow (Draft).
6. Move it **Draft → In review → Ready**. Each stage pushes a branch and Netlify builds a
   **deploy preview** so you can see the rendered page before it's public.
7. **Publish** → merges to `main` → the live site rebuilds (~1–2 min). The commentary appears
   in the Reviews archive automatically (filters/search index it on build).

New posts get a clean title-based URL. The 83 migrated commentaries keep their original
`ebneo.org/ebneo-commentary-…` slugs so existing links and SEO are preserved.

---

## Running the monthly poll (Vote)

The `/vote` page shows the **newest poll with `status: open`** as the live ballot and lists every
other poll in the "Past polls" archive. Opening a poll is pure content — no code.

**Open a new monthly poll**
1. `/admin/` → **Polls (Vote) → New Poll**.
2. **Month** = the ballot month, e.g. `2026-11` (this is the ballot's key and sort order).
3. **Question** — keep the default or edit it.
4. **Candidate studies** — add 2–3 studies (title + optional authors, journal, date, link).
   ⚠️ **Do not reorder the studies after voting starts** — a study's position is its vote id,
   so reordering would reassign existing votes.
5. **Status = open.** Save and publish. It becomes the live ballot; any previously open poll
   should be closed (next step) so only one is open at a time.

**Close a poll**
- Edit the poll, set **Status = closed**, publish. It drops into "Past polls" and stops accepting
  votes. Results keep loading live from the tally store.

**Freeze final results (optional)** — if you ever want a closed poll's numbers baked into the page
(e.g. before retiring the vote backend), add a `results` block to the file's front-matter mapping
each study's index to its vote count, and the archive renders those bars statically:
```yaml
results:
  "0": 86   # first study
  "1": 54   # second study
```

**How votes are stored:** a Netlify Function (`netlify/functions/vote.mjs`) tallies votes in
**Netlify Blobs**, keyed by month. One vote per browser (a cookie, matching the old site — not
fraud-proof). See `RUNBOOK.md` for resetting or exporting tallies.

---

## Editing the board & founders (home page)

The home-page rosters are a **Society** collection (two JSON files), not free-form pages:
- `/admin/` → **Society → Executive Board** or **Founders & Past Chairs**.
- Add/remove/reorder members; each has Name, Role, Affiliation, and an optional Photo.
- Photos upload to `public/img/uploads/`. Save & publish → the home page rebuilds.

---

## Local testing note

`git-gateway` only works against the deployed Netlify site (it needs Identity). To preview the
CMS form locally, Sveltia/Decap support a local proxy (`local_backend: true` + `npx @sveltia/cms-server`),
but the fastest validation is on a Netlify deploy preview once steps 1–4 above are done.
The site itself runs locally without any of this: `nvm use 22 && npm run dev`.
