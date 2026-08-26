-- M0 0.4b — Facet ratings (ADR-009).
--
-- Fixed facets as an enum, not free text, because the whole point is the
-- aggregate: seeing that a film scores high on cinematography and low on
-- story is information a single average star can never carry.
--
-- Three constraints from the ADR that the schema has to hold up:
--   1. Facets are optional, the star rating is not. An entry with zero
--      facet rows is a valid entry.
--   2. Facets never feed into the star rating. No derivation, no average.
--   3. Facets aggregate separately, and only above a vote threshold.

create type public.facet_kind as enum (
  'acting',
  'story',
  'directing',
  'cinematography',
  'sound',
  'production_design',
  'pacing'
);

comment on type public.facet_kind is
  'Extending means a migration on the enum. Existing values are never removed '
  'or renamed, only retired (ADR-009).';

create table public.entry_facet_ratings (
  entry_id uuid not null references public.diary_entries (id) on delete cascade,
  facet    public.facet_kind not null,
  score    smallint not null check (score between 1 and 10),
  primary key (entry_id, facet)
);

create index facet_entry_idx on public.entry_facet_ratings (entry_id);

alter table public.entry_facet_ratings enable row level security;

-- Visibility follows the owning diary entry, evaluated against
-- diary_entries directly rather than duplicating the privacy rule.
create policy facet_follows_entry_read on public.entry_facet_ratings
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.diary_entries d
      where d.id = entry_facet_ratings.entry_id
        and (d.is_private = false or d.user_id = (select auth.uid()))
    )
  );

create policy facet_own_insert on public.entry_facet_ratings
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.diary_entries d
      where d.id = entry_facet_ratings.entry_id
        and d.user_id = (select auth.uid())
    )
  );

create policy facet_own_update on public.entry_facet_ratings
  for update to authenticated
  using (
    exists (
      select 1
      from public.diary_entries d
      where d.id = entry_facet_ratings.entry_id
        and d.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.diary_entries d
      where d.id = entry_facet_ratings.entry_id
        and d.user_id = (select auth.uid())
    )
  );

create policy facet_own_delete on public.entry_facet_ratings
  for delete to authenticated
  using (
    exists (
      select 1
      from public.diary_entries d
      where d.id = entry_facet_ratings.entry_id
        and d.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Aggregate. Materialized, refreshed by cron — never live per write.
-- ---------------------------------------------------------------------------

create materialized view public.film_facet_averages as
select d.film_id,
       f.facet,
       round(avg(f.score)::numeric, 2) as avg_score,
       count(*)                        as vote_count
from public.entry_facet_ratings f
join public.diary_entries d on d.id = f.entry_id
where d.is_private = false
group by d.film_id, f.facet
having count(*) >= 5;             -- vote threshold, see ADR-009

create unique index film_facet_averages_pk
  on public.film_facet_averages (film_id, facet);
create index film_facet_averages_film_idx
  on public.film_facet_averages (film_id);

-- A materialized view cannot carry RLS. This one is safe to expose
-- because it only ever contains aggregates over non-private entries,
-- suppressed below five votes, with no user_id in the output.
grant select on public.film_facet_averages to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled refresh. CONCURRENTLY needs the unique index above and keeps
-- reads unblocked during the rebuild.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_film_facet_averages()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  refresh materialized view concurrently public.film_facet_averages;
end;
$$;

revoke all on function public.refresh_film_facet_averages() from public, anon, authenticated;

-- pg_cron is not relocatable and is not part of core Postgres, so the
-- local schema harness runs without it. Guard the scheduling instead of
-- letting the migration hard-fail there; verify.sql check 8 catches a
-- Supabase project where the job did not get created.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    perform cron.schedule(
      'refresh-film-facet-averages',
      '17 * * * *',               -- hourly, off the hour to avoid pile-ups
      'select public.refresh_film_facet_averages()'
    );
  else
    raise notice
      'pg_cron unavailable: refresh the facet averages another way (see verify.sql check 8).';
  end if;
end;
$$;
