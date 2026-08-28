-- Der Feed und die Kacheln fuer Entdecken (M4 4.4).
--
-- **Kein algorithmischer Feed.** Chronologisch, vollstaendig,
-- nachvollziehbar. Die Roadmap nennt das ein Produktversprechen und
-- kein Implementierungsdetail, und die Funktion hier hat deshalb keine
-- Gewichtung, keine Beliebtheit und keine Auswahl: sie gibt zurueck, was
-- passiert ist, in der Reihenfolge, in der es passiert ist.
--
-- **Security invoker.** Was im Feed steht, entscheidet die Policy auf
-- `diary_entries`: oeffentlich sieht jeder, "nur fuer Freunde" nur bei
-- beidseitigem Folgen, privat niemand. Eine `security definer`-Funktion
-- wuerde diese Trennung aushebeln, und der Feed ist genau die Stelle, an
-- der das niemandem auffiele.

create or replace function public.following_feed(
  before_at timestamptz default null,
  before_id uuid        default null,
  max_results integer   default 20
)
returns table (
  id            uuid,
  created_at    timestamptz,
  rating        smallint,
  review        text,
  watched_on    date,
  is_rewatch    boolean,
  username      text,
  avatar_path   text,
  film_id       text,
  title_de      text,
  title_original text,
  release_year  integer,
  poster_source text,
  poster_url    text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    d.id,
    d.created_at,
    d.rating,
    d.review,
    d.watched_on,
    d.is_rewatch,
    p.username,
    p.avatar_path,
    f.wikidata_id,
    f.title_de,
    f.title_original,
    f.release_year,
    f.poster_source,
    f.poster_url
  from public.diary_entries d
  join public.profiles p on p.id = d.user_id
  join public.films f    on f.wikidata_id = d.film_id
  where d.user_id in (
          select fo.followee_id
            from public.follows fo
           where fo.follower_id = (select auth.uid())
        )
    -- Cursor statt Offset: mit Offset verschiebt jeder neue Eintrag
    -- waehrend des Blaetterns alles nach hinten, und man bekommt
    -- dieselbe Zeile zweimal oder gar nicht.
    and (
      before_at is null
      or (d.created_at, d.id) < (before_at, before_id)
    )
  order by d.created_at desc, d.id desc
  limit greatest(1, least(max_results, 50));
$$;

comment on function public.following_feed(timestamptz, uuid, integer) is
  'M4 4.4. Chronologisch und vollstaendig, ohne Gewichtung. Cursor auf '
  '(created_at, id). Security invoker — die Policy auf diary_entries '
  'entscheidet, was sichtbar ist.';

grant execute on function public.following_feed(timestamptz, uuid, integer) to authenticated;

-- Der Feed liest je Aufruf die Eintraege der gefolgten Profile in
-- zeitlicher Ordnung. Ohne diesen Index waere das ein Sortieren ueber
-- alles, was jemals eingetragen wurde.
create index if not exists diary_feed_idx
  on public.diary_entries (created_at desc, id desc);

-- --------------------------------------------------------------------
-- Die Genre-Kacheln
-- --------------------------------------------------------------------
--
-- Nach Anzahl der Filme, nicht alphabetisch: der Schieber zeigt zuerst,
-- wo etwas zu holen ist. Genres mit einem einzigen Film sind keine
-- Kachel wert — dahinter steht eine Seite mit einer Zeile.

create or replace function public.genre_tiles(max_results integer default 20)
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
  select
    g.wikidata_id,
    coalesce(g.label_de, g.label_en) as label,
    count(*)::integer                as films
  from public.film_genres fg
  join public.genres g on g.wikidata_id = fg.genre_id
  where coalesce(g.label_de, g.label_en) is not null
  group by g.wikidata_id, 2
  having count(*) >= 3
  order by count(*) desc, 2
  limit greatest(1, least(max_results, 40));
$$;

comment on function public.genre_tiles(integer) is
  'M4 4.4. Ab drei Filmen — eine Kachel, hinter der eine Zeile steht, '
  'ist ein gebrochenes Versprechen.';

grant execute on function public.genre_tiles(integer) to anon, authenticated;
