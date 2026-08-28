-- Die Regisseure ohne den aufgeblaehten Join.
--
-- Gemessen am 28.08.2026 gegen ein Tagebuch mit 3000 Eintraegen:
--
--   vorher   38,3 ms Median, 18603 Puffer
--   nachher   3,2 ms Median,    76 Puffer
--
-- Die erste Fassung verband jeden **Eintrag** mit den Credits. Bei 3000
-- Eintraegen auf 59 Filmen entstanden daraus zehntausende Zeilen, die
-- gleich wieder zu einer Handvoll Namen zusammenfielen. Die Arbeit lag
-- nicht im Zaehlen, sondern im Aufblaehen davor.
--
-- Jetzt wird zuerst je **Film** verdichtet und dann verbunden. Aus 3000
-- Zeilen werden 59, bevor die Credits ins Spiel kommen.
--
-- Ein Unterschied in der Bedeutung, der beabsichtigt ist: die Note eines
-- Regisseurs mittelt jetzt ueber Filme, nicht ueber Eintraege. Wer einen
-- Film zehnmal gesehen und jedesmal bewertet hat, zieht seinen
-- Regisseur nicht mehr zehnfach ins Gewicht. Fuer die Frage "welchen
-- Regisseur mag ich lieber" ist das die richtige Rechnung.
--
-- Kein Cache. Bei dieser Groesse waere er ein Haltbarkeitsproblem ohne
-- Gegenwert: die Leitung nach Frankfurt kostet rund 14 ms, alle vier
-- Auswertungen zusammen unter 5. Wenn die Summe je in den Bereich der
-- Leitung kommt, ist der Zeitpunkt da — und dann mit einer
-- materialisierten Sicht wie bei den Facetten, nicht mit einem
-- Zwischenspeicher in der Anwendung.

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
  with je_film as (
    select d.film_id, avg(d.rating) as note
      from public.diary_entries d
     where d.user_id = profile
     group by d.film_id
  )
  select
    p.name,
    count(*)::integer as films
  from je_film jf
  join public.film_credits c on c.film_id = jf.film_id and c.role = 'director'
  join public.people p       on p.wikidata_id = c.person_id
  group by p.wikidata_id, p.name
  having count(*) >= 2
  order by count(*) desc, coalesce(avg(jf.note), 0) desc, p.name
  limit greatest(1, least(max_results, 20));
$$;

comment on function public.profile_directors(uuid, integer) is
  'M4 4.2. Ab zwei Filmen — einer macht keinen Lieblingsregisseur. Erst '
  'je Film verdichten, dann verbinden: der umgekehrte Weg kostete bei '
  '3000 Eintraegen das Zwoelffache.';
