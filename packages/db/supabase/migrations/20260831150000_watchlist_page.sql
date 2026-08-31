-- Die Watchlist als Seite (Watchlist-Konzept, Prioritaet 1).
--
-- Eine Antwort statt vieler: die Seite sortiert nach Zugabedatum,
-- Bewertung, Jahr, Laufzeit und Titel, filtert nach Genre und Laufzeit
-- und markiert, was Freunde empfohlen haben. Jede dieser Angaben
-- einzeln nachzuladen waere eine Anfrage je Film und je Zeile.
--
-- **Gefiltert und sortiert wird im Client**, nicht hier. Eine Watchlist
-- hat Dutzende Eintraege, keine Hunderttausend; sie einmal zu holen und
-- dann ohne Netz umzusortieren ist schneller als jede Runde zum Server.
-- Sollte das je nicht mehr stimmen, ist das der Punkt, an dem es
-- umzudrehen waere.
--
-- Der Durchschnitt kommt aus `film_rating_summary` und nicht aus einer
-- eigenen Rechnung. Die Funktion ist `security definer`, damit die Zahl
-- fuer jeden Leser dieselbe ist — rechnete diese Funktion hier selbst,
-- saehe sie nur, was die Policy dem Aufrufer zeigt, und der
-- Durchschnitt haenge davon ab, mit wem man befreundet ist.

create or replace function public.watchlist_for_me()
returns table (
  film_id        text,
  title_de       text,
  title_original text,
  release_year   integer,
  runtime_min    integer,
  poster_source  text,
  poster_url     text,
  added_at       timestamptz,
  average        numeric,
  votes          integer,
  genre_ids      text[],
  genre_labels   text[],
  recommenders   integer,
  first_friend   text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    f.wikidata_id,
    f.title_de,
    f.title_original,
    f.release_year,
    f.runtime_min,
    f.poster_source,
    f.poster_url,
    w.added_at,
    s.average,
    coalesce(s.votes, 0),
    coalesce(g.ids, array[]::text[]),
    coalesce(g.labels, array[]::text[]),
    coalesce(r.anzahl, 0),
    r.wer
  from public.watchlist w
  join public.films f on f.wikidata_id = w.film_id
  cross join lateral public.film_rating_summary(f.wikidata_id) s
  left join lateral (
    select
      array_agg(ge.wikidata_id order by ge.wikidata_id) as ids,
      array_agg(coalesce(ge.label_de, ge.label_en) order by ge.wikidata_id) as labels
    from public.film_genres fg
    join public.genres ge on ge.wikidata_id = fg.genre_id
    where fg.film_id = f.wikidata_id
      and coalesce(ge.label_de, ge.label_en) is not null
  ) g on true
  -- Wer mir diesen Film empfohlen hat, und wie viele. Ausgeblendete
  -- zaehlen nicht mit: was ich weggewischt habe, soll nicht als
  -- Kennzeichnung wiederkommen.
  left join lateral (
    select
      count(*)::integer as anzahl,
      (
        select p.username
        from public.recommendations r2
        join public.profiles p on p.id = r2.from_user
        where r2.to_user = w.user_id
          and r2.film_id = f.wikidata_id
          and r2.dismissed_at is null
        order by r2.created_at desc
        limit 1
      ) as wer
    from public.recommendations r1
    where r1.to_user = w.user_id
      and r1.film_id = f.wikidata_id
      and r1.dismissed_at is null
  ) r on true
  where w.user_id = (select auth.uid())
  order by w.added_at desc;
$$;

comment on function public.watchlist_for_me() is
  'Watchlist-Konzept, Prioritaet 1. Die ganze eigene Watchlist mit allem, '
  'was die Seite zum Sortieren, Filtern und Kennzeichnen braucht. '
  'Sortiert und gefiltert wird im Client — eine Watchlist ist klein. '
  'Der Durchschnitt kommt aus film_rating_summary, damit er fuer jeden '
  'Leser derselbe ist.';

revoke execute on function public.watchlist_for_me() from public;
grant execute on function public.watchlist_for_me() to authenticated;
