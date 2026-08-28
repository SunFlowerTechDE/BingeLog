-- Filme wissen jetzt, wann sie dazukamen.
--
-- Die Kachel "neu im Katalog, letzte sieben Tage" zeigte 155 von 155.
-- Sie las `updated_at`, und das hat der Artwork-Batch aus M2 bei jedem
-- Film angefasst. Die Zahl war nicht falsch berechnet, sie war die
-- falsche Zahl.
--
-- `created_at` bleibt fuer die bestehenden Zeilen **NULL**, nicht
-- `now()`. Wir wissen nicht, wann sie kamen, und sie alle auf heute zu
-- setzen hiesse, eine Vermutung als Messwert auszugeben — dieselbe
-- Sorte Fehler, nur andersherum.
--
-- Die Kachel zaehlt deshalb nur, was sie wirklich weiss. In ein paar
-- Wochen ist die Luecke bedeutungslos; falsch waere sie fuer immer.

alter table public.films
  add column created_at timestamptz default now();

comment on column public.films.created_at is
  'Wann der Film in den Katalog kam. NULL bei allen, die vor dem '
  '28.08.2026 da waren — unbekannt, und unbekannt bleibt unbekannt.';

create index films_arrival_idx on public.films (created_at desc nulls last);

create or replace function public.admin_overview()
returns table (
  members        integer,
  members_7d     integer,
  dormant        integer,
  films          integer,
  films_7d       integer,
  entries        integer,
  entries_7d     integer,
  active_7d      integer,
  reviews        integer,
  lists          integer,
  open_threads   integer,
  open_reports   integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.profiles)::integer,
    (select count(*) from public.profiles
      where created_at > now() - interval '7 days')::integer,
    (select count(*) from public.profiles p
      where not exists (select 1 from public.diary_entries d where d.user_id = p.id))::integer,

    (select count(*) from public.films)::integer,
    (select count(*) from public.films
      where created_at > now() - interval '7 days')::integer,

    (select count(*) from public.diary_entries)::integer,
    (select count(*) from public.diary_entries
      where created_at > now() - interval '7 days')::integer,
    (select count(distinct user_id) from public.diary_entries
      where created_at > now() - interval '7 days')::integer,

    (select count(*) from public.diary_entries
      where review is not null and length(btrim(review)) > 0)::integer,
    (select count(*) from public.lists)::integer,
    (select count(*) from public.film_threads where is_active)::integer,
    (select count(*) from public.reports where status in ('open', 'in_progress'))::integer
  where public.is_moderator();
$$;
