// EBNEO Studio — the admin SPA (plan S4).
//
// A single-file React app mounted client-only on /studio. Built for non-technical
// doctors: plain language, inline help, reassurance, no Git/Markdown jargon.
//
// Flow: magic-link login (invite-only) -> authorization check against public.editors
// -> searchable list -> create/edit with the 9-section template, figure upload, live
// preview, and Save draft / Publish. All access is gated by RLS (anon + the editor's
// JWT); no secret is in this bundle.

import React, { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { supabase, supabaseConfigured, FIGURES_BUCKET } from './supabaseClient.js';

const SECTIONS = [
  'Citation', 'Reviewed By', 'Investigation', 'Question', 'Methods',
  'Main Results', 'Conclusion', 'Commentary', 'References',
];
const SCAFFOLD = SECTIONS.map((s) => `## ${s}\n\n`).join('\n').trimEnd() + '\n';
const INVESTIGATION_SUGGESTIONS = [
  'Treatment', 'Prevention', 'Prognosis', 'Diagnosis', 'Systematic review',
  'Quality improvement', 'Clinical prediction guides',
];

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

const BRAND_GREEN = '#70b030';
const BRAND_BLUE = '#0070c0';

const css = `
*{box-sizing:border-box}
body{margin:0}
.st-wrap{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a2b3c;background:#f4f6f8;min-height:100vh}
.st-header{display:flex;align-items:center;justify-content:space-between;padding:.8rem 1.2rem;background:#0b2239;color:#fff}
.st-header h1{font-size:1.05rem;margin:0;font-weight:600;letter-spacing:.2px}
.st-header .who{font-size:.82rem;opacity:.85;display:flex;gap:.8rem;align-items:center}
.st-main{max-width:1100px;margin:0 auto;padding:1.2rem}
.st-btn{border:0;border-radius:7px;padding:.55rem 1rem;font-size:.9rem;font-weight:600;cursor:pointer;background:#e7ebef;color:#1a2b3c}
.st-btn:hover{filter:brightness(.97)}
.st-btn.primary{background:${BRAND_GREEN};color:#fff}
.st-btn.blue{background:${BRAND_BLUE};color:#fff}
.st-btn.ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4)}
.st-btn.danger{background:#fff;color:#b00020;border:1px solid #e3b6bd}
.st-btn:disabled{opacity:.5;cursor:not-allowed}
.st-card{background:#fff;border:1px solid #e2e8ee;border-radius:10px;padding:1rem;margin-bottom:1rem}
.st-input,.st-textarea,.st-select{width:100%;padding:.5rem .6rem;border:1px solid #cdd7e0;border-radius:7px;font-size:.92rem;font-family:inherit}
.st-textarea{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.5;min-height:420px}
.st-label{display:block;font-size:.78rem;font-weight:600;color:#50606f;margin:.6rem 0 .25rem;text-transform:uppercase;letter-spacing:.3px}
.st-help{font-size:.78rem;color:#6b7a88;margin:.2rem 0 0}
.st-row{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}
.st-grid-edit{display:grid;grid-template-columns:1.2fr 1fr;gap:1.2rem;align-items:start}
.st-list-item{display:flex;align-items:center;justify-content:space-between;padding:.6rem .4rem;border-bottom:1px solid #eef2f5;cursor:pointer}
.st-list-item:hover{background:#f7fafc}
.st-badge{font-size:.7rem;font-weight:700;padding:.15rem .5rem;border-radius:999px;text-transform:uppercase;letter-spacing:.4px}
.st-badge.published{background:#e3f4d9;color:#3d6b17}
.st-badge.draft{background:#fdecc8;color:#8a6100}
.st-badge.review{background:#ffe0e0;color:#a11}
.st-check{display:flex;flex-wrap:wrap;gap:.4rem;margin:.4rem 0}
.st-chip{font-size:.72rem;padding:.2rem .5rem;border-radius:6px;border:1px solid #d7e0e8;color:#8795a2}
.st-chip.on{background:#e3f4d9;border-color:#b6e39a;color:#3d6b17}
.st-preview{background:#fff;border:1px solid #e2e8ee;border-radius:10px;padding:1rem 1.2rem;max-height:620px;overflow:auto}
.st-preview h2{color:${BRAND_BLUE};font-size:1.1rem;border-bottom:2px solid #eef2f5;padding-bottom:.2rem;margin-top:1.2rem}
.st-preview img{max-width:100%}
.st-note{font-size:.85rem;padding:.6rem .8rem;border-radius:7px;margin:.5rem 0}
.st-note.err{background:#fdeaea;color:#a11;border:1px solid #f3c9c9}
.st-note.ok{background:#e9f6df;color:#3d6b17;border:1px solid #c7e7ac}
.st-note.info{background:#e7f0f8;color:#235a86;border:1px solid #c3dbef}
.st-center{max-width:440px;margin:7vh auto;padding:0 1rem}
.st-toolbar{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
.st-spacer{flex:1}
a.st-link{color:${BRAND_BLUE}}
`;

function Styles() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

// ---------------------------------------------------------------- login
function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/studio` },
    });
    setBusy(false);
    if (error) setErr(error.message || 'Could not send the link. Check the address and try again.');
    else setSent(true);
  }

  return (
    <div className="st-center">
      <div className="st-card">
        <h1 style={{ marginTop: 0, color: BRAND_BLUE }}>EBNEO Studio</h1>
        {sent ? (
          <>
            <div className="st-note ok">
              Check your inbox. We emailed a secure sign-in link to <b>{email}</b>.
              Open it on this device to continue. The link works once and expires after an hour.
            </div>
            <p className="st-help">Didn’t get it? Check spam, or ask an administrator to confirm you’ve been invited.</p>
            <button className="st-btn" onClick={() => { setSent(false); setEmail(''); }}>Use a different email</button>
          </>
        ) : (
          <form onSubmit={send}>
            <p className="st-help" style={{ marginTop: 0 }}>
              Enter your email and we’ll send you a secure sign-in link. No password needed.
            </p>
            <label className="st-label">Email</label>
            <input
              className="st-input" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.org" autoFocus
            />
            {err && <div className="st-note err">{err}</div>}
            <button className="st-btn primary" style={{ marginTop: '.9rem', width: '100%' }} disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
      </div>
      <p className="st-help" style={{ textAlign: 'center' }}>
        Access is invite-only. If you need an account, contact an EBNEO administrator.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- list
function CommentaryList({ onOpen, onNew, role }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase
      .from('commentaries')
      .select('id,slug,title,status,needs_review,publish_date,updated_at')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setRows(data || []);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => (r.title + ' ' + r.slug).toLowerCase().includes(t));
  }, [rows, q]);

  return (
    <div>
      <div className="st-toolbar" style={{ marginBottom: '1rem' }}>
        <input
          className="st-input" style={{ maxWidth: 360 }} placeholder="Search commentaries…"
          value={q} onChange={(e) => setQ(e.target.value)}
        />
        <div className="st-spacer" />
        <button className="st-btn primary" onClick={onNew}>+ New commentary</button>
      </div>
      {err && <div className="st-note err">{err}</div>}
      {!rows && <div className="st-card">Loading…</div>}
      {rows && (
        <div className="st-card">
          <div className="st-help" style={{ marginBottom: '.4rem' }}>
            {filtered.length} of {rows.length} commentaries
          </div>
          {filtered.map((r) => (
            <div key={r.id} className="st-list-item" onClick={() => onOpen(r.id)}>
              <div>
                <div style={{ fontWeight: 600 }}>{r.title || '(untitled)'}</div>
                <div className="st-help">{r.slug} · {r.publish_date || 'no date'}</div>
              </div>
              <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                {r.needs_review && <span className="st-badge review">review</span>}
                <span className={`st-badge ${r.status}`}>{r.status}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="st-help">No matches.</div>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- editor
const EMPTY = {
  id: null, slug: '', title: '', publish_date: '', investigation: '',
  pmid: '', doi: '', reviewer_email: '', status: 'draft', needs_review: false,
  body: SCAFFOLD,
};

function Editor({ id, userId, onBack }) {
  const isNew = !id;
  const [row, setRow] = useState(isNew ? EMPTY : null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {kind,text}
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isNew) return;
    supabase.from('commentaries').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error) setMsg({ kind: 'err', text: error.message });
        else setRow(data);
      });
  }, [id]);

  function set(k, v) { setRow((r) => ({ ...r, [k]: v })); }

  // auto-suggest slug from title until the user edits the slug themselves
  function onTitle(v) {
    setRow((r) => ({ ...r, title: v, slug: slugTouched ? r.slug : slugify(v) }));
  }

  const present = useMemo(() => {
    const b = row?.body || '';
    return SECTIONS.reduce((acc, s) => { acc[s] = b.includes(`## ${s}`); return acc; }, {});
  }, [row?.body]);

  const previewHtml = useMemo(() => {
    try { return marked.parse(row?.body || ''); } catch { return ''; }
  }, [row?.body]);

  async function uploadFigure(file) {
    if (!file) return;
    setUploading(true); setMsg(null);
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-');
    const path = `${row.slug || 'unsorted'}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from(FIGURES_BUCKET).upload(path, file, {
      cacheControl: '3600', upsert: false,
    });
    if (error) { setUploading(false); setMsg({ kind: 'err', text: `Upload failed: ${error.message}` }); return; }
    const { data } = supabase.storage.from(FIGURES_BUCKET).getPublicUrl(path);
    const snippet = `\n\n![${safe}](${data.publicUrl})\n`;
    set('body', (row.body || '') + snippet);
    setUploading(false);
    setMsg({ kind: 'ok', text: 'Figure uploaded and added to the end of the text. Move it where you need it.' });
  }

  function validate() {
    if (!row.title.trim()) return 'Please add a title.';
    if (!row.slug.trim()) return 'Please add a web address (slug).';
    if (!/^[a-z0-9-]+$/.test(row.slug)) return 'The slug can only use lowercase letters, numbers and hyphens.';
    return null;
  }

  async function save(newStatus) {
    const problem = validate();
    if (problem) { setMsg({ kind: 'err', text: problem }); return; }
    setBusy(true); setMsg(null);
    const payload = {
      slug: row.slug.trim(), title: row.title.trim(),
      publish_date: row.publish_date || null,
      investigation: row.investigation || '', pmid: row.pmid || '',
      doi: row.doi || '', reviewer_email: row.reviewer_email || '',
      status: newStatus, needs_review: row.needs_review || false,
      body: row.body || '',
    };
    let error;
    if (isNew || !row.id) {
      payload.author_id = userId;
      ({ error } = await supabase.from('commentaries').insert(payload));
    } else {
      ({ error } = await supabase.from('commentaries').update(payload).eq('id', row.id));
    }
    setBusy(false);
    if (error) {
      const dup = error.code === '23505';
      setMsg({ kind: 'err', text: dup ? 'That slug is already used by another commentary. Choose a different one.' : error.message });
      return;
    }
    setMsg({
      kind: 'ok',
      text: newStatus === 'published'
        ? 'Published. Your page will appear on the live site after the next build (a minute or two).'
        : 'Draft saved.',
    });
    if (isNew) setTimeout(onBack, 900);
  }

  async function remove() {
    if (!row.id) return;
    if (!window.confirm('Delete this commentary? This cannot be undone.')) return;
    setBusy(true);
    const { error } = await supabase.from('commentaries').delete().eq('id', row.id);
    setBusy(false);
    if (error) setMsg({ kind: 'err', text: error.message });
    else onBack();
  }

  if (!row) return <div className="st-card">Loading…</div>;

  return (
    <div>
      <div className="st-toolbar" style={{ marginBottom: '1rem' }}>
        <button className="st-btn" onClick={onBack}>← Back to list</button>
        <div className="st-spacer" />
        <span className={`st-badge ${row.status}`}>{row.status}</span>
        <button className="st-btn" onClick={() => save('draft')} disabled={busy}>Save draft</button>
        <button className="st-btn primary" onClick={() => save('published')} disabled={busy}>Publish</button>
        {!isNew && <button className="st-btn danger" onClick={remove} disabled={busy}>Delete</button>}
      </div>

      {msg && <div className={`st-note ${msg.kind}`}>{msg.text}</div>}

      <div className="st-grid-edit">
        <div>
          <div className="st-card">
            <label className="st-label">Title</label>
            <input className="st-input" value={row.title} onChange={(e) => onTitle(e.target.value)} />

            <label className="st-label">Web address (slug)</label>
            <input
              className="st-input" value={row.slug}
              onChange={(e) => { setSlugTouched(true); set('slug', e.target.value); }}
            />
            <p className="st-help">
              This becomes ebneo.org/<b>{row.slug || 'your-slug'}</b>/.
              {!isNew && ' Changing it changes the page’s web address.'}
            </p>

            <div className="st-row">
              <div>
                <label className="st-label">Publish date</label>
                <input className="st-input" type="date" value={row.publish_date || ''} onChange={(e) => set('publish_date', e.target.value)} />
              </div>
              <div>
                <label className="st-label">Type of investigation</label>
                <input className="st-input" list="inv-list" value={row.investigation} onChange={(e) => set('investigation', e.target.value)} />
                <datalist id="inv-list">
                  {INVESTIGATION_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>
            <div className="st-row">
              <div>
                <label className="st-label">PMID</label>
                <input className="st-input" value={row.pmid} onChange={(e) => set('pmid', e.target.value)} />
              </div>
              <div>
                <label className="st-label">DOI</label>
                <input className="st-input" value={row.doi} onChange={(e) => set('doi', e.target.value)} />
              </div>
            </div>
            <label className="st-label">Reviewer email</label>
            <input className="st-input" value={row.reviewer_email} onChange={(e) => set('reviewer_email', e.target.value)} />

            <label className="st-label" style={{ marginTop: '.8rem' }}>
              <input type="checkbox" checked={row.needs_review} onChange={(e) => set('needs_review', e.target.checked)} style={{ marginRight: '.4rem' }} />
              Flag as “needs review”
            </label>
          </div>

          <div className="st-card">
            <label className="st-label">Commentary text</label>
            <p className="st-help" style={{ marginTop: 0 }}>
              Keep each section under its <code>## Heading</code>. The checklist shows the nine standard sections.
            </p>
            <div className="st-check">
              {SECTIONS.map((s) => (
                <span key={s} className={`st-chip ${present[s] ? 'on' : ''}`}>{present[s] ? '✓ ' : ''}{s}</span>
              ))}
            </div>
            <textarea className="st-textarea" value={row.body} onChange={(e) => set('body', e.target.value)} />
            <div className="st-toolbar" style={{ marginTop: '.6rem' }}>
              <label className="st-btn blue" style={{ margin: 0 }}>
                {uploading ? 'Uploading…' : '＋ Upload figure'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => uploadFigure(e.target.files?.[0])} disabled={uploading} />
              </label>
              <span className="st-help">Adds the image to the end of the text; move it where you need it.</span>
            </div>
          </div>
        </div>

        <div>
          <label className="st-label">Live preview</label>
          <div className="st-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          <p className="st-help">Preview is approximate; the live site styles it to match EBNEO.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- root
export default function StudioApp() {
  const [session, setSession] = useState(undefined); // undefined=loading
  const [editor, setEditor] = useState(undefined);   // undefined=unknown, null=not-editor, {role}
  const [view, setView] = useState({ name: 'list' });

  useEffect(() => {
    if (!supabaseConfigured) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setEditor(undefined); });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setEditor(session === null ? null : undefined); return; }
    supabase.from('editors').select('role').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setEditor(data || null));
  }, [session]);

  if (!supabaseConfigured) {
    return (
      <div className="st-wrap"><Styles />
        <div className="st-center"><div className="st-note err">
          Studio is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY and rebuild.
        </div></div>
      </div>
    );
  }

  if (session === undefined) return <div className="st-wrap"><Styles /><div className="st-center">Loading…</div></div>;
  if (!session) return <div className="st-wrap"><Styles /><Login /></div>;

  if (editor === undefined) return <div className="st-wrap"><Styles /><div className="st-center">Checking access…</div></div>;
  if (editor === null) {
    return (
      <div className="st-wrap"><Styles />
        <div className="st-center">
          <div className="st-note err">
            You’re signed in as <b>{session.user.email}</b>, but this address hasn’t been invited as an editor.
            Please contact an EBNEO administrator.
          </div>
          <button className="st-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="st-wrap"><Styles />
      <header className="st-header">
        <h1>EBNEO Studio</h1>
        <div className="who">
          <span>{session.user.email}{editor.role === 'admin' ? ' · admin' : ''}</span>
          <button className="st-btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>
      <main className="st-main">
        {view.name === 'list' && (
          <CommentaryList
            role={editor.role}
            onOpen={(id) => setView({ name: 'edit', id })}
            onNew={() => setView({ name: 'edit', id: null })}
          />
        )}
        {view.name === 'edit' && (
          <Editor id={view.id} userId={session.user.id} onBack={() => setView({ name: 'list' })} />
        )}
      </main>
    </div>
  );
}
