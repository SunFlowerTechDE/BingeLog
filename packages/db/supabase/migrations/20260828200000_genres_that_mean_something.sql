-- Lieblingsgenres erst, wenn es welche gibt.
--
-- Die erste Fassung zaehlte Filme je Genre und sortierte absteigend. Bei
-- sieben Eintraegen hat fast jedes Genre die Anzahl eins, der
-- Gleichstand faellt auf die alphabetische Sortierung zurueck, und
-- heraus kommen die fuenf alphabetisch ersten:
--
--   "Lieblingsgenres: Abenteuerfilm, Actionfilm, Filmdrama,
--    Historienfilm, Monumentalfilm"
--
-- "Monumentalfilm" stand dort, weil Titanic so verschlagwortet ist. Eine
-- Aussage, die die Daten nicht hergeben — und die schlimmste Sorte
-- Statistik, weil sie sich nicht als Zufall zu erkennen gibt.
--
-- Zwei Aenderungen:
--
-- **Mindestens zwei Filme.** Ein einzelner Film macht kein Genre zum
-- Liebling. Wer noch nicht genug eingetragen hat, bekommt eine leere
-- Liste, und die Zeile verschwindet, statt etwas zu behaupten.
--
-- **Bei Gleichstand entscheidet die eigene Bewertung**, nicht das
-- Alphabet. Zwei Genres mit je drei Filmen: das mit den besseren Noten
-- steht vorn. Das ist das, wonach gefragt war.

create or replace function public.profile_genres(profile uuid, max_results integer default 5)
returns table (
  label text,
  films integer
)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(g.label_de, g.label_en)   as label,
    count(distinct d.film_id)::integer as films
  from public.diary_entries d
  join public.film_genres fg on fg.film_id = d.film_id
  join public.genres g       on g.wikidata_id = fg.genre_id
  where d.user_id = profile
    and coalesce(g.label_de, g.label_en) is not null
  group by 1
  having count(distinct d.film_id) >= 2
  order by
    count(distinct d.film_id) desc,
    coalesce(avg(d.rating), 0) desc,
    1
  limit greatest(1, least(max_results, 20));
$$;

comment on function public.profile_genres(uuid, integer) is
  'M4 4.2. Abgelesen aus dem Tagebuch, nicht selbst gepflegt. Ab zwei '
  'Filmen je Genre — ein einzelner macht kein Genre zum Liebling — und '
  'bei Gleichstand entscheidet die eigene Bewertung, nicht das Alphabet.';

grant execute on function public.profile_genres(uuid, integer) to anon, authenticated;
