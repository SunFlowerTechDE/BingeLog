-- M0 0.5 — Trigram search index.
--
-- Index only. The ranking, which blends trigram similarity with
-- sitelink_count as a relevance signal (ADR-008), belongs to M3.

-- pg_trgm lives in the extensions schema on Supabase; pin the path so
-- gin_trgm_ops resolves regardless of where it was installed.
set search_path = public, extensions;

create extension if not exists pg_trgm;

-- IMMUTABLE wrapper so the expression is indexable. Inlining the
-- concatenation directly works too, but a named function keeps the index
-- definition and any future query using it in sync.
create or replace function public.film_search_text(
  title_de       text,
  title_original text,
  title_en       text
)
returns text
language sql
immutable
parallel safe
as $$
  select coalesce(title_de, '') || ' ' ||
         coalesce(title_original, '') || ' ' ||
         coalesce(title_en, '');
$$;

create index films_title_trgm on public.films
  using gin (public.film_search_text(title_de, title_original, title_en) gin_trgm_ops);
