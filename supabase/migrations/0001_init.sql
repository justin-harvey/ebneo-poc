-- EBNEO headless CMS — initial schema (S0/S1)
-- Source of truth for commentary content + editor accounts.
-- Public site never queries this DB: content is baked to markdown at build time
-- using the service-role key (Netlify build env only). The admin SPA uses the
-- anon key + the editor JWT, gated by the RLS policies below.
--
-- Design notes:
--  * `investigation` is TEXT, not an enum. The legacy data is free-form (75
--    "Treatment" plus ~40 unique freeform values, including stray template
--    placeholders). Keeping it text guarantees byte-identical materialization
--    back to markdown (S2) and matches the current Astro z.string() schema.
--    Faceting continues to be handled at render time exactly as it is today.
--  * `status` IS an enum (draft/published). `needs_review` is a separate
--    optional flag, per the light review model decision (plan §3.4).

begin;

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type commentary_status as enum ('draft', 'published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type editor_role as enum ('editor', 'admin');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- editors: maps a Supabase Auth user to a CMS role. Invite-only (S3).
-- ---------------------------------------------------------------------------
create table if not exists public.editors (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  role       editor_role not null default 'editor',
  created_at timestamptz not null default now()
);

comment on table public.editors is
  'CMS editor accounts. One row per invited Supabase Auth user. Invite-only.';

-- ---------------------------------------------------------------------------
-- commentaries: the migrated archive + all future authored content.
-- ---------------------------------------------------------------------------
create table if not exists public.commentaries (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title          text not null,
  publish_date   date,
  investigation  text not null default '',
  pmid           text not null default '',
  doi            text not null default '',
  reviewer_email text not null default '',
  status         commentary_status not null default 'draft',
  needs_review   boolean not null default false,
  body           text not null default '',          -- 9-section markdown body
  author_id      uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.commentaries is
  'Commentary content. Slug is frozen and must match the live site 1:1.';
comment on column public.commentaries.investigation is
  'Free-form type-of-investigation text (not an enum). Drives render-time facets.';

create index if not exists commentaries_status_idx on public.commentaries (status);
create index if not exists commentaries_publish_date_idx on public.commentaries (publish_date);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists commentaries_set_updated_at on public.commentaries;
create trigger commentaries_set_updated_at
  before update on public.commentaries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper: is the current JWT an invited editor? (SECURITY DEFINER so the
-- policy check can read public.editors without needing its own RLS grant.)
-- ---------------------------------------------------------------------------
create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.editors e where e.id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.editors e where e.id = auth.uid() and e.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--   * anon role: no access at all (public site reads at build via service role,
--     which bypasses RLS).
--   * authenticated editors: full read/write on commentaries.
--   * editors table: an editor reads their own row; admins manage all rows.
-- S3 verifies/extends these; they are functional as written.
-- ---------------------------------------------------------------------------
alter table public.commentaries enable row level security;
alter table public.editors      enable row level security;

-- commentaries: editors do everything, nobody else does anything.
drop policy if exists commentaries_editor_all on public.commentaries;
create policy commentaries_editor_all
  on public.commentaries
  for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

-- editors: read own row.
drop policy if exists editors_read_self on public.editors;
create policy editors_read_self
  on public.editors
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- editors: admins manage the roster.
drop policy if exists editors_admin_write on public.editors;
create policy editors_admin_write
  on public.editors
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;
