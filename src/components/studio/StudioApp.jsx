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
.st-health{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;padding:.5rem 1.2rem;font-size:.82rem;border-bottom:1px solid #c7e7ac;background:#eef6e4;color:#3d6b17}
.st-health.down{background:#fdeaea;color:#a11;border-bottom-color:#f3c9c9}
.st-health.warn{background:#fdf3d8;color:#8a6100;border-bottom-color:#f0e0b0}
.st-health.checking{background:#eef2f5;color:#50606f;border-bottom-color:#e2e8ee}
.st-health .dot{width:10px;height:10px;border-radius:50%;flex:none;background:currentColor;box-shadow:0 0 0 3px rgba(0,0,0,.07)}
.st-health.checking .dot{animation:st-pulse 1s ease-in-out infinite}
@keyframes st-pulse{0%,100%{opacity:.3}50%{opacity:1}}
.st-health .lbl{font-weight:700}
.st-health .meta{opacity:.82}
.st-health .actions{margin-left:auto;display:flex;align-items:center;gap:.6rem}
.st-health .st-btn{padding:.35rem .75rem;font-size:.8rem}
.st-center{max-width:440px;margin:7vh auto;padding:0 1rem}
.st-toolbar{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
.st-spacer{flex:1}
a.st-link{color:${BRAND_BLUE}}
.st-tabs{display:flex;gap:.3rem;margin-bottom:1.2rem;border-bottom:1px solid #e2e8ee}
.st-tab{padding:.55rem 1rem;border:0;background:transparent;font-size:.92rem;font-weight:600;color:#6b7a88;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.st-tab:hover{color:#1a2b3c}
.st-tab.active{color:${BRAND_BLUE};border-bottom-color:${BRAND_BLUE}}
.st-member{display:flex;gap:.6rem;padding:.8rem 0;border-top:1px solid #eef2f5}
.st-member-move{display:flex;flex-direction:column;gap:.3rem;align-items:center}
.st-pos{font-size:.75rem;font-weight:700;color:#8795a2}
.st-member-fields{flex:1}
.st-info{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;margin-left:.3rem;border-radius:50%;background:#c3d2de;color:#2b4a63;font-size:.7rem;font-weight:700;cursor:help;position:relative;vertical-align:middle;line-height:1}
.st-info:hover,.st-info:focus{background:${BRAND_BLUE};color:#fff;outline:none}
.st-info .st-tip{display:none;position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:230px;background:#0b2239;color:#fff;font-size:.74rem;font-weight:400;line-height:1.35;text-transform:none;letter-spacing:normal;padding:.5rem .6rem;border-radius:7px;z-index:50;box-shadow:0 6px 20px rgba(0,0,0,.25);text-align:left}
.st-info:hover .st-tip,.st-info:focus .st-tip,.st-tab:focus-within .st-tip{display:block}
.st-info .st-tip::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#0b2239}
.st-tour-backdrop{position:fixed;inset:0;background:rgba(6,18,30,.55);z-index:1000}
.st-tour-ring{position:fixed;border:3px solid ${BRAND_GREEN};border-radius:10px;box-shadow:0 0 0 4px rgba(112,176,48,.35);z-index:1001;pointer-events:none;transition:all .18s ease}
.st-tour-card{position:fixed;z-index:1002;background:#fff;border-radius:12px;padding:1.1rem 1.2rem;box-shadow:0 18px 50px rgba(0,0,0,.35);width:340px;max-width:92vw}
.st-tour-card.center{top:50%;left:50%;transform:translate(-50%,-50%);width:400px}
.st-tour-card h3{margin:0 0 .4rem;color:${BRAND_BLUE};font-size:1.08rem}
.st-tour-card p{margin:0 0 .9rem;font-size:.9rem;line-height:1.5;color:#2b3b4b}
.st-tour-foot{display:flex;align-items:center;gap:.5rem}
.st-tour-step{font-size:.76rem;color:#8795a2;font-weight:600}
.st-tour-x{position:absolute;top:.5rem;right:.6rem;border:0;background:transparent;font-size:1.1rem;line-height:1;color:#8795a2;cursor:pointer}
.st-pagehelp{display:inline-flex;align-items:center;gap:.4rem;align-self:center;margin-bottom:.3rem;border:0;background:transparent;color:${BRAND_BLUE};font-size:.82rem;font-weight:600;cursor:pointer}
.st-pagehelp:hover{text-decoration:underline}
`;

function Styles() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

// A small "?" badge with a hover/focus tooltip. Dependency-free; used inline next
// to tab labels and non-obvious fields. tabIndex=-1 when nested inside another
// focusable control (the tabs), so it doesn't add a second tab stop.
function Info({ text, tabIndex = 0 }) {
  return (
    <span className="st-info" tabIndex={tabIndex} role="img" aria-label={`Help: ${text}`}>
      ?<span className="st-tip">{text}</span>
    </span>
  );
}

// ------------------------------------------------------------ db health bar
// EBNEO's data lives in a free-tier Supabase project, which pauses after 7 days
// with no activity. This bar does a cheap read to confirm the DB is awake, polls
// while Studio is open, and gives non-technical editors a one-click "Ping now"
// to wake/keep it alive before the pause window closes. (A GitHub Actions cron
// also pings every 3 days — see .github/workflows/supabase-keepalive.yml — this
// bar is the in-app, human-visible backstop.) No data is changed by a ping.
const DB_LAST_OK_KEY = 'ebneo_db_last_ok_v1';
const DB_POLL_MS = 60000;   // re-check once a minute while Studio is open
const DB_WARN_DAYS = 5;     // free tier pauses at 7 days idle; nudge before then

function agoLabel(ts) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function DbHealth() {
  const [status, setStatus] = useState('checking'); // checking | up | down
  const [latency, setLatency] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const [lastOk, setLastOk] = useState(() => {
    try { return Number(localStorage.getItem(DB_LAST_OK_KEY)) || null; } catch { return null; }
  });
  const [, force] = useState(0); // tick so the "x ago" labels stay fresh

  async function ping() {
    setStatus('checking');
    const t0 = performance.now();
    // HEAD + count: reaches the DB without transferring rows. Editors can read
    // commentaries (same table the list view uses), so this is always authorized.
    const { error } = await supabase
      .from('commentaries')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    setLatency(Math.round(performance.now() - t0));
    setCheckedAt(Date.now());
    if (error) {
      setStatus('down');
    } else {
      const now = Date.now();
      setStatus('up');
      setLastOk(now);
      try { localStorage.setItem(DB_LAST_OK_KEY, String(now)); } catch {}
    }
  }

  useEffect(() => {
    ping();
    const poll = setInterval(ping, DB_POLL_MS);
    const tick = setInterval(() => force((n) => n + 1), 15000);
    const onVis = () => { if (!document.hidden) ping(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(poll); clearInterval(tick); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const daysIdle = lastOk ? (Date.now() - lastOk) / 86400000 : null;
  const stale = status !== 'down' && daysIdle != null && daysIdle >= DB_WARN_DAYS;
  const cls = status === 'down' ? 'down' : stale ? 'warn' : status === 'checking' ? 'checking' : '';

  let label, detail;
  if (status === 'checking' && latency == null) {
    label = 'Checking database…'; detail = '';
  } else if (status === 'down') {
    label = 'Database unreachable';
    detail = 'The free-tier database may be paused or offline. Click “Ping now” — it can take ~30s to wake. If it stays red, contact your administrator.';
  } else if (stale) {
    label = 'Database healthy — but idle';
    detail = `Last confirmed ${agoLabel(lastOk)}. The free plan sleeps after 7 days unused; click “Ping now” to keep it awake.`;
  } else {
    label = 'Database healthy';
    detail = `Responded in ${latency} ms.`;
  }

  return (
    <div className={`st-health ${cls}`} role="status" aria-live="polite">
      <span className="dot" aria-hidden="true" />
      <span className="lbl">{label}</span>
      {detail && <span className="meta">{detail}</span>}
      <Info text="EBNEO’s data lives in a free database that goes to sleep after 7 days with no activity. This bar checks that it’s awake. If it turns red or says “idle,” click “Ping now” to wake it — nothing is changed." />
      <span className="actions">
        {checkedAt && <span className="meta">checked {agoLabel(checkedAt)}</span>}
        <button className="st-btn" onClick={ping} disabled={status === 'checking'}>
          {status === 'checking' ? 'Pinging…' : 'Ping now'}
        </button>
      </span>
    </div>
  );
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
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState(null);

  async function deployNow() {
    setDeploying(true); setDeployMsg(null);
    const { data, error } = await supabase.rpc('request_deploy');
    setDeploying(false);
    if (error) { setDeployMsg({ kind: 'err', text: error.message }); return; }
    setDeployMsg(
      data === 'triggered'
        ? { kind: 'ok', text: 'Rebuild started. The live site updates in a minute or two.' }
        : { kind: 'info', text: 'Automatic publishing isn’t switched on yet. Ask an administrator to add the Netlify build hook.' },
    );
  }

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
        <button className="st-btn" data-tour="deploy" onClick={deployNow} disabled={deploying} title="Rebuild the live site now">
          {deploying ? 'Starting…' : '↻ Deploy site now'}
        </button>
        <button className="st-btn primary" data-tour="new-commentary" onClick={onNew}>+ New commentary</button>
      </div>
      {deployMsg && <div className={`st-note ${deployMsg.kind}`}>{deployMsg.text}</div>}
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
    // Decide insert vs update purely on whether we already have a row id. After a
    // new doc's first save we capture the id below, so saving again updates it
    // (rather than re-inserting and hitting a duplicate-slug error).
    let error, inserted;
    if (!row.id) {
      payload.author_id = userId;
      ({ data: inserted, error } = await supabase
        .from('commentaries').insert(payload).select('id').single());
    } else {
      ({ error } = await supabase.from('commentaries').update(payload).eq('id', row.id));
    }
    setBusy(false);
    if (error) {
      const dup = error.code === '23505';
      setMsg({ kind: 'err', text: dup ? 'That slug is already used by another commentary. Choose a different one.' : error.message });
      return;
    }
    if (inserted?.id) { setRow((r) => ({ ...r, id: inserted.id })); setSlugTouched(true); }
    setMsg({
      kind: 'ok',
      text: newStatus === 'published'
        ? 'Published. A rebuild has started automatically; your page will be live on the site in a minute or two.'
        : 'Draft saved. Drafts are not shown on the public site until you publish.',
    });
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
        {row.id && <button className="st-btn danger" onClick={remove} disabled={busy}>Delete</button>}
      </div>

      {msg && <div className={`st-note ${msg.kind}`}>{msg.text}</div>}

      <div className="st-grid-edit">
        <div>
          <div className="st-card">
            <label className="st-label">Title</label>
            <input className="st-input" value={row.title} onChange={(e) => onTitle(e.target.value)} />

            <label className="st-label">Web address (slug)<Info text="The end of the page’s web address, e.g. ebneo.org/your-slug/. It’s filled in from the title automatically. Use only lowercase letters, numbers and hyphens. Changing it later changes the page’s link." /></label>
            <input
              className="st-input" value={row.slug}
              onChange={(e) => { setSlugTouched(true); set('slug', e.target.value); }}
            />
            <p className="st-help">
              This becomes ebneo.org/<b>{row.slug || 'your-slug'}</b>/.
              {row.id && ' Changing it changes the page’s web address.'}
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
              <Info text="A private note to your team that this commentary still needs a second look. It shows a “review” badge in this list but has no effect on the public site." />
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

// ---------------------------------------------------------------- shared field
function Field({ label, value, onChange, type = 'text', placeholder, list, help, info }) {
  return (
    <>
      <label className="st-label">{label}{info && <Info text={info} />}</label>
      <input
        className="st-input" type={type} list={list} value={value ?? ''}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      />
      {help && <p className="st-help">{help}</p>}
    </>
  );
}

// ---------------------------------------------------------------- rosters
const ROSTER_GROUPS = [
  { grp: 'board', label: 'Executive Board' },
  { grp: 'founders', label: 'Founders & Past Chairs' },
];

function RosterManager() {
  const [members, setMembers] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState(null);
  const [savingGrp, setSavingGrp] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  function load() {
    supabase.from('roster_members')
      .select('id,grp,name,role,aff,img,x,linkedin,sort_order')
      .order('grp', { ascending: true }).order('sort_order', { ascending: true })
      .then(({ data, error }) => { if (error) setErr(error.message); else setMembers(data || []); });
  }
  useEffect(load, []);

  const sorted = (grp) =>
    (members || []).filter((m) => m.grp === grp).sort((a, b) => a.sort_order - b.sort_order);

  const update = (id, k, v) => setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, [k]: v } : m)));

  function addMember(grp) {
    const id = `new-${Date.now()}-${Math.random()}`;
    setMembers((ms) => [...ms, { id, grp, name: '', role: '', aff: '', img: '', x: '', linkedin: '', sort_order: sorted(grp).length }]);
  }
  const removeMember = (id) => setMembers((ms) => ms.filter((m) => m.id !== id));

  function move(grp, idx, dir) {
    const list = sorted(grp);
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[idx], b = list[j];
    setMembers((ms) => ms.map((m) =>
      m.id === a.id ? { ...m, sort_order: j } : m.id === b.id ? { ...m, sort_order: idx } : m));
  }

  async function uploadPhoto(member, file) {
    if (!file) return;
    setUploadingId(member.id); setMsg(null);
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '-');
    const path = `roster/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from(FIGURES_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) { setUploadingId(null); setMsg({ kind: 'err', text: `Upload failed: ${error.message}` }); return; }
    const { data } = supabase.storage.from(FIGURES_BUCKET).getPublicUrl(path);
    update(member.id, 'img', data.publicUrl);
    setUploadingId(null);
  }

  async function saveGroup(grp) {
    const list = sorted(grp);
    if (list.some((m) => !m.name.trim())) { setMsg({ kind: 'err', text: 'Every person needs a name.' }); return; }
    setSavingGrp(grp); setMsg(null);
    const rows = list.map((m, i) => ({
      grp, name: m.name.trim(), role: m.role || '', aff: m.aff || '',
      img: m.img || '', x: m.x || '', linkedin: m.linkedin || '', sort_order: i,
    }));
    // Replace the whole group so order + removals always mirror what you see.
    const del = await supabase.from('roster_members').delete().eq('grp', grp);
    if (del.error) { setSavingGrp(null); setMsg({ kind: 'err', text: del.error.message }); return; }
    if (rows.length) {
      const ins = await supabase.from('roster_members').insert(rows);
      if (ins.error) { setSavingGrp(null); setMsg({ kind: 'err', text: ins.error.message }); return; }
    }
    setSavingGrp(null);
    const label = ROSTER_GROUPS.find((g) => g.grp === grp)?.label || grp;
    setMsg({ kind: 'ok', text: `Saved the ${label} list. A rebuild has started; the home page updates in a minute or two.` });
    load();
  }

  if (err) return <div className="st-note err">{err}</div>;
  if (!members) return <div className="st-card">Loading…</div>;

  return (
    <div>
      <div className="st-note info" style={{ marginTop: 0 }} data-tour="roster">
        <b>These are the people shown on the home page.</b> There are two separate lists below, each
        with its own <b>Save</b> button.
        <ol style={{ margin: '.4rem 0 0', paddingLeft: '1.2rem' }}>
          <li>Edit a person's details, or use <b>+ Add person</b> / <b>Remove</b>.</li>
          <li>Reorder with the <b>↑ / ↓</b> buttons on the left of each person (the <b>#</b> shows their position).</li>
          <li>Click that list's <b>Save</b> button. Each list saves on its own, so save whichever one you changed.</li>
        </ol>
      </div>
      {msg && <div className={`st-note ${msg.kind}`}>{msg.text}</div>}
      {ROSTER_GROUPS.map(({ grp, label }) => {
        const list = sorted(grp);
        return (
          <div key={grp} className="st-card">
            <div className="st-toolbar" style={{ marginBottom: '.6rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', color: BRAND_BLUE }}>{label}</h2>
              <span className="st-help">{list.length} people</span>
              <div className="st-spacer" />
              <button className="st-btn" onClick={() => addMember(grp)}>+ Add person</button>
              <button className="st-btn primary" onClick={() => saveGroup(grp)} disabled={savingGrp === grp}
                title={`Save only the ${label} list`}>
                {savingGrp === grp ? 'Saving…' : `Save ${label}`}
              </button>
            </div>
            {list.map((m, idx) => (
              <div key={m.id} className="st-member">
                <div className="st-member-move">
                  <button className="st-btn" onClick={() => move(grp, idx, -1)} disabled={idx === 0} title="Move up">↑</button>
                  <span className="st-pos" title="Position in this list">#{idx + 1}</span>
                  <button className="st-btn" onClick={() => move(grp, idx, 1)} disabled={idx === list.length - 1} title="Move down">↓</button>
                </div>
                <div className="st-member-fields">
                  <div className="st-row">
                    <Field label="Name" value={m.name} onChange={(v) => update(m.id, 'name', v)} />
                    <Field label="Role" value={m.role} onChange={(v) => update(m.id, 'role', v)} placeholder="e.g. Board Member" />
                  </div>
                  <Field label="Affiliation" value={m.aff} onChange={(v) => update(m.id, 'aff', v)} placeholder="Institution, Country" />
                  <div className="st-row">
                    <Field label="X / Twitter handle" value={m.x} onChange={(v) => update(m.id, 'x', v)} placeholder="(optional)" />
                    <Field label="LinkedIn slug" value={m.linkedin} onChange={(v) => update(m.id, 'linkedin', v)} placeholder="(optional)" />
                  </div>
                  <Field label="Photo path or URL" value={m.img} onChange={(v) => update(m.id, 'img', v)} placeholder="/img/name.jpg (optional)" />
                  <div className="st-toolbar" style={{ marginTop: '.4rem' }}>
                    <label className="st-btn blue" style={{ margin: 0 }}>
                      {uploadingId === m.id ? 'Uploading…' : '＋ Upload photo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={(e) => uploadPhoto(m, e.target.files?.[0])} disabled={uploadingId === m.id} />
                    </label>
                    <div className="st-spacer" />
                    <button className="st-btn danger" onClick={() => removeMember(m.id)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
            {list.length === 0 && <div className="st-help">No one in this list yet.</div>}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- polls
const EMPTY_OPTION = { title: '', authors: '', journal: '', date: '', url: '' };
const EMPTY_POLL = {
  id: null, month: '', question: 'Which study is most likely to impact neonatal care?',
  status: 'open', options: [{ ...EMPTY_OPTION }, { ...EMPTY_OPTION }], results: null, body: '',
};

function PollManager() {
  const [polls, setPolls] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null); // poll row being edited, or null
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    supabase.from('polls').select('*').order('month', { ascending: false })
      .then(({ data, error }) => { if (error) setErr(error.message); else setPolls(data || []); });
  }
  useEffect(load, []);

  function openNew() { setMsg(null); setEditing({ ...EMPTY_POLL, options: [{ ...EMPTY_OPTION }, { ...EMPTY_OPTION }] }); }
  function openEdit(p) { setMsg(null); setEditing(JSON.parse(JSON.stringify(p))); }

  const setField = (k, v) => setEditing((e) => ({ ...e, [k]: v }));
  const setOption = (i, k, v) =>
    setEditing((e) => ({ ...e, options: e.options.map((o, j) => (j === i ? { ...o, [k]: v } : o)) }));
  const addOption = () => setEditing((e) => ({ ...e, options: [...e.options, { ...EMPTY_OPTION }] }));
  const removeLastOption = () =>
    setEditing((e) => (e.options.length > 2 ? { ...e, options: e.options.slice(0, -1) } : e));

  function setResult(i, v) {
    setEditing((e) => {
      const results = { ...(e.results || {}) };
      if (v === '' || v == null) delete results[String(i)];
      else results[String(i)] = Number(v);
      return { ...e, results: Object.keys(results).length ? results : null };
    });
  }

  async function save() {
    const e = editing;
    if (!/^\d{4}-\d{2}$/.test(e.month)) { setMsg({ kind: 'err', text: 'Month must look like 2026-11.' }); return; }
    if (e.options.some((o) => !o.title.trim())) { setMsg({ kind: 'err', text: 'Every candidate study needs a title.' }); return; }
    setBusy(true); setMsg(null);
    const payload = {
      month: e.month.trim(), question: e.question || EMPTY_POLL.question, status: e.status,
      options: e.options.map((o) => ({
        title: o.title.trim(), authors: o.authors || '', journal: o.journal || '',
        date: o.date || '', url: o.url || '',
      })),
      results: e.status === 'closed' && e.results && Object.keys(e.results).length ? e.results : null,
      body: e.body || '',
    };
    // New poll => insert (a duplicate month errors instead of silently
    // overwriting an existing ballot). Existing poll => update by id.
    const { error } = e.id
      ? await supabase.from('polls').update(payload).eq('id', e.id)
      : await supabase.from('polls').insert(payload);
    setBusy(false);
    if (error) {
      setMsg({ kind: 'err', text: error.code === '23505' ? 'A poll already exists for that month. Open it from the list to edit it.' : error.message });
      return;
    }
    setMsg({ kind: 'ok', text: 'Poll saved. A rebuild has started; the Vote page updates in a minute or two.' });
    setEditing(null); load();
  }

  async function remove(p) {
    if (!window.confirm(`Delete the ${p.month} poll? This cannot be undone.`)) return;
    const { error } = await supabase.from('polls').delete().eq('id', p.id);
    if (error) { setMsg({ kind: 'err', text: error.message }); return; }
    setMsg({ kind: 'ok', text: `Deleted the ${p.month} poll.` });
    load();
  }

  if (err) return <div className="st-note err">{err}</div>;
  if (!polls) return <div className="st-card">Loading…</div>;

  if (editing) {
    const e = editing;
    return (
      <div>
        <div className="st-toolbar" style={{ marginBottom: '1rem' }}>
          <button className="st-btn" onClick={() => setEditing(null)}>← Back to polls</button>
          <div className="st-spacer" />
          <button className="st-btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save poll'}</button>
        </div>
        {msg && <div className={`st-note ${msg.kind}`}>{msg.text}</div>}
        <div className="st-card">
          <div className="st-row">
            <Field label="Ballot month" value={e.month} onChange={(v) => setField('month', v)} placeholder="2026-11"
              help="This is the ballot's key and sort order. One poll per month."
              info="Format YYYY-MM. Always use a FUTURE month when creating a new poll — never reuse the month that is currently live, or you’ll disturb the open ballot." />
            <div>
              <label className="st-label">Status<Info text="Only one poll should be “Open” at a time — that’s the live ballot on the Vote page. Set older ones to “Closed” to archive them." /></label>
              <select className="st-select" value={e.status} onChange={(ev) => setField('status', ev.target.value)}>
                <option value="open">Open (accepting votes)</option>
                <option value="closed">Closed (archived)</option>
              </select>
              <p className="st-help">Only one poll should be open at a time.</p>
            </div>
          </div>
          <Field label="Question" value={e.question} onChange={(v) => setField('question', v)} />
        </div>

        <div className="st-card">
          <div className="st-toolbar">
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: BRAND_BLUE }}>Candidate studies</h2>
            <div className="st-spacer" />
            <button className="st-btn" onClick={removeLastOption} disabled={e.options.length <= 2}>Remove last</button>
            <button className="st-btn" onClick={addOption}>+ Add study</button>
          </div>
          <div className="st-note info">
            The order of studies is permanent once voting opens, each study's position is its vote id.
            Add or remove from the end before the poll goes live; don't reorder afterwards.
          </div>
          {e.options.map((o, i) => (
            <div key={i} className="st-card" style={{ background: '#f8fafc' }}>
              <label className="st-label">Study {i + 1}</label>
              <Field label="Title" value={o.title} onChange={(v) => setOption(i, 'title', v)} />
              <div className="st-row">
                <Field label="Authors" value={o.authors} onChange={(v) => setOption(i, 'authors', v)} placeholder="Harris DL, et al." />
                <Field label="Journal" value={o.journal} onChange={(v) => setOption(i, 'journal', v)} placeholder="N Engl J Med" />
              </div>
              <div className="st-row">
                <Field label="Date / year" value={o.date} onChange={(v) => setOption(i, 'date', v)} placeholder="2026" />
                <Field label="Link (URL)" value={o.url} onChange={(v) => setOption(i, 'url', v)} placeholder="https://pubmed.ncbi.nlm.nih.gov/…" />
              </div>
              {e.status === 'closed' && (
                <Field label="Final vote count (optional)" type="number"
                  value={e.results?.[String(i)] ?? ''} onChange={(v) => setResult(i, v)}
                  help="Set these to freeze the final tally shown on the archived poll." />
              )}
            </div>
          ))}
        </div>

        <div className="st-card">
          <label className="st-label">Intro text (optional)</label>
          <p className="st-help" style={{ marginTop: 0 }}>Short note shown with the ballot. Plain text.</p>
          <textarea className="st-textarea" style={{ minHeight: 120 }} value={e.body}
            onChange={(ev) => setField('body', ev.target.value)} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="st-toolbar" style={{ marginBottom: '1rem' }}>
        <p className="st-help" style={{ margin: 0 }}>The newest open poll is the live ballot on the Vote page; the rest are archived.</p>
        <div className="st-spacer" />
        <button className="st-btn primary" data-tour="new-poll" onClick={openNew}>+ New poll</button>
      </div>
      {msg && <div className={`st-note ${msg.kind}`}>{msg.text}</div>}
      <div className="st-card">
        {polls.map((p) => (
          <div key={p.id} className="st-list-item">
            <div onClick={() => openEdit(p)} style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{p.month} · {p.question}</div>
              <div className="st-help">{p.options?.length || 0} studies{p.results ? ' · final tally frozen' : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
              <span className={`st-badge ${p.status === 'open' ? 'published' : 'draft'}`}>{p.status}</span>
              <button className="st-btn" onClick={() => openEdit(p)}>Edit</button>
              <button className="st-btn danger" onClick={() => remove(p)}>Delete</button>
            </div>
          </div>
        ))}
        {polls.length === 0 && <div className="st-help">No polls yet. Create the first ballot.</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- guided tour
const TOUR_KEY = 'ebneo_studio_tour_done_v1';

// Each step can set the tab it belongs to and (optionally) anchor to an element
// by CSS selector. Steps without a target are shown centered. Plain language —
// the editors are clinicians, not technical users.
const TOUR_STEPS = [
  {
    center: true,
    title: 'Welcome to EBNEO Studio',
    body: 'This is your private editing area. You got in with a one-time sign-in link sent to your email — no password to remember. Let’s take 30 seconds to walk through the three things you’ll do here. You can close this anytime and reopen it from the “Guide” button at the top right.',
  },
  {
    tab: 'commentaries', target: '[data-tour="tabs"]',
    title: 'Three sections',
    body: 'Everything lives under these three tabs: Commentaries (the article summaries), Board & Founders (the people shown on the home page), and Polls (the monthly vote).',
  },
  {
    tab: 'commentaries', target: '[data-tour="new-commentary"]',
    title: 'Write a commentary',
    body: 'Click “+ New commentary” to start one. You’ll get the nine standard sections already laid out — just fill them in and upload any figures. Use “Save draft” while you work; drafts stay hidden from the public.',
  },
  {
    tab: 'commentaries', target: '[data-tour="deploy"]',
    title: 'Publishing goes live on its own',
    body: 'When a commentary is ready, open it and click “Publish”. The live site rebuilds automatically and your page appears in a minute or two — you don’t touch any code. If you ever want to force a refresh, “↻ Deploy site now” does it.',
  },
  {
    tab: 'rosters', target: '[data-tour="roster"]',
    title: 'Two separate people lists',
    body: 'Board & Founders holds two independent lists — Executive Board and Founders & Past Chairs. Each list has its OWN Save button. Saving one list does not touch the other, so after you edit a list, save that same list.',
  },
  {
    tab: 'rosters', target: '[data-tour="roster"]',
    title: 'Reordering people',
    body: 'Use the ↑ / ↓ buttons to the left of each person to change the order; the # shows their position in the list. When you’re happy, click that list’s Save button to make it stick.',
  },
  {
    tab: 'polls', target: '[data-tour="new-poll"]',
    title: 'The monthly poll',
    body: 'The Polls tab lists every ballot. The newest “Open” poll is the live vote on the public site; older ones are “Closed” and archived. Only one poll should be open at a time.',
  },
  {
    tab: 'polls', target: '[data-tour="new-poll"]',
    title: 'Always set up a future month',
    body: 'Polls run one month at a time. To set up a ballot, click “+ New poll” and choose a FUTURE month (e.g. 2026-12). Never reuse the month that is currently live — always pick the next one, so you don’t disturb the open ballot people are voting in.',
  },
  {
    center: true,
    title: 'You’re all set',
    body: 'That’s the tour. Watch for the small “?” icons beside fields for quick hints, and reopen this walkthrough anytime from the “Guide” button. Happy editing!',
  },
];

function Tour({ steps, step, onNext, onPrev, onClose, goTo }) {
  const s = steps[step];
  const [rect, setRect] = useState(null);
  const last = step === steps.length - 1;

  useEffect(() => {
    if (s.tab) goTo(s.tab);
    setRect(null);
    if (s.center || !s.target) return;
    // The target may not exist yet (tab just switched, data still loading).
    // Poll a few animation frames before giving up and showing a centered card.
    let raf, tries = 0;
    const find = () => {
      const el = document.querySelector(s.target);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setRect(el.getBoundingClientRect());
      } else if (tries++ < 30) {
        raf = requestAnimationFrame(find);
      }
    };
    raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    function reflow() {
      if (s.center || !s.target) return;
      const el = document.querySelector(s.target);
      if (el) setRect(el.getBoundingClientRect());
    }
    window.addEventListener('resize', reflow);
    return () => window.removeEventListener('resize', reflow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const centered = s.center || !rect;
  let cardStyle = {};
  if (!centered) {
    const below = rect.bottom + 320 < window.innerHeight;
    const top = below ? rect.bottom + 12 : Math.max(12, rect.top - 300);
    const left = Math.min(Math.max(rect.left, 12), window.innerWidth - 352);
    cardStyle = { top, left };
  }

  return (
    <div className="st-tour-backdrop" onClick={onClose}>
      {!centered && (
        <div className="st-tour-ring" style={{
          top: rect.top - 6, left: rect.left - 6,
          width: rect.width + 12, height: rect.height + 12,
        }} />
      )}
      <div
        className={`st-tour-card${centered ? ' center' : ''}`}
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="st-tour-x" onClick={onClose} aria-label="Close the guide">×</button>
        <h3>{s.title}</h3>
        <p>{s.body}</p>
        <div className="st-tour-foot">
          <span className="st-tour-step">Step {step + 1} of {steps.length}</span>
          <div className="st-spacer" />
          {step > 0 && <button className="st-btn" onClick={onPrev}>Back</button>}
          {last
            ? <button className="st-btn primary" onClick={onClose}>Done</button>
            : <button className="st-btn primary" onClick={onNext}>Next</button>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- root
export default function StudioApp() {
  const [session, setSession] = useState(undefined); // undefined=loading
  const [editor, setEditor] = useState(undefined);   // undefined=unknown, null=not-editor, {role}
  const [tab, setTab] = useState('commentaries');    // commentaries | rosters | polls
  const [view, setView] = useState({ name: 'list' });
  const [tour, setTour] = useState(null);            // null=closed, else { steps, i }

  // Tour navigation: jump to a tab and reset to its list so anchored elements exist.
  function goTo(t) { setTab(t); setView({ name: 'list' }); }
  // Full walkthrough (header "Guide" button + first-run): every step.
  function startTour() { goTo('commentaries'); setTour({ steps: TOUR_STEPS, i: 0 }); }
  // Contextual help: only the steps for the tab you're on right now.
  function startPageTour() {
    const steps = TOUR_STEPS.filter((s) => s.tab === tab);
    if (steps.length) setTour({ steps, i: 0 });
  }
  function endTour() { setTour(null); try { localStorage.setItem(TOUR_KEY, '1'); } catch {} }

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

  // Show the walkthrough automatically the first time a real editor signs in.
  useEffect(() => {
    if (!editor) return;
    let done = false;
    try { done = localStorage.getItem(TOUR_KEY) === '1'; } catch {}
    if (!done) setTour({ steps: TOUR_STEPS, i: 0 });
  }, [editor]);

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
          <button className="st-btn ghost" onClick={startTour} title="Replay the guided walkthrough">❔ Guide</button>
          <button className="st-btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>
      <DbHealth />
      <main className="st-main">
        <div className="st-tabs" data-tour="tabs">
          {[
            { id: 'commentaries', label: 'Commentaries', tip: 'The article summaries. Create, edit, and publish commentaries here.' },
            { id: 'rosters', label: 'Board & Founders', tip: 'The two lists of people shown on the home page. Each list saves on its own.' },
            { id: 'polls', label: 'Polls', tip: 'The monthly study vote. One ballot per month; set up the next month ahead of time.' },
          ].map((t) => (
            <button
              key={t.id}
              className={`st-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => { setTab(t.id); setView({ name: 'list' }); }}
            >
              {t.label}<Info text={t.tip} tabIndex={-1} />
            </button>
          ))}
          <div className="st-spacer" />
          <button
            className="st-pagehelp"
            onClick={startPageTour}
            title="Walk me through this page"
          >
            <span className="st-info" aria-hidden="true" style={{ marginLeft: 0 }}>?</span>
            How this page works
          </button>
        </div>

        {tab === 'commentaries' && view.name === 'list' && (
          <CommentaryList
            role={editor.role}
            onOpen={(id) => setView({ name: 'edit', id })}
            onNew={() => setView({ name: 'edit', id: null })}
          />
        )}
        {tab === 'commentaries' && view.name === 'edit' && (
          <Editor id={view.id} userId={session.user.id} onBack={() => setView({ name: 'list' })} />
        )}
        {tab === 'rosters' && <RosterManager />}
        {tab === 'polls' && <PollManager />}
      </main>
      {tour && (
        <Tour
          steps={tour.steps}
          step={tour.i}
          goTo={goTo}
          onNext={() => setTour((t) => ({ ...t, i: Math.min(t.i + 1, t.steps.length - 1) }))}
          onPrev={() => setTour((t) => ({ ...t, i: Math.max(t.i - 1, 0) }))}
          onClose={endTour}
        />
      )}
    </div>
  );
}
