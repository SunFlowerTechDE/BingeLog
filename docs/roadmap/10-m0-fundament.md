# M0: Fundament

**Ziel:** Repo, Supabase-Projekt und Datenbankschema stehen. Noch keine UI,
noch keine Daten.

**Vorbedingung:** keine.

**Aufwand:** 3 bis 4 Tage.

---

## Aufgaben

### 0.1 Repo-Struktur

Monorepo, weil Web und Pipeline sich das Schema teilen. Die iOS-App liegt
im selben Repo, baut aber unabhängig.

```
/apps
  /web            Next.js 16
  /ios            Xcode-Projekt (ab M5)
/packages
  /db             Migrationen, generierte Typen
  /pipeline       Wikidata-Import, TheTVDB-Batch (Standalone)
/docs
  roadmap/        diese Dateien
```

- [ ] Repo anlegen, `.gitignore` für Node, Swift, Python
- [ ] `pnpm` Workspaces einrichten
- [ ] TypeScript strict überall, `noUncheckedIndexedAccess` aktiv
- [ ] ESLint, Prettier, Pre-Commit-Hook

### 0.2 Supabase

- [ ] Projekt in der EU-Region anlegen (Frankfurt), nicht US
- [ ] Lokale Entwicklung gegen **hosted** Supabase, nicht Docker
- [ ] `.env.local` mit Anon-Key, Service-Role-Key **nur** in der Pipeline
- [ ] Supabase CLI für Migrationen, keine Änderungen über die Web-Oberfläche

### 0.3 Schema, Teil 1: Katalog

Diese Tabellen sind öffentlich lesbar und nur von der Pipeline schreibbar.

```sql
create table films (
  wikidata_id      text primary key,          -- "Q12345"
  imdb_id          text unique,               -- "tt0069293"
  tvdb_id          integer,                   -- erst ab M2 befüllt
  title_original   text not null,
  title_de         text,
  title_en         text,
  release_year     integer,
  runtime_min      integer,
  sitelink_count   integer not null default 0,
  poster_source    text,                      -- 'tvdb' | 'generated' | null
  poster_url       text,
  synopsis_de      text,
  updated_at       timestamptz not null default now()
);

create index films_sitelinks_idx on films (sitelink_count desc);
create index films_imdb_idx on films (imdb_id);
create index films_year_idx on films (release_year);

create table people (
  wikidata_id  text primary key,
  name         text not null,
  sitelink_count integer not null default 0
);

create table film_credits (
  film_id    text references films(wikidata_id) on delete cascade,
  person_id  text references people(wikidata_id) on delete cascade,
  role       text not null,   -- 'director' | 'cast' | 'writer'
  ord        integer,
  primary key (film_id, person_id, role)
);

create table genres (
  wikidata_id text primary key,
  label_de    text,
  label_en    text
);

create table film_genres (
  film_id  text references films(wikidata_id) on delete cascade,
  genre_id text references genres(wikidata_id) on delete cascade,
  primary key (film_id, genre_id)
);
```

- [ ] Migration schreiben und anwenden
- [ ] RLS aktivieren: `select` für `anon` und `authenticated`, kein
      `insert`/`update`/`delete` für beide. Schreibzugriff nur über
      Service-Role.

### 0.4 Schema, Teil 2: Nutzerdaten

```sql
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  display_name text,
  bio          text,
  created_at   timestamptz not null default now()
);

create table diary_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  film_id     text not null references films(wikidata_id),
  watched_on  date,
  rating      smallint check (rating between 1 and 10),  -- halbe Sterne
  review      text,
  is_rewatch  boolean not null default false,
  is_private  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index diary_user_idx on diary_entries (user_id, watched_on desc);
create index diary_film_idx on diary_entries (film_id);

create table watchlist (
  user_id   uuid references profiles(id) on delete cascade,
  film_id   text references films(wikidata_id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (user_id, film_id)
);
```

- [ ] RLS: Nutzer sehen und ändern nur eigene Zeilen. Ausnahme: nicht
      private `diary_entries` sind für alle lesbar.
- [ ] `updated_at`-Trigger

### 0.4b Schema, Teil 3: Facettenbewertung

Siehe ADR-009. Feste Facetten als Enum, damit Aggregation möglich ist.

```sql
create type facet_kind as enum (
  'acting', 'story', 'directing', 'cinematography',
  'sound', 'production_design', 'pacing'
);

create table entry_facet_ratings (
  entry_id uuid not null references diary_entries(id) on delete cascade,
  facet    facet_kind not null,
  score    smallint not null check (score between 1 and 10),
  primary key (entry_id, facet)
);

create index facet_entry_idx on entry_facet_ratings (entry_id);
```

Aggregation über eine materialisierte Sicht, nicht live:

