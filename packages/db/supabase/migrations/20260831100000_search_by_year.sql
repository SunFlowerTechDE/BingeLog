-- Die Suche laesst sich auf ein Jahr eingrenzen (M5).
--
-- Optional: ohne Angabe sucht sie wie bisher. Mit Angabe bleiben nur
-- Filme dieses Erscheinungsjahres uebrig — ein Filter, keine Gewichtung.
-- Wer das Jahr eintippt, weiss es, und ein Film aus einem anderen Jahr
-- ist dann kein schlechterer Treffer, sondern keiner.
--
-- Filme ohne Erscheinungsjahr fallen damit heraus, sobald ein Jahr
-- angegeben ist. Das ist richtig: unbekannt ist nicht 1994.
--
-- **Die alte Funktion wird geloescht, nicht daneben gestellt.** Ein
-- zusaetzlicher Parameter mit Vorgabewert erzeugt eine zweite Funktion
-- gleichen Namens, und ein Aufruf mit `query` und `max_results` passte
-- dann auf beide — Postgres antwortet darauf mit "function is not
-- unique", und die Suche waere im Web sofort kaputt. Nach dem Loeschen
-- gibt es genau eine, und der bisherige Aufruf trifft sie weiterhin.

drop function if exists public.search_films(text, integer);

create or replace function public.search_films(
  query        text,
  max_results  integer default 20,
  in_year      integer default null
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
      -- Das Jahr zuerst: es wirft die meisten Zeilen weg, bevor
      -- Aehnlichkeit ueberhaupt gerechnet wird.
      and (in_year is null or f.release_year = in_year)
      and (
        -- Enthalten-Sein weiterhin ueber die Verkettung: dafuer ist sie
        -- richtig, und der Index darauf traegt sie.
        public.film_search_text(f.title_de, f.title_original, f.title_en) ilike '%' || i.term || '%'
        -- Aehnlichkeit dagegen je Titel. NULL % text ergibt NULL und damit
        -- keinen Treffer, was fuer einen fehlenden Titel genau stimmt.
        or f.title_de % i.term
        or f.title_original % i.term
        or f.title_en % i.term
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

comment on function public.search_films(text, integer, integer) is
  'M3 3.2, um das Jahr erweitert in M5. Ranking lives here, not in the '
  'client: the same query has to rank identically on web, iOS and '
  'Android. Similarity is measured per title: across the concatenation '
  'it thins out until one missing letter costs the hit. in_year is an '
  'optional hard filter — a film from another year is not a worse hit, '
  'it is not a hit.';

grant execute on function public.search_films(text, integer, integer) to anon, authenticated;

-- Ohne Index waere das Jahr ein Durchgang durch die ganze Tabelle,
-- bevor die Titel ueberhaupt drankommen.
create index if not exists films_release_year_idx
  on public.films (release_year)
  where release_year is not null;
