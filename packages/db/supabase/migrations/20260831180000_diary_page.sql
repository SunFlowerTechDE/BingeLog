-- Das Tagebuch als Seite (M5 5.4).
--
-- Eine Antwort statt vieler: die Seite gruppiert nach Monat, sucht nach
-- Titel, filtert nach Kategorie und Sichtbarkeit und sortiert nach
-- Datum oder Bewertung. Jede dieser Angaben einzeln nachzuladen waere
-- eine Anfrage je Zeile.
--
-- **Gefiltert und sortiert wird im Client**, wie bei der Watchlist. Ein
-- Tagebuch waechst zwar staerker als eine Merkliste, aber auch ein
-- eifriger Nutzer kommt auf wenige hundert Eintraege im Jahr. Sollte
-- das je nicht mehr stimmen, ist das der Punkt, an dem zu blaettern
-- waere.
--
-- **Nur die eigenen Eintraege.** Nicht, weil die Policy es sonst
-- durchliesse — sie tut es nicht —, sondern weil ein Tagebuch das
-- eigene ist. `auth.uid()` steht deshalb in der Abfrage und nicht bloss
-- in der Policy.

create or replace function public.diary_for_me()
returns table (
  id             uuid,
  film_id        text,
  title_de       text,
  title_original text,
  release_year   integer,
  runtime_min    integer,
  poster_source  text,
  poster_url     text,
  rating         smallint,
  review         text,
  watched_on     date,
  is_rewatch     boolean,
  visibility     public.entry_visibility,
  created_at     timestamptz,
  genre_ids      text[],
  genre_labels   text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    d.id,
    f.wikidata_id,
    f.title_de,
    f.title_original,
    f.release_year,
    f.runtime_min,
    f.poster_source,
    f.poster_url,
    d.rating,
    d.review,
    d.watched_on,
    d.is_rewatch,
    d.visibility,
    d.created_at,
    coalesce(g.ids, array[]::text[]),
    coalesce(g.labels, array[]::text[])
  from public.diary_entries d
  join public.films f on f.wikidata_id = d.film_id
  left join lateral (
    select
      array_agg(ge.wikidata_id order by ge.wikidata_id) as ids,
      array_agg(coalesce(ge.label_de, ge.label_en) order by ge.wikidata_id) as labels
    from public.film_categories fc
    join public.genres ge on ge.wikidata_id = fc.category_id
    where fc.film_id = f.wikidata_id
      and coalesce(ge.label_de, ge.label_en) is not null
  ) g on true
  where d.user_id = (select auth.uid())
  -- Ohne Sehdatum zaehlt der Zeitpunkt des Eintrags. Ein Eintrag ohne
  -- Datum ist kein Eintrag von 1970.
  order by coalesce(d.watched_on, d.created_at::date) desc, d.created_at desc;
$$;

comment on function public.diary_for_me() is
  'M5 5.4. Das ganze eigene Tagebuch mit allem, was die Seite zum '
  'Gruppieren, Filtern und Sortieren braucht. Genres als Kategorien. '
  'Sortiert und gefiltert wird im Client.';

revoke execute on function public.diary_for_me() from public;
grant execute on function public.diary_for_me() to authenticated;

-- --------------------------------------------------------------------
-- Ein paar Zahlen ueber das eigene Jahr
-- --------------------------------------------------------------------
--
-- Klein gehalten: das Tagebuch soll erzaehlen, was man gesehen hat, und
-- keine Auswertung sein. Was hier steht, beantwortet drei Fragen, die
-- man sich beim Aufschlagen stellt.

create or replace function public.diary_summary()
returns table (
  entries      integer,
  films        integer,
  this_year    integer,
  average      numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::integer                          as entries,
    count(distinct d.film_id)::integer         as films,
    count(*) filter (
      where extract(year from coalesce(d.watched_on, d.created_at::date))
          = extract(year from (now() at time zone 'Europe/Berlin'))
    )::integer                                 as this_year,
    round(avg(d.rating)::numeric, 2)           as average
  from public.diary_entries d
  where d.user_id = (select auth.uid());
$$;

comment on function public.diary_summary() is
  'M5 5.4. Eintraege, verschiedene Filme, dieses Jahr, Durchschnitt auf '
  'der internen Skala 1..10. Das Jahr in deutscher Zeit.';

revoke execute on function public.diary_summary() from public;
grant execute on function public.diary_summary() to authenticated;
