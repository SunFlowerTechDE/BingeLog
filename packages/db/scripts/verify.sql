-- M0 Definition of Done — schema-side checks.
--
-- Run against the linked project:
--   supabase db execute --file packages/db/scripts/verify.sql
-- or paste into the SQL editor. Every block must report ok = true.

\echo '== 1. Every table in public has RLS enabled =='
select
  coalesce(bool_and(c.relrowsecurity), false) as ok,
  count(*) filter (where not c.relrowsecurity) as tables_without_rls,
  array_agg(c.relname order by c.relname) filter (where not c.relrowsecurity) as offenders
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r';

\echo '== 2. Catalog tables carry SELECT policies only =='
select
  count(*) = 0 as ok,
  array_agg(tablename || ':' || policyname || ':' || cmd) as offenders
from pg_policies
where schemaname = 'public'
  and tablename in ('films', 'people', 'film_credits', 'genres', 'film_genres')
  and cmd <> 'SELECT';

\echo '== 3. thread_messages has no policy granting anon anything =='
select
  count(*) = 0 as ok,
  array_agg(policyname) as offenders
from pg_policies
where schemaname = 'public'
  and tablename = 'thread_messages'
  and 'anon' = any(roles);

\echo '== 4. facet_kind enum holds exactly the seven facets of ADR-009 =='
select
  array_agg(e.enumlabel order by e.enumsortorder) =
    array['acting', 'story', 'directing', 'cinematography',
          'sound', 'production_design', 'pacing']::text[] as ok,
  array_agg(e.enumlabel order by e.enumsortorder) as actual
from pg_enum e
join pg_type t on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public' and t.typname = 'facet_kind';

\echo '== 5. Materialized view exists and is refreshable =='
select
  count(*) = 1 as ok
from pg_matviews
where schemaname = 'public' and matviewname = 'film_facet_averages';

select public.refresh_film_facet_averages();

\echo '== 6. Trigram index on the film titles is in place =='
select
  count(*) = 1 as ok
from pg_indexes
where schemaname = 'public' and indexname = 'films_title_trgm';

\echo '== 7. Facet aggregate never exposes entries below the vote threshold =='
select
  coalesce(min(vote_count) >= 5, true) as ok,
  min(vote_count) as lowest
from public.film_facet_averages;

\echo '== 8. Cron job for the facet refresh is scheduled =='
select
  count(*) = 1 as ok,
  max(schedule) as schedule
from cron.job
where jobname = 'refresh-film-facet-averages';
