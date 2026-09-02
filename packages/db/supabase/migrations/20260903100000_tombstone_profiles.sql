-- Bewertungen ueberleben die Kontoloeschung (Entwurf 03.09.2026).
--
-- Bisher nahm die Loeschung alles mit: zehn Bewertungen weg, der
-- Durchschnitt des Films sprang, eine Rezension unter dem Film
-- verschwand mitten aus dem Gespraech. Gemessen am 03.09.2026.
--
-- **Neu: das Profil bleibt als Grabstein stehen.** Ohne Namen, ohne
-- Bild, ohne Beschreibung — aber als Zeile, an der die Bewertungen
-- weiter haengen koennen. Angezeigt wird "Konto geloescht".
--
-- Was bleibt: die Popcorn-Wertung und der geschriebene Text. Beides ist
-- eine Aussage ueber einen Film, nicht ueber eine Person, und der Film
-- steht weiter da.
--
-- Was geht: alles, was nur im Verhaeltnis zu anderen Sinn ergibt —
-- Watchlist, Listen, Favoriten, Folgen, Blockaden, Empfehlungen,
-- Geschmacksstimmen, Importe.

-- --------------------------------------------------------------------
-- Der Grabstein
-- --------------------------------------------------------------------

alter table public.profiles
  add column deleted_at timestamptz;

comment on column public.profiles.deleted_at is
  'Wann das Konto geloescht wurde, oder null. Die Zeile bleibt danach '
  'stehen, damit Bewertungen und Rezensionen weiter an ihr haengen '
  'koennen; Name, Bild und Beschreibung sind dann weg.';

create index profiles_alive_idx on public.profiles (username) where deleted_at is null;

-- Die Kaskade auf `auth.users` muss weg: sie nahm das Profil mit, und
-- mit dem Profil die Bewertungen. Der Fremdschluessel selbst ebenso —
-- nach der Loeschung gibt es die Zeile in `auth.users` nicht mehr, und
-- ein Fremdschluessel darauf waere danach verletzt.
alter table public.profiles
  drop constraint profiles_id_fkey;

-- Stattdessen eine Pruefung **beim Anlegen**. Sie leistet, was der
-- Fremdschluessel geleistet hat — kein Profil ohne Konto — und laesst
-- zu, dass das Konto spaeter verschwindet.
create or replace function public.profile_needs_an_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users u where u.id = new.id) then
    raise exception 'profile % has no account', new.id;
  end if;
  return new;
end;
$$;

create trigger profiles_need_an_account
  before insert on public.profiles
  for each row execute function public.profile_needs_an_account();

-- --------------------------------------------------------------------
-- Was ein geloeschtes Profil nicht mehr darf
-- --------------------------------------------------------------------
--
-- Es kann sich nicht mehr anmelden — das Konto ist weg. Aber die Zeile
-- steht, und ohne diese Regeln koennte ihr jemand folgen oder sie
-- empfehlen. Beides waere sinnlos und saehe aus wie ein Fehler.

drop policy if exists follows_own_insert on public.follows;

create policy follows_own_insert on public.follows
  for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = followee_id and p.deleted_at is null
    )
  );

-- --------------------------------------------------------------------
-- Die Loeschung selbst
-- --------------------------------------------------------------------

create or replace function public.anonymise_profile(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  handle  text;
  versuch integer;
begin
  if not exists (select 1 from public.profiles p where p.id = target) then
    return;
  end if;

  -- Ein Name, der niemanden bezeichnet, aber die Eindeutigkeit haelt.
  -- Er wird nirgends angezeigt: die Oberflaeche liest `deleted_at` und
  -- schreibt "Konto geloescht".
  --
  -- Zehn Hexziffern, weil der Name hoechstens zwanzig Zeichen haben darf
  -- (`profiles_username_check`) und "geloescht_" schon zehn belegt. Bei
  -- einer Kollision wird neu gewuerfelt statt die Loeschung abzubrechen.

  -- Erst weg, was nur im Verhaeltnis zu anderen Sinn ergibt. Ohne diesen
  -- Schritt bliebe ein Grabstein stehen, der noch Leuten folgt.
  delete from public.watchlist          where user_id = target;
  delete from public.watchlist_groups   where user_id = target;
  delete from public.favourites         where user_id = target;
  delete from public.follows            where follower_id = target or followee_id = target;
  delete from public.blocks             where blocker_id = target or blocked_id = target;
  delete from public.recommendations    where from_user = target or to_user = target;
  delete from public.taste_votes        where user_id = target;
  delete from public.lists              where user_id = target;
  delete from public.import_batches     where user_id = target;
  delete from public.moderators         where user_id = target;

  -- Dann der Grabstein. `diary_entries` und `thread_messages` bleiben
  -- absichtlich stehen: beides sind Aussagen ueber einen Film, und der
  -- Film steht weiter da. Ein Gespraech, aus dem eine Seite spurlos
  -- verschwindet, ist keins mehr.
  for versuch in 1..10 loop
    handle := 'geloescht_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    begin
      update public.profiles
         set username     = handle,
             display_name = null,
             bio          = null,
             avatar_path  = null,
             banner_path  = null,
             watchlist_public = false,
             deleted_at   = now()
       where id = target;
      return;
    exception when unique_violation then
      -- Weiter im Schleifenlauf: ein neuer Wurf.
    end;
  end loop;

  raise exception 'could not find a free handle for %', target;
end;
$$;

comment on function public.anonymise_profile(uuid) is
  'Macht aus einem Profil einen Grabstein: Name, Bild und Beschreibung '
  'weg, Beziehungen zu anderen weg, Bewertungen und Rezensionen bleiben. '
  'Wird von der Edge Function delete-account aufgerufen, bevor sie das '
  'Konto entfernt.';

-- **Niemand ausser dem Service-Role-Key.** Die Funktion ist
-- `security definer` und wuerde sonst jedem erlauben, ein fremdes Profil
-- zu leeren.
revoke execute on function public.anonymise_profile(uuid) from public;
revoke execute on function public.anonymise_profile(uuid) from anon, authenticated;
