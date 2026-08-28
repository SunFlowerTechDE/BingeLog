-- Zwei Favoritenplaetze tauschen.
--
-- Der Primaerschluessel steht auf (user_id, position). Zwei einzelne
-- Updates verletzen ihn auf halbem Weg — der erste schreibt Platz zwei,
-- den es schon gibt. Also beide in einem Befehl, in einer Anweisung, in
-- einer Transaktion.
--
-- **Security invoker.** Die Funktion braucht keine erhoehten Rechte: sie
-- soll genau das duerfen, was der Aufrufer darf, und die Policy auf
-- `favourites` sorgt dafuer, dass das nur das eigene Profil ist. Eine
-- `security definer`-Funktion haette hier fremde Plaetze tauschen
-- koennen, sobald jemand den Filter vergisst.

create or replace function public.swap_favourites(a smallint, b smallint)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.favourites f
     set position = case f.position when a then b else a end
   where f.user_id = (select auth.uid())
     and f.position in (a, b);
$$;

comment on function public.swap_favourites(smallint, smallint) is
  'M4 4.2. Tauscht zwei der vier Plaetze in einer Anweisung. Security '
  'invoker: die Policy auf favourites entscheidet, wessen Plaetze das '
  'sind, nicht die Funktion.';

grant execute on function public.swap_favourites(smallint, smallint) to authenticated;
