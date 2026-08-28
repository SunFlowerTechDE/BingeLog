-- Die Zahlen zu einem Profil (M4 4.2).
--
-- Vier Auswertungen: Filme je Jahr, die Verteilung der Bewertungen, die
-- haeufigsten Regisseure, die haeufigsten Jahrzehnte.
--
-- **Security invoker, alle vier.** Sie lesen `diary_entries`, und was
-- dort sichtbar ist, entscheidet die Policy — nicht die Funktion. Eine
-- `security definer`-Funktion wuerde private Eintraege in eine
-- oeffentliche Zahl rechnen, und niemand saehe es der Zahl an. Dieselbe
-- Entscheidung wie bei `profile_stats` (20260828180000).
--
-- Was das kostet: die Zahlen unterscheiden sich je nachdem, wer fragt.
-- Der Besitzer sieht sieben Filme, ein Fremder vielleicht fuenf. Das ist
-- richtig so — die zwei privaten sind privat, auch als Strich in einem
-- Balken.

-- --------------------------------------------------------------------
-- Filme je Kalenderjahr
-- --------------------------------------------------------------------
--
-- Nach `watched_on`, nicht nach Erscheinungsjahr: die Frage ist "wieviel
-- habe ich 2026 gesehen", nicht "aus welchem Jahr". Eintraege ohne Datum
-- fallen heraus; sie gehoeren in kein Jahr, und sie auf das Jahr der
-- Eingabe zu legen waere geraten.

create or replace function public.profile_years(profile uuid)
returns table (
  year  integer,
  films integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    extract(year from d.watched_on)::integer  as year,
    count(distinct d.film_id)::integer        as films
  from public.diary_entries d
  where d.user_id = profile
    and d.watched_on is not null
  group by 1
  order by 1;
$$;

-- --------------------------------------------------------------------
-- Verteilung der Bewertungen
-- --------------------------------------------------------------------
--
-- Alle zehn Stufen kommen zurueck, auch die leeren. Eine Verteilung, die
-- nur ihre besetzten Stufen zeigt, sieht bei jedem gleich aus — die
-- Luecken sind die Aussage.

create or replace function public.profile_rating_spread(profile uuid)
returns table (
  rating numeric,
  films  integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    stufe.rating,
    coalesce(count(d.id), 0)::integer as films
  from generate_series(0.5, 5.0, 0.5) as stufe(rating)
  left join public.diary_entries d
    on d.user_id = profile
   and d.rating  = stufe.rating
  group by stufe.rating
  order by stufe.rating;
$$;

-- --------------------------------------------------------------------
-- Haeufigste Regisseure
-- --------------------------------------------------------------------
--
-- Ab zwei Filmen. Bei sieben Eintraegen hat sonst jeder Regisseur genau
-- einen, der Gleichstand faellt auf die Sortierung zurueck, und heraus
-- kommt eine Rangliste, die keine ist — derselbe Fehler wie bei den
-- Lieblingsgenres (20260828200000).

create or replace function public.profile_directors(profile uuid, max_results integer default 5)
returns table (
  name  text,
  films integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.name,
    count(distinct d.film_id)::integer as films
  from public.diary_entries d
  join public.film_credits c on c.film_id = d.film_id and c.role = 'director'
  join public.people p       on p.wikidata_id = c.person_id
  where d.user_id = profile
  group by p.wikidata_id, p.name
  having count(distinct d.film_id) >= 2
  order by count(distinct d.film_id) desc, coalesce(avg(d.rating), 0) desc, p.name
  limit greatest(1, least(max_results, 20));
$$;

-- --------------------------------------------------------------------
-- Haeufigste Jahrzehnte
-- --------------------------------------------------------------------

create or replace function public.profile_decades(profile uuid)
returns table (
  decade integer,
  films  integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (f.release_year / 10 * 10)::integer as decade,
    count(distinct d.film_id)::integer  as films
  from public.diary_entries d
  join public.films f on f.wikidata_id = d.film_id
  where d.user_id = profile
    and f.release_year is not null
  group by 1
  order by 1;
$$;

comment on function public.profile_years(uuid) is
  'M4 4.2. Nach watched_on. Security invoker: private Eintraege zaehlen '
  'nur fuer den, der sie sehen darf.';
comment on function public.profile_rating_spread(uuid) is
  'M4 4.2. Alle zehn Stufen, auch die leeren — die Luecken sind die Aussage.';
comment on function public.profile_directors(uuid, integer) is
  'M4 4.2. Ab zwei Filmen. Einer macht keinen Lieblingsregisseur.';
comment on function public.profile_decades(uuid) is
  'M4 4.2. Nach Erscheinungsjahr des Films, nicht nach Sehdatum.';

grant execute on function public.profile_years(uuid)                 to anon, authenticated;
grant execute on function public.profile_rating_spread(uuid)         to anon, authenticated;
grant execute on function public.profile_directors(uuid, integer)    to anon, authenticated;
grant execute on function public.profile_decades(uuid)               to anon, authenticated;
