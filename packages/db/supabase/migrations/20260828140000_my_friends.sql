-- Wer meine Freunde sind, aus einer Hand.
--
-- `are_friends(a, b)` beantwortet die Frage fuer ein Paar und sitzt in
-- den Policies. Diese Funktion beantwortet sie fuer die eigene Person
-- und dient dem Filtern in der Oberflaeche. Beide meinen dasselbe:
-- beidseitiges Folgen. Sie stehen bewusst nebeneinander, statt dass die
-- Oberflaeche sich ihre eigene Vorstellung von Freundschaft baut.
--
-- security definer aus demselben Grund wie dort: die Antwort darf nicht
-- davon abhaengen, was der Lesende in `follows` sehen darf.

create or replace function public.my_friends()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select hin.followee_id
  from public.follows hin
  join public.follows zurueck
    on zurueck.follower_id = hin.followee_id
   and zurueck.followee_id = hin.follower_id
  where hin.follower_id = (select auth.uid());
$$;

comment on function public.my_friends() is
  'Die eigenen Freunde: beidseitiges Folgen. Leer fuer anonyme Zugriffe, '
  'was richtig ist — ohne Konto gibt es keine Freunde.';

grant execute on function public.my_friends() to anon, authenticated;
