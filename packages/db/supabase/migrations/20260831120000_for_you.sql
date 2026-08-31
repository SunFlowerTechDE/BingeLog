-- "Fuer dich" (Entdecken-Konzept, 3).
--
-- Die einfache Fassung, die das Konzept fuer die erste Version
-- ausdruecklich vorsieht: aus den eigenen guten Bewertungen die Genres
-- ziehen und daraus Filme vorschlagen, die man noch nicht eingetragen
-- hat.
--
-- **Kein Match-Prozentsatz.** Das Konzept fuehrt ihn unter "Danach", und
-- eine Zahl wie "92 Prozent" behauptet eine Genauigkeit, die eine
-- Genre-Zaehlung nicht hat. Lieber keine Zahl als eine erfundene.
--
-- **Security invoker.** Die Funktion liest die Eintraege des Aufrufers
-- ueber `auth.uid()`; was sie sonst sieht, entscheidet die Policy. Eine
-- `definer`-Funktion koennte hier fremde Tagebuecher auswerten, ohne
-- dass es jemandem auffiele.
--
-- Wer noch kaum bewertet hat, bekommt eine leere Antwort. Die Ansicht
-- blendet den Bereich dann aus, statt ihn mit einem Hinweis zu fuellen —
-- so steht es in den Design-Hinweisen des Konzepts (19).

create or replace function public.films_for_me(max_results integer default 12)
returns table (
  wikidata_id    text,
  title_de       text,
  title_original text,
  release_year   integer,
  poster_source  text,
  poster_url     text,
  weight         integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with liked as (
    -- Ab 7 von 10, also ab 3,5 Popcorn. Darunter ist es kein Hinweis
    -- darauf, dass jemand mehr davon will.
    select d.film_id
    from public.diary_entries d
    where d.user_id = (select auth.uid())
      and d.rating >= 7
  ),
  taste as (
    select fg.genre_id, count(*)::integer as weight
    from public.film_genres fg
    join liked l on l.film_id = fg.film_id
    group by fg.genre_id
  ),
  seen as (
    select d.film_id from public.diary_entries d where d.user_id = (select auth.uid())
  ),
  candidates as (
    select
      fg.film_id,
      sum(t.weight)::integer as weight
    from public.film_genres fg
    join taste t on t.genre_id = fg.genre_id
    where fg.film_id not in (select film_id from seen)
    group by fg.film_id
  )
  select
    f.wikidata_id,
    f.title_de,
    f.title_original,
    f.release_year,
    f.poster_source,
    f.poster_url,
    c.weight
  from candidates c
  join public.films f on f.wikidata_id = c.film_id
  -- Bei gleichem Gewicht die bekannteren zuerst. `sitelink_count` ist
  -- das einzige Mass fuer Bekanntheit, das der Katalog kennt.
  order by c.weight desc, f.sitelink_count desc, f.wikidata_id
  limit greatest(1, least(max_results, 40));
$$;

comment on function public.films_for_me(integer) is
  'Entdecken-Konzept 3, einfache Fassung: Genres der eigenen gut bewerteten '
  'Filme, daraus Vorschlaege ohne eigenen Tagebucheintrag. Kein '
  'Match-Prozentsatz — eine Genre-Zaehlung traegt keine Prozentangabe. '
  'Security invoker: liest nur das eigene Tagebuch.';

grant execute on function public.films_for_me(integer) to authenticated;
