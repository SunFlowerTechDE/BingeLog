-- M0 0.3 — Catalog tables.
--
-- Source of truth for all film metadata is Wikidata (ADR-001). TheTVDB
-- contributes artwork only, never titles or synopses (ADR-002).
-- These tables are publicly readable and writable exclusively by the
-- import pipeline via the service role.

-- pg_trgm lives in the extensions schema on Supabase; pin the path so
-- gin_trgm_ops resolves regardless of where it was installed.
set search_path = public, extensions;

create extension if not exists pg_trgm;

-- Shared trigger function: keeps updated_at honest across the schema.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- films
-- ---------------------------------------------------------------------------

create table public.films (
  wikidata_id      text primary key,          -- "Q12345"
  imdb_id          text unique,               -- "tt0069293", matching key (ADR-003)
  tvdb_id          integer,                   -- populated from M2 onwards
  title_original   text not null,
  title_de         text,
  title_en         text,
  release_year     integer check (release_year between 1870 and 2100),
  runtime_min      integer check (runtime_min > 0),
  sitelink_count   integer not null default 0 check (sitelink_count >= 0),
  poster_source    text check (poster_source in ('tvdb', 'generated')),
  poster_url       text,
  synopsis_de      text,
  updated_at       timestamptz not null default now()
);

comment on column public.films.imdb_id is
  'Only bridge to TheTVDB. Title search is forbidden, also as fallback (ADR-003).';
comment on column public.films.sitelink_count is
  'Wikipedia language versions. Relevance signal for search ranking and batch priority (ADR-008).';
comment on column public.films.poster_source is
  'null means not resolved yet. "generated" is a valid end state, not a placeholder (ADR-004).';

create index films_sitelinks_idx on public.films (sitelink_count desc);
create index films_imdb_idx on public.films (imdb_id);
create index films_year_idx on public.films (release_year);

create trigger films_set_updated_at
  before update on public.films
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- people, credits
-- ---------------------------------------------------------------------------

create table public.people (
  wikidata_id    text primary key,
  name           text not null,
  sitelink_count integer not null default 0 check (sitelink_count >= 0)
);

create table public.film_credits (
  film_id   text not null references public.films (wikidata_id) on delete cascade,
  person_id text not null references public.people (wikidata_id) on delete cascade,
  role      text not null check (role in ('director', 'cast', 'writer')),
  ord       integer,
  primary key (film_id, person_id, role)
);

create index film_credits_person_idx on public.film_credits (person_id);

-- ---------------------------------------------------------------------------
-- genres
-- ---------------------------------------------------------------------------

create table public.genres (
  wikidata_id text primary key,
  label_de    text,
  label_en    text
);

create table public.film_genres (
  film_id  text not null references public.films (wikidata_id) on delete cascade,
  genre_id text not null references public.genres (wikidata_id) on delete cascade,
  primary key (film_id, genre_id)
);

create index film_genres_genre_idx on public.film_genres (genre_id);

-- ---------------------------------------------------------------------------
-- RLS: read for everyone, write for nobody.
--
-- Only SELECT policies exist. Postgres denies any command without a
-- matching policy, so insert/update/delete are closed for anon and
-- authenticated without needing to be spelled out. The service role
-- bypasses RLS entirely and is the pipeline's only way in.
-- ---------------------------------------------------------------------------

alter table public.films        enable row level security;
alter table public.people       enable row level security;
alter table public.film_credits enable row level security;
alter table public.genres       enable row level security;
alter table public.film_genres  enable row level security;

create policy films_public_read on public.films
  for select to anon, authenticated using (true);

create policy people_public_read on public.people
  for select to anon, authenticated using (true);

create policy film_credits_public_read on public.film_credits
  for select to anon, authenticated using (true);

create policy genres_public_read on public.genres
  for select to anon, authenticated using (true);

create policy film_genres_public_read on public.film_genres
  for select to anon, authenticated using (true);
