-- Die Watchlist darf oeffentlich sein — wenn man das einstellt.
--
-- Bisher war sie strikt privat. Zwei Schalter statt einem:
--
--   `profiles.watchlist_public`  gilt fuer die ganze Liste
--   `watchlist.is_hidden`        gilt fuer einen einzelnen Titel
--
-- Beide zusammen, weil sie verschiedene Fragen beantworten. Der eine
-- entscheidet, ob jemand ueberhaupt hineinsieht. Der andere haelt
-- einzelne Titel heraus, auch wenn die Liste offen ist — ein Geschenk,
-- eine Peinlichkeit, etwas, das niemanden angeht.
--
-- **Voreinstellung bleibt privat.** Wer eine Liste angelegt hat, als sie
-- nicht sichtbar war, hat sie unter dieser Annahme gefuellt. Eine
-- Umstellung, die vorhandene Daten oeffnet, waere ein Wortbruch.

alter table public.profiles
  add column watchlist_public boolean not null default false;

comment on column public.profiles.watchlist_public is
  'Ob Fremde die Watchlist sehen duerfen. Standard: nein.';

alter table public.watchlist
  add column is_hidden boolean not null default false;

comment on column public.watchlist.is_hidden is
  'Einzelner Titel, der auch bei offener Liste verborgen bleibt.';

-- security definer aus demselben Grund wie bei are_friends(): die
-- Sichtbarkeit fremder Zeilen darf nicht davon abhaengen, was der
-- Lesende in `profiles` sehen darf, sonst haengt die Regel an der Regel,
-- die sie schuetzen soll.
create or replace function public.watchlist_is_public(profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.watchlist_public from public.profiles p where p.id = profile),
    false
  );
$$;

comment on function public.watchlist_is_public(uuid) is
  'Ob die Watchlist dieser Person offen steht. Unbekanntes Profil: nein.';

grant execute on function public.watchlist_is_public(uuid) to anon, authenticated;

drop policy watchlist_own_read on public.watchlist;

create policy watchlist_read on public.watchlist
  for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or (is_hidden = false and public.watchlist_is_public(user_id))
  );

-- Aendern und Loeschen bleiben, wie sie waren: nur die eigene Liste.
create policy watchlist_own_update on public.watchlist
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
