-- EBNEO CMS — publish -> rebuild pipeline (plan S5)
--
-- When published content changes, POST a Netlify Build Hook so the static site
-- rebuilds (the build's materialize step then bakes the new content). Debounced so
-- a burst of edits doesn't trigger a stampede of builds. Pure SQL via pg_net; no
-- Edge Function or CLI needed.
--
-- The build hook URL is stored in deploy_control (single row), locked by RLS so it
-- is never readable by the browser; only the SECURITY DEFINER functions below touch
-- it. Set it once with:
--   update public.deploy_control set hook_url = 'https://api.netlify.com/build_hooks/XXXX' where id = 1;
-- Until it is set, the trigger is a safe no-op.

begin;

create extension if not exists pg_net;

create table if not exists public.deploy_control (
  id               int primary key default 1,
  hook_url         text,
  last_triggered_at timestamptz,
  debounce_seconds int not null default 60,
  constraint deploy_control_singleton check (id = 1)
);

insert into public.deploy_control (id, hook_url, debounce_seconds)
values (1, null, 60)
on conflict (id) do nothing;

-- Locked down: no anon/authenticated access. Only service role + the SECURITY
-- DEFINER functions below (which bypass RLS) can read the hook URL.
alter table public.deploy_control enable row level security;

-- ---------------------------------------------------------------------------
-- Debounced trigger: fire the build hook when the published set could change.
-- ---------------------------------------------------------------------------
create or replace function public.trigger_deploy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dc public.deploy_control;
  affects boolean := false;
begin
  if tg_op = 'INSERT' then
    affects := (new.status = 'published');
  elsif tg_op = 'UPDATE' then
    affects := (new.status = 'published' or old.status = 'published');
  elsif tg_op = 'DELETE' then
    affects := (old.status = 'published');
  end if;

  if not affects then
    return coalesce(new, old);
  end if;

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

drop trigger if exists commentaries_deploy on public.commentaries;
create trigger commentaries_deploy
  after insert or update or delete on public.commentaries
  for each row execute function public.trigger_deploy();

-- ---------------------------------------------------------------------------
-- Manual "Deploy now" for editors (bypasses the debounce window on purpose:
-- it is an explicit human action, e.g. "my page didn't show up yet").
-- ---------------------------------------------------------------------------
create or replace function public.request_deploy()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  dc public.deploy_control;
begin
  if not public.is_editor() then
    raise exception 'not authorized';
  end if;

  select * into dc from public.deploy_control where id = 1 for update;
  if dc.hook_url is null or dc.hook_url = '' then
    return 'not_configured';
  end if;

  perform net.http_post(url => dc.hook_url, body => '{}'::jsonb);
  update public.deploy_control set last_triggered_at = now() where id = 1;
  return 'triggered';
end;
$$;

revoke all on function public.request_deploy() from public;
grant execute on function public.request_deploy() to authenticated;

commit;
