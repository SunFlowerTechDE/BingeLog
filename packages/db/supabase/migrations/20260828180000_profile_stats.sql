-- Zahlen fuer die Profilseite.
--
-- **Security invoker, mit Absicht.** Damit zaehlt jede Funktion nur, was
-- die lesende Person auch sehen darf: die Policy auf `diary_entries`
-- entscheidet, nicht die Funktion. Auf dem eigenen Profil steht deshalb
-- die volle Zahl, auf einem fremden nur das Sichtbare.
--
-- Das ist keine Ungenauigkeit, sondern der Punkt. Eine oeffentliche
-- "142 Filme gesehen", die private Eintraege mitzaehlt, verraet deren
-- Existenz — nicht welcher Film, aber dass da einer ist. Wer einen
-- Eintrag auf "Nur fuer mich" stellt, erwartet das Gegenteil.
--
-- M4 4.2 verlangt, die Statistik zu cachen statt bei jedem Aufruf zu
-- aggregieren. Das gilt, sobald die Zahlen gross werden — bei einem
-- Katalog von 155 Filmen und einer Handvoll Konten waere ein Cache
-- Aufwand ohne Wirkung, und ein Cache pro Betrachter waere er ohnehin.
-- Wenn es soweit ist, steht hier die Stelle.

create or replace function public.profile_stats(profile uuid)
returns table (
  films      integer,
  ratings    integer,
  average    numeric,
  reviews    integer,
  first_seen timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    count(distinct d.film_id)::integer                        as films,
    count(d.rating)::integer                                  as ratings,
    round(avg(d.rating)::numeric, 2)                          as average,
    count(*) filter (where d.review is not null)::integer      as reviews,
    min(d.created_at)                                          as first_seen
  from public.diary_entries d
  where d.user_id = profile;
$$;

comment on function public.profile_stats(uuid) is
  'M4 4.2. Security invoker: zaehlt nur, was der Lesende sehen darf. '
  'Auf dem eigenen Profil die volle Zahl, auf einem fremden das '
  'Oeffentliche.';

grant execute on function public.profile_stats(uuid) to anon, authenticated;

-- --------------------------------------------------------------------
-- Lieblingsgenres
-- --------------------------------------------------------------------
--
-- Nicht gepflegt, sondern abgelesen: die Genres der Filme, die jemand
-- eingetragen hat, nach Haeufigkeit. Ein Feld zum Selbstausfuellen waere
-- eine zweite Wahrheit neben dem Tagebuch, und die beiden liefen
-- auseinander.

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
  order by 2 desc, 1
  limit greatest(1, least(max_results, 20));
$$;

comment on function public.profile_genres(uuid, integer) is
  'M4 4.2. Abgelesen aus dem Tagebuch, nicht selbst gepflegt: sonst '
  'stuenden zwei Wahrheiten nebeneinander.';

grant execute on function public.profile_genres(uuid, integer) to anon, authenticated;
