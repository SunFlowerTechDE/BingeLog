-- M1 1.5 / M3 3.2 — lazy creation of missing films.
--
-- A search that finds nothing may pull the film from Wikidata. That
-- write happens in an edge function holding the service role, never in
-- the web app: apps/web has no way to write the catalog and the lint
-- config fails the build if the key appears there.
--
-- The rate limit lives here rather than in the function because an edge
-- function is stateless and there may be several of them running at
-- once. A counter in the database is the only place that sees them all.

create table public.lazy_creation_attempts (
  id         bigint generated always as identity primary key,
  term       text not null,
  found      integer not null default 0,
  created_at timestamptz not null default now()
);

create index lazy_attempts_recent_idx on public.lazy_creation_attempts (created_at desc);

comment on table public.lazy_creation_attempts is
  'One row per lookup against Wikidata, for rate limiting. Wikidata is a '
  'donated service and the roadmap asks for a few queries per minute at '
  'most (M1 1.5).';

alter table public.lazy_creation_attempts enable row level security;

-- No policies at all: only the service role touches this, and it bypasses
-- RLS. Nobody else needs to see what other people searched for.

/**
 * Records an attempt and says whether it was within the limit.
 *
 * Checking and recording in one statement, so two functions asking at
 * the same time cannot both be told yes.
 */
create or replace function public.claim_lazy_creation(search_term text, per_minute integer default 6)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  select count(*) into recent
  from public.lazy_creation_attempts a
  where a.created_at > now() - interval '1 minute';

  if recent >= per_minute then
    return false;
  end if;

  insert into public.lazy_creation_attempts (term) values (left(search_term, 200));
  return true;
end;
$$;

revoke all on function public.claim_lazy_creation(text, integer) from public, anon, authenticated;

/**
 * Housekeeping. The table is a rate-limit window, not a search log —
 * keeping what people looked for beyond that would be collecting
 * personal data for no purpose (ADR-007).
 */
create or replace function public.prune_lazy_creation_attempts()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.lazy_creation_attempts where created_at < now() - interval '1 hour';
$$;

revoke all on function public.prune_lazy_creation_attempts() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'prune-lazy-creation-attempts',
      '43 * * * *',
      'select public.prune_lazy_creation_attempts()'
    );
  else
    raise notice 'pg_cron unavailable: prune public.lazy_creation_attempts another way.';
  end if;
end;
$$;
