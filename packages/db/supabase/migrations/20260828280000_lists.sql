-- Binge-Listen (M4 4.3).
--
-- Selbst zusammengestellte Filmsammlungen mit eigenem Namen: "Filme, die
-- im Regen spielen", "Mein 2026 in zehn Filmen". Nicht die Watchlist —
-- die ist die eine Liste "will ich sehen" — und nicht die Favoriten, die
-- vier feste Plaetze haben.
--
-- Der Unterschied zu einer Wiedergabeliste: eine Liste wird gelesen, sie
-- laeuft nicht ab. Deshalb traegt jeder Eintrag eine Notiz. Die
-- Begruendung, warum ein Film drinsteht, ist oft der eigentliche Inhalt.

create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 80),
  description text check (length(description) <= 500),
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.lists is
  'M4 4.3. Benannte Filmsammlungen. Sichtbarkeit je Liste, nicht je '
  'Profil — eine Person kann eine oeffentliche Bestenliste und eine '
  'private Merkliste zugleich fuehren.';

create index lists_by_user on public.lists (user_id, created_at desc);

create table public.list_items (
  list_id uuid not null references public.lists(id) on delete cascade,
  film_id text not null references public.films(wikidata_id) on delete cascade,
  -- Die Reihenfolge ist Teil der Aussage: Platz eins heisst "damit
  -- faengst du an". Bewusst ohne eindeutige Bedingung — beim Umsortieren
  -- waere sie nur im Weg, und zwei Filme auf derselben Zahl sind kein
  -- Schaden, solange die Sortierung eindeutig bleibt.
  ord     integer not null default 0,
  note    text check (length(note) <= 300),

  primary key (list_id, film_id)
);

comment on column public.list_items.note is
  'Warum der Film drinsteht. Bei einer Liste oft der eigentliche Inhalt.';

alter table public.lists      enable row level security;
alter table public.list_items enable row level security;

-- --------------------------------------------------------------------
-- Wer welche Liste sieht
-- --------------------------------------------------------------------

create policy lists_read on public.lists
  for select to anon, authenticated
  using (is_public or user_id = (select auth.uid()));

create policy lists_own_insert on public.lists
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy lists_own_update on public.lists
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy lists_own_delete on public.lists
  for delete to authenticated
  using (user_id = (select auth.uid()));

/**
 * Darf der Aufrufer diese Liste lesen?
 *
 * Als eigene Funktion und `security definer`, weil eine Policy auf
 * `list_items`, die direkt in `lists` schaut, dort erneut auf RLS
 * traefe. Dieselbe Bauart wie `watchlist_is_public` und `are_friends`.
 */
create or replace function public.list_is_readable(list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.lists l
     where l.id = list
       and (l.is_public or l.user_id = (select auth.uid()))
  );
$$;

create or replace function public.list_is_mine(list uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lists l
     where l.id = list and l.user_id = (select auth.uid())
  );
$$;

comment on function public.list_is_readable(uuid) is
  'Security definer, damit die Policy auf list_items nicht ein zweites '
  'Mal gegen die RLS von lists laeuft.';

grant execute on function public.list_is_readable(uuid) to anon, authenticated;
grant execute on function public.list_is_mine(uuid) to anon, authenticated;

create policy list_items_read on public.list_items
  for select to anon, authenticated
  using (public.list_is_readable(list_id));

create policy list_items_own_insert on public.list_items
  for insert to authenticated
  with check (public.list_is_mine(list_id));

create policy list_items_own_update on public.list_items
  for update to authenticated
  using (public.list_is_mine(list_id))
  with check (public.list_is_mine(list_id));

create policy list_items_own_delete on public.list_items
  for delete to authenticated
  using (public.list_is_mine(list_id));

-- --------------------------------------------------------------------
-- updated_at
-- --------------------------------------------------------------------
--
-- Damit die Uebersicht nach der letzten Aenderung sortieren kann, ohne
-- dass jede Schreibstelle daran denken muss.

create or replace function public.touch_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger lists_touch
  before update on public.lists
  for each row
  execute function public.touch_list();
