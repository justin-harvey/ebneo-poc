-- EBNEO headless CMS — S6: rosters + polls move into Supabase.
--
-- Consolidates the last two content stores into the single source of truth:
--   * roster_members  — the home-page Executive Board + Founders lists
--                       (were src/data/board.json / founders.json).
--   * polls           — the monthly Article-of-the-Month ballots
--                       (were src/content/polls/*.md).
--   * poll_tallies     — live runtime vote counts (were Netlify Blobs). Written
--                        by the /api/vote Netlify function via the service role.
--
-- Like commentaries, roster_members and polls are read at BUILD time via the
-- service role and materialized back to their original files, so the Astro
-- render pipeline (index/about/contact pages, vote.astro) is untouched.
-- poll_tallies is runtime state and is NOT materialized.

begin;

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type roster_group as enum ('board', 'founders');
exception when duplicate_object then null; end $$;

do $$ begin
  create type poll_status as enum ('open', 'closed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- roster_members: home-page people lists. Shape mirrors the JSON the site used.
-- ---------------------------------------------------------------------------
create table if not exists public.roster_members (
  id         uuid primary key default gen_random_uuid(),
  grp        roster_group not null,                 -- 'board' | 'founders'
  name       text not null,
  role       text not null default '',
  aff        text not null default '',              -- affiliation
  img        text not null default '',              -- /img/... path (optional)
  x          text not null default '',              -- X/Twitter handle (optional)
  linkedin   text not null default '',              -- LinkedIn slug (optional)
  sort_order int  not null default 0,               -- display order within a group
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.roster_members is
  'Executive Board + Founders lists for the home page. Materialized to src/data/*.json at build.';

create index if not exists roster_members_grp_sort_idx
  on public.roster_members (grp, sort_order);

-- ---------------------------------------------------------------------------
-- polls: one row per monthly ballot. `options` is the candidate-studies array
-- (array index is the stable vote id, matching the old CMS). `results` is the
-- optional frozen final tally baked into a closed poll's static render.
-- ---------------------------------------------------------------------------
create table if not exists public.polls (
  id         uuid primary key default gen_random_uuid(),
  month      text not null unique,                  -- "2026-11"; ballot key + sort
  question   text not null default 'Which study is most likely to impact neonatal care?',
  status     poll_status not null default 'open',
  options    jsonb not null default '[]'::jsonb,    -- [{title,authors,journal,date,url}]
  results    jsonb,                                 -- optional {"0":86,"1":54}
  body       text not null default '',              -- seed/intro copy under the frontmatter
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.polls is
  'Monthly Article-of-the-Month ballots. Materialized to src/content/polls/*.md at build.';
comment on column public.polls.options is
  'Ordered candidate studies; the array index is the permanent vote id. Do not reorder after voting opens.';

-- ---------------------------------------------------------------------------
-- poll_tallies: live vote counts, one row per month. Runtime state written by
-- the Netlify /api/vote function with the service role; never materialized and
-- never read by the browser directly. Replaces the Netlify Blobs store.
-- ---------------------------------------------------------------------------
create table if not exists public.poll_tallies (
  month      text primary key,                      -- "2026-11"
  tallies    jsonb not null default '{}'::jsonb,     -- { "0": 12, "1": 7, ... }
  updated_at timestamptz not null default now()
);

comment on table public.poll_tallies is
  'Live runtime vote tallies per month. Written only by the vote function (service role). Not materialized.';

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse public.set_updated_at() from 0001_init.sql)
-- ---------------------------------------------------------------------------
drop trigger if exists roster_members_set_updated_at on public.roster_members;
create trigger roster_members_set_updated_at
  before update on public.roster_members
  for each row execute function public.set_updated_at();

drop trigger if exists polls_set_updated_at on public.polls;
create trigger polls_set_updated_at
  before update on public.polls
  for each row execute function public.set_updated_at();

drop trigger if exists poll_tallies_set_updated_at on public.poll_tallies;
create trigger poll_tallies_set_updated_at
  before update on public.poll_tallies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--   * roster_members / polls: invited editors do everything; anon nothing
--     (the build reads via the service role, which bypasses RLS). Mirrors
--     the commentaries policy from 0001_init.sql, reusing public.is_editor().
--   * poll_tallies: RLS on, no policies => denies everyone. Only the service
--     role (the vote/results functions) touches it, bypassing RLS.
-- ---------------------------------------------------------------------------
alter table public.roster_members enable row level security;
alter table public.polls          enable row level security;
alter table public.poll_tallies   enable row level security;

drop policy if exists roster_members_editor_all on public.roster_members;
create policy roster_members_editor_all
  on public.roster_members
  for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists polls_editor_all on public.polls;
create policy polls_editor_all
  on public.polls
  for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

-- poll_tallies intentionally has no policies (deny-all under RLS).

-- ---------------------------------------------------------------------------
-- Any roster/poll change should rebuild the site, same as a commentary publish.
-- The 0003 trigger_deploy() keys on a `status='published'` column these tables
-- don't share (rosters have no status; a poll is 'open'/'closed'), so use a
-- status-agnostic variant that treats every change as deploy-worthy. It reuses
-- the same debounced deploy_control gate, so it is a safe no-op until the hook
-- URL is set and edit bursts still collapse to one build.
-- ---------------------------------------------------------------------------
create or replace function public.trigger_deploy_always()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dc public.deploy_control;
begin
  select * into dc from public.deploy_control where id = 1 for update;

  if dc.hook_url is null or dc.hook_url = '' then
    return coalesce(new, old); -- not configured yet; safe no-op
  end if;

  if dc.last_triggered_at is null
     or dc.last_triggered_at < now() - make_interval(secs => dc.debounce_seconds) then
    perform net.http_post(url => dc.hook_url, body => '{}'::jsonb);
    update public.deploy_control set last_triggered_at = now() where id = 1;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists roster_members_deploy on public.roster_members;
create trigger roster_members_deploy
  after insert or update or delete on public.roster_members
  for each row execute function public.trigger_deploy_always();

drop trigger if exists polls_deploy on public.polls;
create trigger polls_deploy
  after insert or update or delete on public.polls
  for each row execute function public.trigger_deploy_always();

commit;
