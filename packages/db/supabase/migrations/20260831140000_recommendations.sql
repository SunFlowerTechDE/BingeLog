-- Einen Film weiterempfehlen (Entdecken-Konzept, 5).
--
-- Empfohlen wird **nur unter Freunden**, also bei beidseitigem Folgen.
-- Einseitig waere es keine Empfehlung, sondern ein Kanal, ueber den
-- jeder jedem etwas in die Startseite schreiben kann. Wer jemandem
-- folgt, ohne dass es erwidert wird, hat damit noch keinen Anspruch auf
-- dessen Aufmerksamkeit.
--
-- Die Nachricht ist auf 50 Zeichen begrenzt. Das ist die Laenge, in der
-- "Musst du sehen, vertrau mir" passt und eine Rezension nicht — dafuer
-- gibt es das Tagebuch.

create table public.recommendations (
  id          uuid primary key default gen_random_uuid(),
  from_user   uuid not null references public.profiles (id) on delete cascade,
  to_user     uuid not null references public.profiles (id) on delete cascade,
  film_id     text not null references public.films (wikidata_id) on delete cascade,
  note        text check (char_length(note) <= 50),
  created_at  timestamptz not null default now(),
  -- Ausgeblendet vom Empfaenger. Nicht geloescht: sonst empfiehlt
  -- derselbe Freund denselben Film morgen wieder, und das Ausblenden
  -- waere folgenlos.
  dismissed_at timestamptz,

  constraint recommendation_not_self check (from_user <> to_user),
  -- Denselben Film zweimal an dieselbe Person: das ist eine Korrektur,
  -- keine zweite Empfehlung.
  unique (from_user, to_user, film_id)
);

comment on table public.recommendations is
  'Entdecken-Konzept 5. Nur zwischen Freunden (beidseitiges Folgen). Die '
  'Notiz ist auf 50 Zeichen begrenzt — fuer mehr gibt es die Rezension.';
comment on column public.recommendations.dismissed_at is
  'Vom Empfaenger ausgeblendet. Die Zeile bleibt, sonst waere das '
  'Ausblenden folgenlos: derselbe Freund koennte morgen dasselbe wieder '
  'empfehlen.';

create index recommendations_inbox_idx
  on public.recommendations (to_user, created_at desc)
  where dismissed_at is null;

alter table public.recommendations enable row level security;

-- --------------------------------------------------------------------
-- Wer mich blockiert
-- --------------------------------------------------------------------
--
-- `blocks_me(autor)` beantwortet "blockiere ich autor". Fuer das
-- Empfehlen wird die Gegenrichtung gebraucht: "hat der Empfaenger mich
-- blockiert". Beide stehen nebeneinander, statt dass eine die andere
-- mit vertauschten Argumenten aufruft — der Name soll sagen, was er
-- beantwortet.
--
-- security definer aus demselben Grund wie dort: die Funktion laeuft
-- aus einer Policy heraus, und `blocks` ist fuer den Schreibenden nicht
-- lesbar.
create or replace function public.blocked_by(wer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
     where b.blocker_id = wer
       and b.blocked_id = (select auth.uid())
  );
$$;

comment on function public.blocked_by(uuid) is
  'Hat `wer` den Aufrufer blockiert? Gegenstueck zu blocks_me.';

revoke execute on function public.blocked_by(uuid) from public;
grant execute on function public.blocked_by(uuid) to authenticated;


-- Lesen darf, wer beteiligt ist. Sonst niemand: eine Empfehlung ist
-- eine Nachricht zwischen zweien, keine oeffentliche Aeusserung.
create policy recommendations_read on public.recommendations
  for select to authenticated
  using (
    from_user = (select auth.uid())
    or to_user = (select auth.uid())
  );

-- Schreiben nur im eigenen Namen und nur an Freunde. Die
-- Freundschaftspruefung steht **hier** und nicht im Client: eine
-- Oberflaeche, die nur Freunde zur Auswahl anbietet, ist eine Auswahl
-- und keine Regel.
--
-- Und nicht an jemanden, der einen blockiert hat. `blocks_me(a)` fragt,
-- ob **ich** a blockiere; hier wird die andere Richtung gebraucht,
-- deshalb direkt auf die Tabelle. Das geht, weil die Policy als
-- Eigentuemer laeuft und `blocks` fuer den Schreibenden ohnehin nicht
-- lesbar sein muss.
create policy recommendations_own_insert on public.recommendations
  for insert to authenticated
  with check (
    from_user = (select auth.uid())
    and public.are_friends(from_user, to_user)
    and not public.blocked_by(to_user)
  );

