-- Die Profiluebersicht sagt auch, ob die Watchlist offen liegt.
--
-- Die Seite muss vor dem Nachladen wissen, ob sie ueberhaupt fragen
-- soll: bei einer privaten Watchlist gibt die Policy nichts heraus, und
-- eine leere Tafel mit der Ueberschrift "Watchlist" laese sich als
-- "hat nichts vorgemerkt" statt als "zeigt es nicht".
--
-- Der Rueckgabetyp waechst, also loeschen statt ersetzen. Das fuenfte
-- Mal in diesem Projekt.

drop function if exists public.profile_overview(text);

create function public.profile_overview(name text)
returns table (
  id               uuid,
  username         text,
  display_name     text,
  bio              text,
  avatar_path      text,
  banner_path      text,
  created_at       timestamptz,
  followers        integer,
  following        integer,
  watchlist_public boolean,
  is_me            boolean,
  i_follow         boolean,
  follows_me       boolean,
  blocked_me       boolean,
  i_blocked        boolean
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
    p.watchlist_public,
    p.id = (select auth.uid())                                                  as is_me,
    exists (
      select 1 from public.follows f
       where f.follower_id = (select auth.uid()) and f.followee_id = p.id
    )                                                                            as i_follow,
    exists (
      select 1 from public.follows f
       where f.follower_id = p.id and f.followee_id = (select auth.uid())
    )                                                                            as follows_me,
    public.blocked_by(p.id)                                                      as blocked_me,
    -- Und andersherum: habe ich blockiert? Der Knopf muss sagen koennen,
    -- was er tut, und "Blockieren" auf einem bereits blockierten Profil
    -- sagt das Falsche.
    public.blocks_me(p.id)                                                       as i_blocked
  from public.profiles p
  where p.username = lower(btrim(name));
$$;

comment on function public.profile_overview(text) is
  'M5 5.6. Kopfdaten eines Profils samt Beziehung zum Aufrufer, in beide '
  'Richtungen: blocked_me und i_blocked. Security invoker — die Policy auf '
  'profiles entscheidet, was sichtbar ist.';

grant execute on function public.profile_overview(text) to anon, authenticated;
