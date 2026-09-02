-- Watchlist-Konzept, Block "Danach": Prioritaeten und eigene Gruppen.
--
-- Beides beantwortet dieselbe Frage aus verschiedenen Richtungen: Was
-- davon schaue ich als Naechstes. Die Prioritaet ist die grobe Antwort
-- und gilt genau einmal je Film. Die Gruppe ist die feine, und ein Film
-- darf in mehreren stehen ("Halloween", "Mit Freunden anschauen").
--
-- **Ein Film bleibt dabei immer in der normalen Watchlist.** Eine
-- Gruppe ist eine zusaetzliche Zuordnung, kein zweiter Aufbewahrungsort
-- — sonst waere die Watchlist ploetzlich unvollstaendig, je nachdem
-- wohin man etwas gelegt hat (Konzept).

-- ---------------------------------------------------------------- Prioritaet

-- Die Reihenfolge im Typ ist die Reihenfolge auf der Seite: Postgres
-- sortiert Enums nach ihrer Deklaration, und damit steht "Als Naechstes"
-- oben, ohne dass irgendwo eine zweite Tabelle die Rangfolge nachhaelt.
create type public.watchlist_priority as enum (
  'next',                     -- Als Naechstes
  'normal',
  'someday'                   -- Irgendwann
);

alter table public.watchlist
  add column priority public.watchlist_priority not null default 'normal';

comment on column public.watchlist.priority is
  'Grobe Reihenfolge innerhalb der Watchlist. Standard: normal.';

-- ------------------------------------------------------------------ Gruppen

create table public.watchlist_groups (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),

  constraint watchlist_group_name_length check (char_length(btrim(name)) between 1 and 40),
  -- Nur damit die Zuordnung unten mit einem Schluessel gegenpruefen
  -- kann, dass Gruppe und Film demselben Konto gehoeren.
  constraint watchlist_group_owner unique (id, user_id)
);

create index watchlist_groups_user_idx on public.watchlist_groups (user_id, name);

-- Zweimal "Halloween" nebeneinander waere fuer niemanden zu
-- unterscheiden. Als Index und nicht als Constraint, weil nur so die
-- Gross- und Kleinschreibung herausfaellt: "halloween" ist derselbe
-- Name.
create unique index watchlist_group_name_unique
  on public.watchlist_groups (user_id, lower(btrim(name)));

alter table public.watchlist_groups enable row level security;

-- Gruppen sind privat, auch wenn die Watchlist offen steht. Sie sind
-- eine Notiz an sich selbst darueber, wie man seine Liste ordnet, und
-- die gehoert nicht zum Inhalt der Liste.
create policy watchlist_groups_own_read on public.watchlist_groups
  for select to authenticated using (user_id = (select auth.uid()));

create policy watchlist_groups_own_insert on public.watchlist_groups
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy watchlist_groups_own_update on public.watchlist_groups
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy watchlist_groups_own_delete on public.watchlist_groups
  for delete to authenticated using (user_id = (select auth.uid()));

-- ------------------------------------------------------------- Zuordnung

create table public.watchlist_group_films (
  group_id uuid not null,
  user_id  uuid not null,
  film_id  text not null,

  primary key (group_id, film_id),

  -- Der Film muss auf der Watchlist stehen. Nimmt jemand ihn herunter,
  -- verschwindet er damit auch aus allen Gruppen — eine Gruppe, die auf
  -- Filme zeigt, die nicht mehr vorgemerkt sind, waere eine zweite
  -- Merkliste hinter dem Ruecken der ersten.
  constraint watchlist_group_film_is_on_the_list
    foreign key (user_id, film_id) references public.watchlist (user_id, film_id)
    on delete cascade,

  -- Und die Gruppe muss demselben Konto gehoeren wie der Eintrag. Ohne
  -- das koennte man fremde Filme in die eigene Gruppe legen; die Policy
  -- allein prueft nur, wer schreibt, nicht wem die Gruppe gehoert.
  constraint watchlist_group_film_same_owner
    foreign key (group_id, user_id) references public.watchlist_groups (id, user_id)
    on delete cascade
);

create index watchlist_group_films_film_idx on public.watchlist_group_films (user_id, film_id);