-- Zuruecknehmen darf der Absender.
create policy recommendations_own_delete on public.recommendations
  for delete to authenticated
  using (from_user = (select auth.uid()));

-- Ausblenden darf der Empfaenger. Der `with check` haelt fest, dass er
-- dabei nichts anderes umschreiben kann — Absender, Film und Notiz
-- bleiben, wie sie sind.
create policy recommendations_recipient_dismiss on public.recommendations
  for update to authenticated
  using (to_user = (select auth.uid()))
  with check (to_user = (select auth.uid()));

-- --------------------------------------------------------------------
-- Der Posteingang
-- --------------------------------------------------------------------
--
-- Ein Film je Zeile, nicht eine Empfehlung je Zeile: empfehlen drei
-- Freunde denselben Film, ist das eine Karte mit "3 Freunde empfehlen
-- dir diesen Film" und nicht dreimal derselbe Film untereinander.
--
-- Die Bewertung des Freundes steht dabei — danach fragt man als
-- Naechstes. Sie kommt aus dessen juengstem Eintrag und unterliegt
-- dessen Sichtbarkeit: `security invoker`, damit die Policy auf
-- `diary_entries` entscheidet. Ein privater Eintrag zeigt also keine
-- Zahl, und das ist richtig.

create or replace function public.recommendations_for_me(max_results integer default 12)
returns table (
  film_id        text,
  title_de       text,
  title_original text,
  release_year   integer,
  poster_source  text,
  poster_url     text,
  friends        integer,
  first_friend   text,
  note           text,
  friend_rating  smallint,
  recommended_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select r.*
    from public.recommendations r
    where r.to_user = (select auth.uid())
      and r.dismissed_at is null
      -- Was man selbst schon eingetragen hat, braucht keine Empfehlung
      -- mehr.
      and not exists (
        select 1 from public.diary_entries d
        where d.user_id = (select auth.uid()) and d.film_id = r.film_id
      )
  ),
  newest as (
    select distinct on (m.film_id)
      m.film_id, m.from_user, m.note, m.created_at
    from mine m
    order by m.film_id, m.created_at desc
  )
  select
    f.wikidata_id,
    f.title_de,
    f.title_original,
    f.release_year,
    f.poster_source,
    f.poster_url,
    (select count(*)::integer from mine m where m.film_id = n.film_id) as friends,
    p.username as first_friend,
    n.note,
    (
      select d.rating
      from public.diary_entries d
      where d.user_id = n.from_user and d.film_id = n.film_id
      order by d.created_at desc
      limit 1
    ) as friend_rating,
    n.created_at
  from newest n
  join public.films f    on f.wikidata_id = n.film_id
  join public.profiles p on p.id = n.from_user
  order by n.created_at desc
  limit greatest(1, least(max_results, 40));
$$;

comment on function public.recommendations_for_me(integer) is
  'Entdecken-Konzept 5. Ein Film je Zeile, `friends` zaehlt, wie viele ihn '
  'empfohlen haben. `friend_rating` ist die Bewertung des zuletzt '
  'Empfehlenden und unterliegt dessen Sichtbarkeit — security invoker.';

revoke execute on function public.recommendations_for_me(integer) from public;
grant execute on function public.recommendations_for_me(integer) to authenticated;

-- --------------------------------------------------------------------
-- Die Auswahlliste
-- --------------------------------------------------------------------
--
-- Wen kann ich fragen, und wem habe ich diesen Film schon empfohlen?
-- Beides in einer Antwort, damit die Liste den Haken gleich richtig
-- setzt.

create or replace function public.friends_for_recommendation(film text)
returns table (
  id             uuid,
  username       text,
  avatar_path    text,
  already_sent   boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.username,
    p.avatar_path,
    exists (
      select 1 from public.recommendations r
      where r.from_user = (select auth.uid())
        and r.to_user = p.id
        and r.film_id = film
    ) as already_sent
  from public.profiles p
  where p.id in (select public.my_friends())
  order by p.username;
$$;

comment on function public.friends_for_recommendation(text) is
  'Entdecken-Konzept 5. Die eigenen Freunde samt der Frage, wem dieser Film '
  'schon empfohlen wurde. Wer wirklich empfehlen darf, entscheidet die '
  'Policy auf recommendations — diese Liste ist eine Auswahl, keine Regel.';

revoke execute on function public.friends_for_recommendation(text) from public;
grant execute on function public.friends_for_recommendation(text) to authenticated;
