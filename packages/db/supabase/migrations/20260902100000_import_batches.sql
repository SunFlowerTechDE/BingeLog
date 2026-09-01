-- Import aus einem Letterboxd-Datenexport (M5).
--
-- Der Nutzer laedt seinen **eigenen** Export hoch. Kein Scraping, keine
-- Abfrage eines fremden Profils ueber einen Benutzernamen — die Datei
-- kommt von ihm, oder es passiert nichts.
--
-- Zwei Tabellen: ein Stapel je Import und eine Zeile je Eintrag aus der
-- Datei. Die Zeilen sind der Grund, warum ein unterbrochener Import
-- fortgesetzt werden kann und warum ein zweiter Import derselben Datei
-- nichts verdoppelt: was schon `imported` ist, wird nicht noch einmal
-- angefasst.

create type public.import_source as enum ('letterboxd');

create type public.import_status as enum (
  'uploaded',
  'analyzing',
  'ready',                  -- analysiert, wartet auf die Bestaetigung
  'importing',
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled'
);

create type public.import_item_status as enum (
  'pending',
  'matched',                -- Film im Katalog gefunden
  'created',                -- Film waehrend des Imports aufgenommen
  'imported',               -- Nutzerdaten geschrieben
  'needs_review',           -- mehrere moegliche Treffer
  'skipped',
  'failed'
);

create type public.import_item_kind as enum (
  'watched',                -- gesehen, ohne Datum
  'diary',                  -- Tagebucheintrag mit Datum
  'watchlist',
  'like'                    -- Letterboxd-Favorit
);

create table public.import_batches (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  source           public.import_source not null default 'letterboxd',
  status           public.import_status not null default 'uploaded',

  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  completed_at     timestamptz,

  total_items      integer not null default 0,
  processed_items  integer not null default 0,
  successful_items integer not null default 0,
  failed_items     integer not null default 0,

  -- Wofuer die Vorschau die Zahlen braucht, bevor irgendetwas
  -- geschrieben ist.
  films_known      integer not null default 0,
  films_new        integer not null default 0,

  error            text
);

comment on table public.import_batches is
  'Ein Stapel je Import. Der Fortschritt steht hier, damit ein '
  'abgebrochener Import fortgesetzt werden kann statt von vorn zu '
  'beginnen.';

create index import_batches_user_idx on public.import_batches (user_id, created_at desc);

create table public.import_items (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references public.import_batches(id) on delete cascade,
  kind        public.import_item_kind not null,
  status      public.import_item_status not null default 'pending',

  -- Was in der Datei stand. Roh, damit eine spaetere Zuordnung von Hand
  -- noch weiss, wovon die Rede war.
  raw_title   text not null,
  raw_year    integer,
  -- Die Letterboxd-Adresse. **Keine Film-Id**: der Export fuehrt keine
  -- TMDb- oder IMDb-Nummer, nur einen eigenen Kurzlink. Er taugt als
  -- Kennung fuer die Idempotenz, nicht fuer den Abgleich.
  source_uri  text,

  rating      smallint check (rating between 1 and 10),
  watched_on  date,
  review      text,
  has_spoilers boolean not null default false,

  film_id     text references public.films(wikidata_id) on delete set null,
  error_code  text,
  processed_at timestamptz,

  -- Derselbe Eintrag aus derselben Datei nur einmal. Das ist die
  -- Zusicherung, an der die Idempotenz haengt: ein zweiter Lauf ueber
  -- dieselbe Datei findet dieselben Zeilen vor.
  unique (batch_id, kind, raw_title, raw_year, watched_on)
);

comment on column public.import_items.source_uri is
  'Die Letterboxd-Adresse der Zeile. Der Export enthaelt keine TMDb- oder '
  'IMDb-Id — der Abgleich laeuft deshalb ueber Titel und Jahr.';

create index import_items_batch_idx on public.import_items (batch_id, status);

alter table public.import_batches enable row level security;
alter table public.import_items enable row level security;

-- Nur der eigene Import. Ein Import ist die halbe Filmgeschichte eines
-- Menschen; sie geht niemanden sonst etwas an.
create policy import_batches_own on public.import_batches
  for select to authenticated using (user_id = (select auth.uid()));

create policy import_batches_own_insert on public.import_batches
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy import_batches_own_delete on public.import_batches
  for delete to authenticated using (user_id = (select auth.uid()));

create policy import_items_own on public.import_items
  for select to authenticated
  using (
    exists (
      select 1 from public.import_batches b
       where b.id = batch_id and b.user_id = (select auth.uid())
    )
  );

-- **Geschrieben wird nur von der Edge Function.** Sie haelt den
-- Service-Role-Key und umgeht RLS; hier gibt es bewusst keine
-- INSERT-Policy fuer `import_items` und kein UPDATE fuer die Staepel.
-- Der Client soll den Fortschritt lesen und sonst nichts.

-- --------------------------------------------------------------------
-- Woher ein Tagebucheintrag stammt
-- --------------------------------------------------------------------
--
-- Und vor allem: dass er **nicht in den Feed gehoert**. Achttausend
-- importierte Bewertungen wuerden die Startseite jedes Freundes
-- fluten, und zwar mit Ereignissen, die vor Jahren stattgefunden haben.
-- Sie stehen im Profil, im Tagebuch und am Film — nur nicht als
-- "gerade passiert".

alter table public.diary_entries
  add column import_batch_id uuid references public.import_batches(id) on delete set null;

comment on column public.diary_entries.import_batch_id is
  'Aus einem Import. Solche Eintraege erscheinen nicht im Feed: historische '
  'Daten sind keine Neuigkeiten.';

create index diary_import_idx on public.diary_entries (import_batch_id)
  where import_batch_id is not null;

drop function if exists public.following_feed(timestamptz, uuid, integer);

create function public.following_feed(
  before_at timestamptz default null,
  before_id uuid        default null,
  max_results integer   default 20
)
returns table (
  id            uuid,
  created_at    timestamptz,
  rating        smallint,
  review        text,
  has_spoilers  boolean,
  watched_on    date,
  is_rewatch    boolean,
  username      text,
  avatar_path   text,
  film_id       text,
  title_de      text,
  title_original text,
  release_year  integer,
  poster_source text,
  poster_url    text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    d.id, d.created_at, d.rating, d.review, d.has_spoilers, d.watched_on, d.is_rewatch,
    p.username, p.avatar_path,
    f.wikidata_id, f.title_de, f.title_original, f.release_year,
    f.poster_source, f.poster_url
  from public.diary_entries d
  join public.profiles p on p.id = d.user_id
  join public.films f    on f.wikidata_id = d.film_id
  where d.user_id in (
          select fo.followee_id
            from public.follows fo
           where fo.follower_id = (select auth.uid())
        )
    -- Importiertes ist keine Neuigkeit.
    and d.import_batch_id is null
    and (
      before_at is null
      or (d.created_at, d.id) < (before_at, before_id)
    )
  order by d.created_at desc, d.id desc
  limit greatest(1, least(max_results, 50));
$$;

comment on function public.following_feed(timestamptz, uuid, integer) is
  'M4 4.4. Chronologisch und vollstaendig, ohne Gewichtung. Ohne '
  'importierte Eintraege: historische Daten sind keine Neuigkeiten.';

grant execute on function public.following_feed(timestamptz, uuid, integer) to authenticated;