alter table public.watchlist_group_films enable row level security;

create policy watchlist_group_films_own_read on public.watchlist_group_films
  for select to authenticated using (user_id = (select auth.uid()));

create policy watchlist_group_films_own_insert on public.watchlist_group_films
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy watchlist_group_films_own_delete on public.watchlist_group_films
  for delete to authenticated using (user_id = (select auth.uid()));

-- --------------------------------------------------------------- Uebersicht

create or replace function public.watchlist_groups_for_me()
returns table (
  id    uuid,
  name  text,
  films integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.id,
    g.name,
    (
      select count(*)::integer
      from public.watchlist_group_films gf
      where gf.group_id = g.id
    )
  from public.watchlist_groups g
  where g.user_id = (select auth.uid())
  order by g.name;
$$;

comment on function public.watchlist_groups_for_me() is
  'Die eigenen Watchlist-Gruppen mit ihrer Anzahl, alphabetisch.';

revoke execute on function public.watchlist_groups_for_me() from public;
grant execute on function public.watchlist_groups_for_me() to authenticated;

-- ------------------------------------------------------------ watchlist_for_me

-- Zwei Spalten mehr, also erst weg damit: der Rueckgabetyp einer
-- Funktion laesst sich nicht ersetzen, nur neu anlegen.
drop function if exists public.watchlist_for_me();

create function public.watchlist_for_me()
returns table (
  film_id        text,
  title_de       text,
  title_original text,
  release_year   integer,
  runtime_min    integer,
  poster_source  text,
  poster_url     text,
  added_at       timestamptz,
  average        numeric,
  votes          integer,
  genre_ids      text[],
  genre_labels   text[],
  recommenders   integer,
  first_friend   text,
  priority       public.watchlist_priority,
  group_ids      uuid[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    f.wikidata_id,
    f.title_de,
    f.title_original,
    f.release_year,
    f.runtime_min,
    f.poster_source,
    f.poster_url,
    w.added_at,
    s.average,
    coalesce(s.votes, 0),
    coalesce(g.ids, array[]::text[]),
    coalesce(g.labels, array[]::text[]),
    coalesce(r.anzahl, 0),
    r.wer,
    w.priority,
    coalesce(
      (
        select array_agg(gf.group_id)
        from public.watchlist_group_films gf
        where gf.user_id = w.user_id and gf.film_id = w.film_id
      ),
      array[]::uuid[]
    )
  from public.watchlist w
  join public.films f on f.wikidata_id = w.film_id
  cross join lateral public.film_rating_summary(f.wikidata_id) s
  left join lateral (
    select
      array_agg(ge.wikidata_id order by ge.wikidata_id) as ids,
      array_agg(coalesce(ge.label_de, ge.label_en) order by ge.wikidata_id) as labels
    from public.film_categories fc
    join public.genres ge on ge.wikidata_id = fc.category_id
    where fc.film_id = f.wikidata_id
      and coalesce(ge.label_de, ge.label_en) is not null
  ) g on true
  left join lateral (
    select
      count(*)::integer as anzahl,
      (
        select p.username
        from public.recommendations r2
        join public.profiles p on p.id = r2.from_user
        where r2.to_user = w.user_id
          and r2.film_id = f.wikidata_id
          and r2.dismissed_at is null
        order by r2.created_at desc
        limit 1
      ) as wer
    from public.recommendations r1
    where r1.to_user = w.user_id
      and r1.film_id = f.wikidata_id
      and r1.dismissed_at is null
  ) r on true
  where w.user_id = (select auth.uid())
  order by w.added_at desc;
$$;

comment on function public.watchlist_for_me() is
  'Watchlist-Konzept, Prioritaet 1 und Block "Danach". Die ganze eigene '
  'Watchlist mit allem, was die Seite zum Sortieren, Filtern und '
  'Kennzeichnen braucht, dazu Prioritaet und Gruppenzugehoerigkeit. '
  'Genres als Kategorien (Suchkonzept 26). Sortiert und gefiltert wird '
  'im Client. Der Durchschnitt kommt aus film_rating_summary.';

revoke execute on function public.watchlist_for_me() from public;
grant execute on function public.watchlist_for_me() to authenticated;
