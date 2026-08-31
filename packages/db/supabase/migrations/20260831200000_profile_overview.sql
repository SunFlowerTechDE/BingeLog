-- Der Kopf eines Profils (M5 5.6).
--
-- Wer ist das, wie viele folgen ihm, folgt er zurueck, folge ich, und
-- hat er mich blockiert. Fuenf Fragen, die jede Profilseite beim
-- Aufschlagen stellt — als eine Antwort statt als fuenf Anfragen.
--
-- **Security invoker.** Was `profiles` hergibt, entscheidet die Policy
-- dort; die Zaehlungen auf `follows` sind oeffentlich. Eine
-- `definer`-Funktion braeuchte es nur, wenn sie mehr zeigen sollte als
-- der Lesende sehen darf, und genau das soll sie nicht.
--
-- `blocked_by` sagt, ob **dieses** Profil den Aufrufer blockiert hat.
-- Die Seite zeigt dann kein Folgen-Knopf und keine Eintraege — die
-- Policy gibt ohnehin nichts heraus, aber ein Knopf, der ins Leere
-- greift, ist schlechter als keiner.

create or replace function public.profile_overview(name text)
returns table (
  id            uuid,
  username      text,
  display_name  text,
  bio           text,
  avatar_path   text,
  banner_path   text,
  created_at    timestamptz,
  followers     integer,
  following     integer,
  is_me         boolean,
  i_follow      boolean,
  follows_me    boolean,
  blocked_me    boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_path,
    p.banner_path,
    p.created_at,
    (select count(*)::integer from public.follows f where f.followee_id = p.id) as followers,
    (select count(*)::integer from public.follows f where f.follower_id = p.id) as following,
    p.id = (select auth.uid())                                                  as is_me,
    exists (
      select 1 from public.follows f
       where f.follower_id = (select auth.uid()) and f.followee_id = p.id
    )                                                                            as i_follow,
    exists (
      select 1 from public.follows f
       where f.follower_id = p.id and f.followee_id = (select auth.uid())
    )                                                                            as follows_me,
    public.blocked_by(p.id)                                                      as blocked_me
  from public.profiles p
  where p.username = lower(btrim(name));
$$;

comment on function public.profile_overview(text) is
  'M5 5.6. Kopfdaten eines Profils samt Beziehung zum Aufrufer. Security '
  'invoker — die Policy auf profiles entscheidet, was sichtbar ist.';

grant execute on function public.profile_overview(text) to anon, authenticated;

-- --------------------------------------------------------------------
-- Die vier Favoriten
-- --------------------------------------------------------------------
--
-- Als eigene Funktion, weil die Filmspalten dazugehoeren: vier Plaetze
-- und vier Plakate, sonst ist es keine Auswahl, sondern eine Liste von
-- Bezeichnern.

create or replace function public.profile_favourites(profile uuid)
returns table (
  -- `slot` und nicht `position`: letzteres ist in Postgres ein
  -- reserviertes Wort (`position(x in y)`) und laesst sich in
  -- `returns table` nicht als Spaltenname verwenden.
  slot           smallint,
  wikidata_id    text,
  title_de       text,
  title_original text,
  release_year   integer,
  poster_source  text,
  poster_url     text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    fv.position,
    f.wikidata_id,
    f.title_de,
    f.title_original,
    f.release_year,
    f.poster_source,
    f.poster_url
  from public.favourites fv
  join public.films f on f.wikidata_id = fv.film_id
  where fv.user_id = profile
  order by fv.position;
$$;

comment on function public.profile_favourites(uuid) is
  'M4 4.3 / M5 5.6. Vier Plaetze, in ihrer Reihenfolge — Platz eins ist '
  'Platz eins.';

grant execute on function public.profile_favourites(uuid) to anon, authenticated;
