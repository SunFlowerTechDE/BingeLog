-- M3 3.2 — search ranking.
--
-- This is the function the milestone singles out: "the place where
-- TheTVDB fails, here it is done better". Their title search ranks by
-- title similarity, which is why looking up Der dritte Mann returns a
-- documentary about it and looking up Die Wand returns Die Wanderhure.
--
-- The order of the terms below is the whole point, and it is the order
-- the roadmap specifies:
--
--   1. an exact title match beats everything
--   2. then trigram similarity
--   3. sitelink count as a relevance multiplier, never as the primary
--      sort (ADR-008)
--   4. release year as a weak tiebreaker
--
-- Why the multiplier must not lead: the catalog holds "Die Wand" (2012)
-- with 13 language versions and "Gegen die Wand" (2004) with 37. Sorting
-- by relevance alone hands back the wrong film with confidence.

create or replace function public.search_films(
  query        text,
  max_results  integer default 20
)
returns table (
  wikidata_id    text,
  title_de       text,
  title_original text,
  title_en       text,
  release_year   integer,
  runtime_min    integer,
  poster_source  text,
  poster_url     text,
  sitelink_count integer,
  director       text,
  score          real
)
language sql
stable
parallel safe
set search_path = public, extensions
as $$
  with input as (
    select lower(btrim(query)) as term
  ),
  candidates as (
    select f.*, i.term
    from public.films f, input i
    where length(i.term) >= 2
      and (
        -- Both forms ride the trigram index on the concatenated titles.
        public.film_search_text(f.title_de, f.title_original, f.title_en) ilike '%' || i.term || '%'
        or public.film_search_text(f.title_de, f.title_original, f.title_en) % i.term
      )
  ),
  scored as (
    select
      c.*,
      -- An exact match on any of the three titles. German first is not a
      -- preference here: all three count the same, the UI decides what to
      -- show.
      (lower(coalesce(c.title_de, '')) = c.term
        or lower(coalesce(c.title_original, '')) = c.term
        or lower(coalesce(c.title_en, '')) = c.term)::int as is_exact,
      (lower(coalesce(c.title_de, '')) like c.term || '%'
        or lower(coalesce(c.title_original, '')) like c.term || '%'
        or lower(coalesce(c.title_en, '')) like c.term || '%')::int as is_prefix,
      greatest(
        similarity(coalesce(c.title_de, ''), c.term),
        similarity(coalesce(c.title_original, ''), c.term),
        similarity(coalesce(c.title_en, ''), c.term)
      ) as trigram
    from candidates c
  )
  select
    s.wikidata_id,
    s.title_de,
    s.title_original,
    s.title_en,
    s.release_year,
    s.runtime_min,
    s.poster_source,
    s.poster_url,
    s.sitelink_count,
    (
      -- The roadmap asks for the director next to the title when several
      -- films share one, so it is part of the result rather than a second
      -- round trip per row.
      select p.name
      from public.film_credits fc
      join public.people p on p.wikidata_id = fc.person_id
      where fc.film_id = s.wikidata_id and fc.role = 'director'
      order by fc.ord nulls last
      limit 1
    ) as director,
    (
      (s.is_exact * 100 + s.is_prefix * 10 + s.trigram)
      -- Logarithmic, so a film with 60 language versions outranks one
      -- with two without a film with 600 flattening everything else.
      * (1 + ln(1 + s.sitelink_count) / 10)
      -- Weak enough that it only ever separates otherwise equal rows.
      + coalesce(s.release_year, 0) / 100000.0
    )::real as score
  from scored s
  order by score desc, s.sitelink_count desc, s.wikidata_id
  limit greatest(1, least(max_results, 100));
$$;

comment on function public.search_films(text, integer) is
  'M3 3.2. Ranking lives here, not in the client: the same query has to '
  'rank identically on web, iOS and Android.';

grant execute on function public.search_films(text, integer) to anon, authenticated;