```sql
create materialized view film_facet_averages as
select d.film_id,
       f.facet,
       round(avg(f.score)::numeric, 2) as avg_score,
       count(*)                        as vote_count
from entry_facet_ratings f
join diary_entries d on d.id = f.entry_id
where d.is_private = false
group by d.film_id, f.facet
having count(*) >= 5;          -- Mindestzahl, siehe ADR-009

create unique index on film_facet_averages (film_id, facet);
```

- [ ] RLS: Facetten folgen der Sichtbarkeit ihres `diary_entry`
- [ ] Refresh der Sicht per Cron, nicht pro Schreibvorgang
- [ ] `entry_facet_ratings` ist optional. Ein Eintrag ohne Facetten ist
      ein gültiger Eintrag.

### 0.4c Schema, Teil 4: Filmdiskussion

Siehe ADR-010 und ADR-011.

```sql
create table film_threads (
  film_id          text primary key references films(wikidata_id) on delete cascade,
  message_count    integer not null default 0,
  viewer_count     integer not null default 0,   -- Nutzer mit Eintrag
  is_active        boolean not null default false,
  is_locked        boolean not null default false,
  last_activity_at timestamptz
);

create table thread_messages (
  id         uuid primary key default gen_random_uuid(),
  film_id    text not null references films(wikidata_id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  parent_id  uuid references thread_messages(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  is_removed boolean not null default false
);

create index thread_film_idx on thread_messages (film_id, created_at desc);
create index thread_parent_idx on thread_messages (parent_id);
```

**Das Spoiler-Gate als RLS-Policy. Das ist der sicherheitskritische Teil
des gesamten Projekts.**

```sql
alter table thread_messages enable row level security;

-- Lesen nur mit eigenem, bewertetem Eintrag zum selben Film
create policy discussion_read_gate on thread_messages
for select using (
  is_removed = false
  and exists (
    select 1 from diary_entries d
    where d.user_id  = auth.uid()
      and d.film_id  = thread_messages.film_id
      and d.rating is not null
  )
);

-- Schreiben unter derselben Bedingung, plus Thread aktiv und offen
create policy discussion_write_gate on thread_messages
for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from diary_entries d
    where d.user_id  = auth.uid()
      and d.film_id  = thread_messages.film_id
      and d.rating is not null
  )
  and exists (
    select 1 from film_threads t
    where t.film_id = thread_messages.film_id
      and t.is_active = true
      and t.is_locked = false
  )
);

-- Bearbeiten und Löschen nur eigene Beiträge
create policy discussion_own_update on thread_messages
for update using (user_id = auth.uid());
```

- [ ] `film_threads.is_active` wird gesetzt, sobald `viewer_count >= 5`
- [ ] `viewer_count` per Trigger auf `diary_entries` fortschreiben
- [ ] Meldetabelle für Beiträge (siehe M4)
- [ ] Rate Limiting: maximal 10 Beiträge pro Nutzer und Stunde

**Testfall, der grün sein muss, bevor M4 beginnt:** Ein authentifizierter
Nutzer ohne Eintrag zu Film X ruft die REST-API direkt auf und bekommt
für `thread_messages` zu Film X null Zeilen zurück. Nicht "gefiltert in
der UI", sondern null Zeilen aus der Datenbank.

### 0.5 Suchindex

```sql
create extension if not exists pg_trgm;

create index films_title_trgm on films
  using gin ((coalesce(title_de,'') || ' ' ||
              coalesce(title_original,'') || ' ' ||
              coalesce(title_en,'')) gin_trgm_ops);
```

Das Ranking kommt in M3. Hier nur der Index.

---

## Definition of Done

- [ ] `pnpm install && pnpm build` läuft im Web-Workspace durch
- [ ] Alle Migrationen sind versioniert und reproduzierbar anwendbar
- [ ] Jede Tabelle hat RLS aktiv, geprüft per Query auf `pg_tables`
- [ ] Ein manueller Insert mit dem Anon-Key in `films` schlägt fehl
- [ ] TypeScript-Typen aus dem Schema generiert und eingecheckt
- [ ] **Spoiler-Gate-Test grün**: Abruf von `thread_messages` ohne
      bewerteten Eintrag liefert null Zeilen (nicht UI-seitig gefiltert)
- [ ] Facetten-Enum ist angelegt, materialisierte Sicht refresht

## Fallstricke

- **RLS nicht "später" aktivieren.** Nachträglich einzuziehen bedeutet,
  jede bestehende Query neu zu prüfen.
- **Service-Role-Key gehört nie in den Web-Workspace.** Nur die Pipeline
  kennt ihn.
- **Kein `org_id` in diesen Tabellen.** Das ist eine B2C-App. Mandantenfähige
  Strukturen kommen erst mit M8 und dann in eigenen Tabellen.
