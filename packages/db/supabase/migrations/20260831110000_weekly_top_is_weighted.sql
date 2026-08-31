-- Die Wochenrangliste bekommt einen Score (Entdecken-Konzept, 4).
--
-- Bisher zaehlte die Zahl der Bewertungen, bei Gleichstand der
-- Durchschnitt. Das Problem daran steht im Konzept: ein Film mit einer
-- einzigen Bewertung von 5,0 steht sofort ganz oben, sobald er mit
-- einem anderen gleichauf liegt — und in einem jungen Katalog liegen
-- fast alle gleichauf, naemlich bei einer Bewertung.
--
-- Statt Zaehlung und Durchschnitt nebeneinander zu stellen, werden sie
-- verrechnet. Der Durchschnitt wird zum Mittelwert aller oeffentlichen
-- Bewertungen hin gezogen, und zwar umso staerker, je weniger Stimmen
-- ein Film hat:
--
--     score = (v / (v + m)) * eigener_schnitt
--           + (m / (v + m)) * gesamtschnitt
--
-- v ist die Zahl der Bewertungen dieser Woche, m die Schwelle aus der
-- Konfiguration. Bei v = m liegt der Film genau in der Mitte zwischen
-- seinem eigenen Schnitt und dem aller. Mit vielen Stimmen zaehlt fast
-- nur noch der eigene.
--
-- **Was der Score leistet und was nicht.** Er daempft den Vorteil
-- weniger Stimmen, er hebt ihn nicht auf: drei glatte Zehner koennen
-- weiterhin ueber zwanzig Neunern stehen, und das ist auch vertretbar.
-- Wirklich zugesichert ist zweierlei — unter der Schwelle steht ein Film
-- gar nicht in der Liste, und bei gleichem Durchschnitt steht der mit
-- mehr Stimmen oben. Alles darueber ist eine Abwaegung, keine Garantie.
-- Wer den Effekt staerker will, hebt `weekly_top_minimum` an; das ist
-- genau die Stellschraube dafuer.
--
-- **Die Schwelle steht in `app_settings`, nicht hier** — wie die der
-- Diskussion (…340000). Sie haengt an der Nutzerzahl und wird sich
-- aendern; eine Zahl im SQL braeuchte dafuer jedes Mal eine Migration.
--
-- Bewusst **nicht** im Score, obwohl das Konzept sie nennt: neue
-- Watchlist-Eintraege und Aufrufe. Aufrufe erhebt die Plattform
-- ueberhaupt nicht, und eine Mischung aus Bewertungen und Vormerkungen
-- laesst sich niemandem mehr erklaeren. Ein Rang, den man nicht
-- erklaeren kann, ist ein Rang, dem man nicht glaubt.
--
-- **Keine Einschraenkung auf deutsche Filme.** Das Konzept schlaegt eine
-- Deutschland-Ausrichtung vor; ausdruecklich verworfen am 31.08.2026.
-- Die Liste zaehlt, was die Leute hier bewertet haben, nicht wo der Film
-- herkommt. Falls jemand spaeter einen Herkunftsfilter erwaegt: das ist
-- diese Entscheidung, und sie wurde getroffen.

insert into public.app_settings (key, value, description)
values (
  'weekly_top_minimum',
  1,
  'Mindestzahl Bewertungen dieser Woche, damit ein Film in der Top 10 steht, '
  'und zugleich die Glaettungskonstante des Scores. Steht auf 1, weil der '
  'Katalog erst wenige Bewertungen hat — eine hoehere Schwelle liesse die '
  'Liste leer. Zum Start anheben.'
)
on conflict (key) do nothing;

-- Der Rueckgabetyp waechst um `score`, deshalb loeschen statt ersetzen.
-- Und die alte muss weg, nicht daneben stehen bleiben: zwei Funktionen
-- gleichen Namens machen jeden Aufruf mehrdeutig.
drop function if exists public.weekly_top_films(integer);

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
  average        numeric,
  score          numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with settings as (
    select greatest(1, coalesce(
      (select s.value from public.app_settings s where s.key = 'weekly_top_minimum'), 1
    )) as minimum
  ),
  week as (
    select
      d.film_id,
      count(*)::integer as votes,
      avg(d.rating)     as own_average
    from public.diary_entries d
    where d.rating is not null
      and d.visibility = 'public'
      and d.created_at >= (
        date_trunc('week', (now() at time zone 'Europe/Berlin')) at time zone 'Europe/Berlin'
      )
    group by d.film_id
  ),
  -- Der Mittelwert, zu dem hin gezogen wird. Ueber alles Oeffentliche
  -- und nicht nur ueber die Woche: eine Woche mit drei Bewertungen
  -- ergaebe sonst einen Mittelwert, der selbst Zufall ist.
  overall as (
    select coalesce(avg(d.rating), 5.5) as mean
    from public.diary_entries d
    where d.rating is not null
      and d.visibility = 'public'
  ),
  ranked as (
    select
      w.film_id,
      w.votes,
      round(w.own_average::numeric, 2) as average,
      round((
        (w.votes / (w.votes + s.minimum)::numeric) * w.own_average
        + (s.minimum / (w.votes + s.minimum)::numeric) * o.mean
      )::numeric, 4) as score
    from week w, settings s, overall o
    where w.votes >= s.minimum
  )
  select
    row_number() over (
      order by r.score desc, r.votes desc, r.film_id
    )::integer as place,
    f.wikidata_id,
    f.title_de,
    f.title_original,
    f.release_year,
    f.poster_source,
    f.poster_url,
    r.votes as ratings,
    r.average,
    r.score
  from ranked r
  join public.films f on f.wikidata_id = r.film_id
  order by r.score desc, r.votes desc, r.film_id
  limit greatest(1, least(max_results, 50));
$$;

comment on function public.weekly_top_films(integer) is
  'M5. Laufende Kalenderwoche (Mo 00:00 bis So 23:59, Europe/Berlin). Nur '
  'oeffentliche Bewertungen, damit die Liste fuer jeden Leser dieselbe ist. '
  'Der Score zieht den Durchschnitt zum Gesamtmittel, gewichtet mit der '
  'Stimmenzahl. Er daempft den Vorteil weniger Stimmen; dass eine einzelne '
  '5,0 gar nicht erst gelistet wird, leistet die Schwelle in '
  'app_settings.weekly_top_minimum. Keine Einschraenkung auf deutsche '
  'Filme (31.08.2026). average und score auf der internen Skala 1..10.';

grant execute on function public.weekly_top_films(integer) to anon, authenticated;
