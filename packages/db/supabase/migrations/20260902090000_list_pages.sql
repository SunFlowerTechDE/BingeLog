-- Die Listenseiten (M5 5.6).
--
-- Zwei Antworten statt vieler: eine Uebersicht mit Zahl und Vorschau je
-- Liste, und der Inhalt einer Liste mit den Filmspalten. Ohne die
-- Vorschau waere eine Uebersicht eine Reihe Titel ohne Bild, und ohne
-- die Zahl liesse sich "12 Filme" nur durch Nachladen jeder Liste
-- beantworten.
--
-- **Security invoker.** Welche Listen jemand sieht, entscheidet die
-- Policy auf `lists`: oeffentliche jeder, private nur der Eigner. Und
-- was in einer Liste steht, entscheidet `list_is_readable`. Beides
-- bleibt, wo es steht.

create or replace function public.lists_of(profile uuid)
returns table (
  id          uuid,
  title       text,
  description text,
  is_public   boolean,
  updated_at  timestamptz,
  films       integer,
  posters     text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    l.id,
    l.title,
    l.description,
    l.is_public,
    l.updated_at,
    coalesce(v.anzahl, 0) as films,
    coalesce(v.plakate, array[]::text[]) as posters
  from public.lists l
  left join lateral (
    select
      count(*)::integer as anzahl,
      -- Die ersten drei fuer die Vorschau. `wikidata_id` genuegt: die
      -- Adresse des Plakats baut der Client daraus ohnehin selbst.
      (array_agg(li.film_id order by li.ord, li.film_id))[1:3] as plakate
    from public.list_items li
    where li.list_id = l.id
  ) v on true
  where l.user_id = profile
  order by l.updated_at desc;
$$;

comment on function public.lists_of(uuid) is
  'M5 5.6. Die Listen eines Profils samt Zahl und drei Plakaten fuer die '
  'Vorschau. Security invoker — die Policy auf lists entscheidet, welche '
  'sichtbar sind.';

revoke execute on function public.lists_of(uuid) from public;
grant execute on function public.lists_of(uuid) to anon, authenticated;

create or replace function public.list_films(list uuid)
returns table (
  film_id        text,
  title_de       text,
  title_original text,
  release_year   integer,
  poster_source  text,
  poster_url     text,
  ord            integer,
  note           text
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
    f.poster_source,
    f.poster_url,
    li.ord,
    li.note
  from public.list_items li
  join public.films f on f.wikidata_id = li.film_id
  where li.list_id = list
  -- Die Reihenfolge ist Teil der Aussage: Platz eins heisst "damit
  -- faengst du an". Bei gleichem `ord` entscheidet die Id, damit die
  -- Liste beim Neuladen nicht springt.
  order by li.ord, li.film_id;
$$;

comment on function public.list_films(uuid) is
  'M5 5.6. Der Inhalt einer Liste in ihrer Reihenfolge. Security invoker — '
  'list_is_readable entscheidet ueber die Policy, ob ueberhaupt etwas '
  'zurueckkommt.';

revoke execute on function public.list_films(uuid) from public;
grant execute on function public.list_films(uuid) to anon, authenticated;
