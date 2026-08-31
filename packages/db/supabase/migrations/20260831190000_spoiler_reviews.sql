-- Rezensionen koennen Spoiler enthalten (Tagebuch-Konzept).
--
-- Bisher stand jede Rezension offen da — im Tagebuch, im Feed und unter
-- dem Film. Wer eine Rezension schreibt, in der das Ende vorkommt, hat
-- keine Moeglichkeit, das zu sagen.
--
-- **Das ist nicht das Spoiler-Gate.** Jenes schuetzt die Diskussion und
-- steht in der Policy auf `thread_messages` (ADR-010): dort entscheidet
-- Postgres, wer ueberhaupt etwas zu sehen bekommt. Hier geht es um
-- etwas anderes — der Text ist oeffentlich, sein Verfasser bittet nur
-- darum, ihn nicht ungefragt zu zeigen. Ein verdeckter Text ist kein
-- Zugriffsschutz und soll auch keiner sein; wer die Zeile ueber die API
-- liest, liest sie. Deshalb ist es ein Feld und keine Policy.
--
-- Voreinstellung false: die meisten Rezensionen spoilern nicht, und ein
-- Schalter, den man ausschalten muss, wird ausgeschaltet, ohne gelesen
-- zu werden.

alter table public.diary_entries
  add column has_spoilers boolean not null default false;

comment on column public.diary_entries.has_spoilers is
  'Vom Verfasser gesetzt. Die Oberflaeche verdeckt die Rezension dann, bis '
  'jemand tippt. Kein Zugriffsschutz — das Spoiler-Gate der Diskussion '
  'steht in der Policy auf thread_messages (ADR-010).';

-- --------------------------------------------------------------------
-- Durchreichen, wo Rezensionen stehen
-- --------------------------------------------------------------------

-- Der Rueckgabetyp waechst um `has_spoilers`, deshalb loeschen statt
-- ersetzen: `create or replace` kann den Typ nicht aendern und bricht
-- ab. Dieselbe Falle wie bei `search_films` und `weekly_top_films` —
-- inzwischen das dritte Mal, also steht sie hier noch einmal.
drop function if exists public.diary_for_me();

create function public.diary_for_me()
returns table (
  id             uuid,
  film_id        text,
  title_de       text,
  title_original text,
  release_year   integer,
  runtime_min    integer,
  poster_source  text,
  poster_url     text,
  rating         smallint,
  review         text,
  has_spoilers   boolean,
  watched_on     date,
  is_rewatch     boolean,
  visibility     public.entry_visibility,
  created_at     timestamptz,
  genre_ids      text[],
  genre_labels   text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    d.id,
    f.wikidata_id,
    f.title_de,
    f.title_original,
    f.release_year,
    f.runtime_min,
    f.poster_source,
    f.poster_url,
    d.rating,
    d.review,
    d.has_spoilers,
    d.watched_on,
    d.is_rewatch,
    d.visibility,
    d.created_at,
    coalesce(g.ids, array[]::text[]),
    coalesce(g.labels, array[]::text[])
  from public.diary_entries d
  join public.films f on f.wikidata_id = d.film_id
  left join lateral (
    select
      array_agg(ge.wikidata_id order by ge.wikidata_id) as ids,
      array_agg(coalesce(ge.label_de, ge.label_en) order by ge.wikidata_id) as labels
    from public.film_categories fc
    join public.genres ge on ge.wikidata_id = fc.category_id
    where fc.film_id = f.wikidata_id
      and coalesce(ge.label_de, ge.label_en) is not null
  ) g on true
  where d.user_id = (select auth.uid())
  order by coalesce(d.watched_on, d.created_at::date) desc, d.created_at desc;
$$;

revoke execute on function public.diary_for_me() from public;
grant execute on function public.diary_for_me() to authenticated;

-- Der Feed zeigt Rezensionen der gefolgten Profile. Dieselbe Bitte gilt
-- dort (Entdecken-Konzept, 6: keine offenen Spoiler im Feed).
drop function if exists public.following_feed(timestamptz, uuid, integer);

create function public.following_feed(
  before_at timestamptz default null,
  before_id uuid        default null,
  max_results integer   default 20
)
returns table (
  id            uuid,
  created_at    timestamptz,
  rating        smallint,
  review        text,
  has_spoilers  boolean,
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
    d.has_spoilers,
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
    and (
      before_at is null
      or (d.created_at, d.id) < (before_at, before_id)
    )
  order by d.created_at desc, d.id desc
  limit greatest(1, least(max_results, 50));
$$;

grant execute on function public.following_feed(timestamptz, uuid, integer) to authenticated;
