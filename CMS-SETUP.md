# EBNEO CMS — editor guide (Supabase Studio)

The site is edited through **EBNEO Studio**, a simple web form at **`/studio`**
(e.g. `https://ebneo.org/studio`). You log in with your email, no password to
remember and no GitHub account needed. Everything you write is saved to a secure
database (Supabase); when you publish, the live website rebuilds on its own a
minute or two later.

- Editor app: **`/studio`**
- You need to be **invited** first (invite-only). Ask an admin to add your email.
- Commentaries are stored in the database and rebuilt into the site at build time.

> This replaces the older Decap / Netlify Identity CMS. If you remember logging in
> at `/admin/` with a password, that system is gone; use `/studio` now.

---

## Logging in

1. Go to **`/studio`**.
2. Type the email address you were invited with and press **Send magic link**.
3. Check your inbox for an email from EBNEO / Supabase and click the link. It
   brings you straight back into Studio, signed in.
4. If the link does not arrive, wait a minute and try again, or ask an admin to
   re-send the invite. (The email allowance is small on our current plan; a
   handful of logins per hour.)

Only invited editors can see or change anything. If someone who was not invited
signs in, they see nothing.

---

## Writing or editing a commentary

1. From the list, click an existing commentary to edit it, or click
   **+ New commentary** to start a fresh one.
2. Fill in the fields:
   - **Title** (the slug / web address fills in automatically from the title; you
     can edit it, but once a commentary is live, changing the slug changes its URL).
   - **Publish date**, **Type of investigation** (suggestions like Treatment,
     Prevention, Diagnosis appear as you type), **PMID** / **DOI** (optional),
     **Reviewer email**.
   - **Needs review** checkbox: tick this to flag a commentary for a second pair of
     eyes. It does not stop publishing; it is just a marker shown in the list.
3. **Commentary text** opens pre-filled with the nine standard section headings:
   Citation, Reviewed By, Investigation, Question, Methods, Main Results,
   Conclusion, Commentary, References. Write under each `## Heading` and keep the
   headings. The checklist above the box ticks green as each section is present.
4. **Upload figure** adds an image to the end of the text. Cut and paste the line
   it inserts to wherever you want the figure to sit.
5. The **Live preview** on the right shows roughly how it will read. The real site
   styles it to match EBNEO.

### Saving vs publishing

- **Save draft** keeps your work in the database but does **not** show it on the
  public site. Drafts are safe to leave half-finished.
- **Publish** makes it public. A site rebuild starts automatically and the page is
  live in a minute or two.
- **Delete** removes a commentary for good (you get a confirmation prompt first).

---

## Pushing a rebuild yourself

Publishing already triggers a rebuild. If you ever need to force one (for example
after several quick edits), use **↻ Deploy site now** at the top of the list. One
rebuild covers everything saved up to that point.

---

## The Board & Founders lists

The home-page people lists are edited under the **Board & Founders** tab.

1. Pick **Executive Board** or **Founders & Past Chairs**.
2. Edit a person's name, role, affiliation, X handle, LinkedIn, and photo. Use
   **Upload photo** to add a new headshot, or paste an image path.
3. Use the **↑ / ↓** arrows to reorder people, **+ Add person** to add one, and
   **Remove** to drop one.
4. Click **Save list** for that group. A rebuild starts and the home page updates
   in a minute or two. (Save each list separately.)

## The monthly poll (Vote)

The monthly Article-of-the-Month ballot is edited under the **Polls** tab.

1. **+ New poll** to open a ballot. Set the **ballot month** (e.g. `2026-11`), the
   question, and **Status = Open**. Only one poll should be open at a time; set the
   previous one to **Closed**.
2. Add 2 or more **candidate studies** (title, authors, journal, date, link).
   The order is permanent once voting opens, so add or remove studies from the end
   before the poll goes live and do not reorder afterwards.
3. **Save poll.** The newest open poll becomes the live ballot on `/vote`; closed
   polls move to the archive.
4. To freeze a closed poll's final numbers on the archived page, set each study's
   **Final vote count** (shown when Status is Closed) and save.

Live votes are tallied in Supabase and shown on the public `/vote` page; one vote
per browser (a cookie, not fraud-proof), matching the previous site.

---

## For admins / developers

- **Invite an editor** (needs the Supabase service-role key in your shell):
  ```
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  node scripts/invite-editor.mjs <email> [editor|admin]
  ```
  `admin` can also manage the editor roster; `editor` can write commentaries.
- **How publishing reaches the live site:** Studio writes to Supabase; a database
  trigger calls the Netlify build hook; Netlify runs `npm run materialize`, which
  pulls the published rows back into `src/content/commentaries/*.md`, then builds the
  static site. Nothing the public sees is served live from the database.
- Full operational detail (coordinates, keys, schema, RLS, the publish pipeline) is
  in **`SUPABASE-SETUP.md`**. The milestone plan and handoff live one level up, outside
  this deploy repo.
- **Local dev:** `nvm use 22 && npm run dev`. The public site builds without any
  database access; only `npm run materialize` (and the Netlify build) touch Supabase.
