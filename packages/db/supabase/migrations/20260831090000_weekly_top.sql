-- Top 10 dieser Woche (M5, Entdecken).
--
-- Gezaehlt wird die laufende Kalenderwoche: Montag 00:00 bis Sonntag
-- 23:59, deutsche Zeit. Nicht "die letzten sieben Tage" — das waere ein
-- Fenster, das sich stuendlich verschiebt, und "diese Woche" heisst
-- dann jedes Mal etwas anderes. Montags faengt die Liste neu an.
--
-- **Europe/Berlin und nicht UTC.** Die Plattform ist fuer den
-- deutschsprachigen Raum. Waere die Grenze UTC, begaenne die Woche im
-- Sommer sonntags um 2 Uhr nachts. Absteigend. Kein
-- gewichteter Score, keine Beliebtheit aus dem Katalog, keine
-- Personalisierung: eine Rangliste, die fuer jeden Leser dieselbe ist,
-- ist eine Aussage ueber die Woche. Eine, die sich je Leser aendert,
-- ist keine.
--
-- **Nur oeffentliche Eintraege.** Das ist keine Ruecksicht auf die
-- Policy, sondern die Bedingung dafuer, dass die Liste ueberhaupt fuer
-- alle gleich sein kann: `security invoker` liesse jeden zusaetzlich
-- seine eigenen privaten Eintraege sehen, und der Zaehler waere
-- persoenlich. Also fallen sie hier heraus, ausdruecklich und nicht
-- durch die Policy.
--
-- Damit braucht die Funktion auch kein `security definer` — sie liest
-- nur, was ohnehin jeder lesen darf.

create or replace function public.weekly_top_films(max_results integer default 10)
returns table (
  place          integer,
  wikidata_id    text,
  title_de       text,
  title_original text,
  release_year   integer,
  poster_source  text,
  poster_url     text,
  ratings        integer,
  average        numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    row_number() over (
      order by count(*) desc, avg(d.rating) desc, f.wikidata_id
    )::integer as place,
    f.wikidata_id,
    f.title_de,
    f.title_original,
    f.release_year,
    f.poster_source,
    f.poster_url,
    count(*)::integer                  as ratings,
    round(avg(d.rating)::numeric, 1)   as average
  from public.diary_entries d
  join public.films f on f.wikidata_id = d.film_id
  where d.rating is not null
    and d.visibility = 'public'
    -- Der Wochenanfang in deutscher Zeit, zurueck als Zeitpunkt.
    -- `date_trunc('week', ...)` schneidet auf Montag 00:00 — das ist
    -- der ISO-Wochenanfang und in Postgres der einzige.
    and d.created_at >= (
      date_trunc('week', (now() at time zone 'Europe/Berlin')) at time zone 'Europe/Berlin'
    )
  group by
    f.wikidata_id, f.title_de, f.title_original,
    f.release_year, f.poster_source, f.poster_url
  -- Bei Gleichstand die besser bewerteten zuerst, und zuletzt die ID:
  -- ohne das dritte Kriterium waere die Reihenfolge zwischen zwei
  -- gleichen Filmen zufaellig, und die Liste saehe beim Neuladen anders
  -- aus, ohne dass sich etwas geaendert haette.
  order by count(*) desc, avg(d.rating) desc, f.wikidata_id
  limit greatest(1, least(max_results, 50));
$$;

comment on function public.weekly_top_films(integer) is
  'M5. Bewertungen der laufenden Kalenderwoche (Mo 00:00 bis So 23:59, '
  'Europe/Berlin), absteigend. Nur oeffentliche '
  'Eintraege, damit die Liste fuer jeden Leser dieselbe ist. '
  'Durchschnitt auf der internen Skala 1..10.';

grant execute on function public.weekly_top_films(integer) to anon, authenticated;

-- Die Rangliste liest je Aufruf alle Bewertungen der laufenden Woche.
-- `diary_feed_idx` sortiert nach created_at, deckt aber die Bedingung
-- "bewertet und oeffentlich" nicht ab.
create index if not exists diary_weekly_idx
  on public.diary_entries (created_at desc)
  where rating is not null and visibility = 'public';
