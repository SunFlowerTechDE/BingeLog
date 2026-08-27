-- Sichtbarkeit mit drei Stufen statt eines Ja/Nein.
--
-- `is_private` kannte nur zwei Zustaende, und der eine hatte eine Folge,
-- die nirgends stand: die eigene Bewertung fiel aus dem Filmschnitt.
-- Drei benannte Stufen sagen, was sie tun.
--
-- "Freunde" ist beidseitig. Einseitig waere es keine Sperre: es genuegte,
-- jemandem zu folgen, um mitzulesen. Solange niemandem gefolgt wird, ist
-- niemand Freund und die Stufe wirkt wie "privat" — sie faellt zu, nicht
-- auf.

create type public.entry_visibility as enum ('public', 'friends', 'private');

comment on type public.entry_visibility is
  'public: fuer alle sichtbar. friends: nur fuer beidseitige Follows. '
  'private: nur fuer die eigene Person, und ohne Wirkung auf den '
  'Filmschnitt.';

-- --------------------------------------------------------------------
-- Folgen
-- --------------------------------------------------------------------
--
-- Die Oberflaeche dazu kommt in M4. Die Tabelle steht hier, weil die
-- Sichtbarkeitsstufe sonst eine Zusicherung waere, die niemand einloest.

create table public.follows (
  follower_id uuid        not null references public.profiles (id) on delete cascade,
  followee_id uuid        not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);

-- Der Weg "wer folgt mir" ist der, den die Freundschaftspruefung geht.
create index follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;

-- Wem jemand folgt, ist offen einsehbar: ein Profil zeigt seine Liste.
create policy follows_read on public.follows
  for select to anon, authenticated using (true);

create policy follows_own_insert on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()));

create policy follows_own_delete on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()));

-- --------------------------------------------------------------------
-- Freundschaft
-- --------------------------------------------------------------------
--
-- security definer, weil diese Funktion aus einer Policy heraus laeuft.
-- Eine Unterabfrage in einer Policy unterliegt der RLS der abgefragten
-- Tabelle; haenge die Sichtbarkeit fremder Eintraege davon ab, was der
-- Lesende in `follows` sehen darf, und die Regel wird von der Regel
-- abhaengig, die sie schuetzen soll.

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null
     and b is not null
     and exists (
       select 1
       from public.follows hin
       join public.follows zurueck
         on zurueck.follower_id = hin.followee_id
        and zurueck.followee_id = hin.follower_id
       where hin.follower_id = a
         and hin.followee_id = b
     );
$$;

comment on function public.are_friends(uuid, uuid) is
  'Beidseitiges Folgen. Die Reihenfolge der Argumente ist egal.';

grant execute on function public.are_friends(uuid, uuid) to anon, authenticated;

-- --------------------------------------------------------------------
-- Umstellung der Eintraege
-- --------------------------------------------------------------------

alter table public.diary_entries
  add column visibility public.entry_visibility not null default 'public';

-- Was privat war, bleibt privat. Alles andere war oeffentlich.
update public.diary_entries
   set visibility = (case when is_private then 'private' else 'public' end)
                    ::public.entry_visibility;

-- Policies und die materialisierte Sicht haengen an der alten Spalte und
-- muessen vor ihr weichen. Bei der Sicht meldet Postgres das ausdruecklich
-- ("other objects depend on it"), bei den Policies nicht — die verschwaenden
-- sonst stillschweigend mit der Spalte.
drop policy diary_public_read on public.diary_entries;
drop policy facet_follows_entry_read on public.entry_facet_ratings;
drop materialized view public.film_facet_averages;

alter table public.diary_entries drop column is_private;

create policy diary_read on public.diary_entries
  for select to anon, authenticated
  using (
    visibility = 'public'
    or user_id = (select auth.uid())
    or (visibility = 'friends' and public.are_friends(user_id, (select auth.uid())))
  );

-- Facetten haengen am Eintrag: dieselbe Regel, ueber ihn erreicht.
create policy facet_follows_entry_read on public.entry_facet_ratings
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.diary_entries d
      where d.id = entry_facet_ratings.entry_id
        and (
          d.visibility = 'public'
          or d.user_id = (select auth.uid())
          or (d.visibility = 'friends'
              and public.are_friends(d.user_id, (select auth.uid())))
        )
    )
  );

-- --------------------------------------------------------------------
-- Was in den Schnitt zaehlt
-- --------------------------------------------------------------------
--
-- "Nur fuer mich" nimmt die Stimme heraus, die beiden anderen Stufen
-- nicht. Ein Schnitt ist eine Zahl ohne Namen: wer den Eintrag vor
-- Fremden verbirgt, zieht damit nicht seine Meinung ueber den Film
-- zurueck. Nur wer ihn ganz fuer sich behaelt, tut das.

create or replace function public.film_rating_summary(film text)
returns table (
  average numeric,
  votes   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select round(avg(d.rating)::numeric, 2) as average,
         count(*)::integer                as votes
  from public.diary_entries d
  where d.film_id = film
    and d.rating is not null
    and d.visibility <> 'private';
$$;

comment on function public.film_rating_summary(text) is
  'M3 3.3. Ratings are stored 1..10 for half stars; the UI divides by two '
  '(M3, Fallstricke: half stars from the start, migrating 5 to 10 steps '
  'later would falsify every existing rating). Private entries do not '
  'count; friends-only ones do.';

grant execute on function public.film_rating_summary(text) to anon, authenticated;

create materialized view public.film_facet_averages as
select d.film_id,
       f.facet,
       round(avg(f.score)::numeric, 2) as avg_score,
       count(*)                        as vote_count
from public.entry_facet_ratings f
join public.diary_entries d on d.id = f.entry_id
where d.visibility <> 'private'
group by d.film_id, f.facet
having count(*) >= 5;             -- vote threshold, see ADR-009

create unique index film_facet_averages_pk
  on public.film_facet_averages (film_id, facet);
create index film_facet_averages_film_idx
  on public.film_facet_averages (film_id);

grant select on public.film_facet_averages to anon, authenticated;

-- --------------------------------------------------------------------
-- Wiedersehen
-- --------------------------------------------------------------------
--
-- Der Schalter im Formular fragte nach etwas, das die Datenbank schon
-- weiss: liegt zu diesem Film bereits ein Eintrag derselben Person vor,
-- ist der naechste ein Wiedersehen. Die Spalte bleibt, das Setzen macht
-- ein Trigger.

create or replace function public.mark_rewatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select exists (
    select 1
    from public.diary_entries d
    where d.user_id = new.user_id
      and d.film_id = new.film_id
      and d.id <> new.id
  ) into new.is_rewatch;

  return new;
end;
$$;

create trigger diary_entries_mark_rewatch
  before insert on public.diary_entries
  for each row execute function public.mark_rewatch();

comment on column public.diary_entries.is_rewatch is
  'Wird beim Einfuegen gesetzt, nicht erfragt: ein zweiter Eintrag zum '
  'selben Film derselben Person ist ein Wiedersehen.';
