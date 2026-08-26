-- M0 0.4 — User data: profiles, diary entries, watchlist.
--
-- Users read and write their own rows. The one exception is
-- diary_entries: entries that are not private are readable by everyone,
-- because the public diary is the product (02-product.md, Kernloop).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique not null
                 check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  bio          text check (char_length(bio) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Profiles are public: following someone requires seeing them (M4).
create policy profiles_public_read on public.profiles
  for select to anon, authenticated using (true);

create policy profiles_own_insert on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

create policy profiles_own_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_own_delete on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- diary_entries
-- ---------------------------------------------------------------------------

create table public.diary_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  film_id    text not null references public.films (wikidata_id),
  watched_on date,
  rating     smallint check (rating between 1 and 10),  -- half stars, 1..10 internally
  review     text check (char_length(review) <= 10000),
  is_rewatch boolean not null default false,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.diary_entries.rating is
  'Half stars stored as 1..10. Optional at the column level so a plain log stays '
  'possible, but the star rating is what gates the discussion (ADR-010) and what '
  'the two-tap flow asks for (ADR-009).';

create index diary_user_idx on public.diary_entries (user_id, watched_on desc);
create index diary_film_idx on public.diary_entries (film_id);
-- Serves the spoiler gate's exists() lookup on every thread_messages read.
create index diary_gate_idx on public.diary_entries (user_id, film_id)
  where rating is not null;

create trigger diary_entries_set_updated_at
  before update on public.diary_entries
  for each row execute function public.set_updated_at();

alter table public.diary_entries enable row level security;

-- Public entries are readable by everyone; private ones only by their owner.
create policy diary_public_read on public.diary_entries
  for select to anon, authenticated
  using (is_private = false or user_id = (select auth.uid()));

create policy diary_own_insert on public.diary_entries
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy diary_own_update on public.diary_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy diary_own_delete on public.diary_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- watchlist
-- ---------------------------------------------------------------------------

create table public.watchlist (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  film_id  text not null references public.films (wikidata_id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, film_id)
);

create index watchlist_film_idx on public.watchlist (film_id);

alter table public.watchlist enable row level security;

-- Unlike the diary, the watchlist is private by default. It says what
-- someone has not seen yet, which is not the same kind of statement.
create policy watchlist_own_read on public.watchlist
  for select to authenticated using (user_id = (select auth.uid()));

create policy watchlist_own_insert on public.watchlist
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy watchlist_own_delete on public.watchlist
  for delete to authenticated using (user_id = (select auth.uid()));
