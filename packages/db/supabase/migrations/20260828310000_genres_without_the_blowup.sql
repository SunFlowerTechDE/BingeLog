-- Die Genres ohne den aufgeblaehten Join.
--
-- Derselbe Fehler wie bei den Regisseuren (20260828300000), am selben
-- Tag gefunden: nachdem die Regisseure von 38 auf 3 ms fielen, war
-- `profile_genres` mit 16,3 ms die langsamste der sechs Auswertungen.
--
-- Auch hier wurde jeder **Eintrag** mit den Genres verbunden. Bei 3000
-- Eintraegen auf 59 Filmen entstehen daraus zehntausende Zeilen, die
-- gleich wieder zu drei Namen zusammenfallen.
--
-- Gemessen gegen dasselbe Tagebuch mit 3000 Eintraegen:
--
--   vorher   16,3 ms
--   nachher   2,4 ms
--
-- Die Regeln von 20260828200000 bleiben unangetastet: mindestens zwei
-- Filme je Genre, und bei Gleichstand entscheidet die eigene Bewertung.
-- Nur mittelt die jetzt ueber Filme statt ueber Eintraege — wer einen
-- Film zehnmal bewertet hat, zieht sein Genre nicht mehr zehnfach.

create or replace function public.profile_genres(profile uuid, max_results integer default 5)
returns table (
  label text,
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
    coalesce(g.label_de, g.label_en) as label,
    count(*)::integer                as films
  from je_film jf
  join public.film_genres fg on fg.film_id = jf.film_id
  join public.genres g       on g.wikidata_id = fg.genre_id
  where coalesce(g.label_de, g.label_en) is not null
  group by 1
  having count(*) >= 2
  order by count(*) desc, coalesce(avg(jf.note), 0) desc, 1
  limit greatest(1, least(max_results, 20));
$$;

comment on function public.profile_genres(uuid, integer) is
  'M4 4.2. Abgelesen aus dem Tagebuch, nicht selbst gepflegt. Ab zwei '
  'Filmen je Genre, bei Gleichstand entscheidet die eigene Bewertung. '
  'Erst je Film verdichten, dann verbinden — siehe 20260828310000.';
