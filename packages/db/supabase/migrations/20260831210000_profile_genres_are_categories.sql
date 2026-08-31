-- Die Lieblingsgenres eines Profils sind Kategorien (Suchkonzept, 26).
--
-- `profile_genres` zaehlte ueber `film_genres`, also ueber die
-- Rohbegriffe. Auf einem Profil stand dadurch "Kriminalfilm",
-- "Neo-Noir" und "Krimidrama" nebeneinander — dreimal dieselbe Vorliebe.
--
-- Und die Funktion gab nur die Beschriftung zurueck. Damit laesst sich
-- weder das Bild finden noch der kurze Name bilden, denn beides haengt
-- an der Wikidata-ID und ausdruecklich nicht am Text (ADR-003).
--
-- **Alles andere bleibt, wie es war**, und das ist der eigentliche
-- Punkt dieser Migration:
--
--   * Erst je Film verdichten, dann verbinden. Ohne das wird jeder
--     Eintrag mit den Genres verbunden — bei 3000 Eintraegen auf 59
--     Filmen zehntausende Zeilen, die gleich wieder zu drei Namen
--     zusammenfallen. Gemessen am 28.08.2026: 16,3 ms gegen 2,4 ms
--     (20260828310000).
--   * Ab zwei Filmen je Genre. Ein Film macht kein Lieblingsgenre.
--   * Bei Gleichstand entscheidet die eigene Bewertung.
--
-- Der Rueckgabetyp waechst um `genre_id`, also loeschen statt ersetzen.
-- Inzwischen das vierte Mal in diesem Projekt: `create or replace` kann
-- den Typ einer Funktion nicht aendern.

drop function if exists public.profile_genres(uuid, integer);

create function public.profile_genres(profile uuid, max_results integer default 5)
returns table (
  genre_id text,
  label    text,
  films    integer
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
    g.wikidata_id                    as genre_id,
    coalesce(g.label_de, g.label_en) as label,
    count(*)::integer                as films
  from je_film jf
  join public.film_categories fc on fc.film_id = jf.film_id
  join public.genres g           on g.wikidata_id = fc.category_id
  where coalesce(g.label_de, g.label_en) is not null
  group by g.wikidata_id, 2
  having count(*) >= 2
  order by count(*) desc, coalesce(avg(jf.note), 0) desc, 2
  limit greatest(1, least(max_results, 20));
$$;

comment on function public.profile_genres(uuid, integer) is
  'M4 4.2, auf Kategorien umgestellt. Abgelesen aus dem Tagebuch, nicht '
  'selbst gepflegt. Ab zwei Filmen je Kategorie, bei Gleichstand '
  'entscheidet die eigene Bewertung. Erst je Film verdichten, dann '
  'verbinden — siehe 20260828310000.';

grant execute on function public.profile_genres(uuid, integer) to anon, authenticated;
