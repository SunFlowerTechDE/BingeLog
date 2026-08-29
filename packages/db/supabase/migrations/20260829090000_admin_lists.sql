-- Listen fuer das Dashboard (M4 4.7).
--
-- Konten und Filme durchblaettern, sortieren, durchsuchen. Zwanzig je
-- Seite: genug, um etwas zu ueberblicken, wenig genug, um nicht zu
-- scrollen.
--
-- **Security definer mit Tuersteher, wie `admin_overview`.** Beide lesen
-- ueber alle Nutzer hinweg und muessen dafuer an der RLS vorbei. Die
-- Pruefung steht deshalb in der Funktion selbst — ohne sie waere das
-- eine Nutzerliste fuer jeden, der die Adresse kennt.
--
-- Sortiert wird nach einem **Namen aus einer festen Liste**, nicht nach
-- einem durchgereichten Ausdruck. Dynamisches SQL aus Nutzereingabe ist
-- der klassische Weg, sich eine Injektion einzubauen; hier kommt nur
-- durch, was hier steht.

create or replace function public.admin_users(
  such text default '',
  sortieren text default 'created_at',
  absteigend boolean default true,
  seite integer default 1
)
returns table (
  username     text,
  display_name text,
  avatar_path  text,
  created_at   timestamptz,
  closed_at    timestamptz,
  entries      integer,
  ratings      integer,
  reviews      integer,
  lists        integer,
  gesamt       integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  spalte text;
  richtung text := case when absteigend then 'desc' else 'asc' end;
  versatz integer := greatest(0, (greatest(seite, 1) - 1) * 20);
  muster text := '%' || btrim(coalesce(such, '')) || '%';
begin
  if not public.is_moderator() then
    return;
  end if;

  spalte := case sortieren
    when 'username'   then 'p.username'
    when 'created_at' then 'p.created_at'
    when 'entries'    then 'entries'
    when 'ratings'    then 'ratings'
    when 'reviews'    then 'reviews'
    when 'lists'      then 'lists'
    when 'closed_at'  then 'p.closed_at'
    else 'p.created_at'
  end;

  return query execute format($q$
    with gezaehlt as (
      select
        p.id, p.username, p.display_name, p.avatar_path, p.created_at, p.closed_at,
        (select count(*) from public.diary_entries d where d.user_id = p.id)::integer as entries,
        (select count(*) from public.diary_entries d
          where d.user_id = p.id and d.rating is not null)::integer as ratings,
        (select count(*) from public.diary_entries d
          where d.user_id = p.id and d.review is not null
            and length(btrim(d.review)) > 0)::integer as reviews,
        (select count(*) from public.lists l where l.user_id = p.id)::integer as lists
      from public.profiles p
      where $1 = '%%' or p.username ilike $1 or coalesce(p.display_name, '') ilike $1
    )
    select username, display_name, avatar_path, created_at, closed_at,
           entries, ratings, reviews, lists,
           (count(*) over ())::integer as gesamt
      from gezaehlt p
     order by %s %s nulls last, p.username
     limit 20 offset $2
  $q$, spalte, richtung) using muster, versatz;
end;
$$;

comment on function public.admin_users(text, text, boolean, integer) is
  'M4 4.7. Security definer — die is_moderator()-Pruefung steht in der '
  'Funktion. Sortierspalte aus einer festen Liste, nie aus der Eingabe.';

grant execute on function public.admin_users(text, text, boolean, integer) to authenticated;

-- --------------------------------------------------------------------

create or replace function public.admin_films(
  such text default '',
  sortieren text default 'entries',
  absteigend boolean default true,
  seite integer default 1
)
returns table (
  wikidata_id   text,
  title         text,
  release_year  integer,
  runtime_min   integer,
  fsk           smallint,
  poster_source text,
  poster_url    text,
  entries       integer,
  ratings       integer,
  avg_rating    numeric,
  manual        integer,
  edited_at     timestamptz,
  gesamt        integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  spalte text;
  richtung text := case when absteigend then 'desc' else 'asc' end;
  versatz integer := greatest(0, (greatest(seite, 1) - 1) * 20);
  muster text := '%' || btrim(coalesce(such, '')) || '%';
begin
  if not public.is_moderator() then
    return;
  end if;

  spalte := case sortieren
    when 'title'        then 'title'
    when 'release_year' then 'f.release_year'
    when 'fsk'          then 'f.fsk'
    when 'entries'      then 'entries'
    when 'ratings'      then 'ratings'
    when 'avg_rating'   then 'avg_rating'
    when 'edited_at'    then 'f.edited_at'
    else 'entries'
  end;

  return query execute format($q$
    with gezaehlt as (
      select
        f.wikidata_id,
        coalesce(f.title_de, f.title_original) as title,
        f.release_year, f.runtime_min, f.fsk, f.poster_source, f.poster_url,
        f.edited_at,
        coalesce(array_length(f.manual_fields, 1), 0) as manual,
        (select count(*) from public.diary_entries d
          where d.film_id = f.wikidata_id)::integer as entries,
        (select count(*) from public.diary_entries d
          where d.film_id = f.wikidata_id and d.rating is not null)::integer as ratings,
        (select round(avg(d.rating), 2) from public.diary_entries d
          where d.film_id = f.wikidata_id and d.rating is not null) as avg_rating
      from public.films f
      where $1 = '%%'
         or coalesce(f.title_de, '') ilike $1
         or f.title_original ilike $1
         or coalesce(f.title_en, '') ilike $1
    )
    select wikidata_id, title, release_year, runtime_min, fsk, poster_source, poster_url,
           entries, ratings, avg_rating, manual, edited_at,
           (count(*) over ())::integer as gesamt
      from gezaehlt f
     order by %s %s nulls last, title
     limit 20 offset $2
  $q$, spalte, richtung) using muster, versatz;
end;
$$;

comment on function public.admin_films(text, text, boolean, integer) is
  'M4 4.7. Wie admin_users. `manual` zaehlt die von Hand gesetzten '
  'Felder — sie folgen dem Wikidata-Import nicht mehr.';

grant execute on function public.admin_films(text, text, boolean, integer) to authenticated;
