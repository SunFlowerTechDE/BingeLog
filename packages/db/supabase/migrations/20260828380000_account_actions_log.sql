-- Das Logbuch der Eingriffe (M4 4.7).
--
-- Jede Aenderung an einem fremden Konto wird hier festgehalten: wann,
-- wer, was, warum. Das ist kein Komfort, sondern der Kern der Sache —
-- wer in fremde Konten greifen kann, muss nachweisen koennen, dass er es
-- nur begruendet getan hat. Ohne Spur steht Aussage gegen Aussage, und
-- der Betreiber verliert.
--
-- **Kein Loeschen, fuer niemanden.** Auch nicht fuer Moderatoren, auch
-- nicht fuer den, der die Zeile geschrieben hat. Ein Logbuch mit
-- Radiergummi ist keins.
--
-- Geschrieben wird ausschliesslich aus der Edge Function, die den
-- Eingriff auch ausfuehrt — mit dem Service-Role-Schluessel. Deshalb
-- gibt es hier keine Insert-Policy: nichts an diesem Tisch soll aus dem
-- Browser kommen.

create type public.account_action as enum (
  'password_reset',   -- Zuruecksetz-Mail ausgeloest
  'username_reset',   -- Benutzername geaendert
  'email_change',     -- Adresse geaendert
  'account_closed',   -- Konto geschlossen
  'account_restored', -- wieder geoeffnet
  'content_removed',  -- Inhalt entfernt
  'note'              -- Vermerk ohne Eingriff
);

create table public.account_actions (
  id         uuid primary key default gen_random_uuid(),

  target_id  uuid not null references public.profiles(id) on delete set null,
  -- Der Name zum Zeitpunkt des Eingriffs. Faellt das Konto spaeter weg
  -- oder aendert sich der Name, muss die Zeile trotzdem lesbar bleiben.
  target_name text not null,

  actor_id   uuid references public.profiles(id) on delete set null,
  actor_name text not null,

  action     public.account_action not null,
  -- Pflicht. "Begruendet" heisst aufschreiben, nicht denken — und der
  -- Nutzer bekommt denselben Text per Mail.
  reason     text not null check (length(btrim(reason)) between 3 and 2000),
  -- Was genau: alter und neuer Wert, ohne Geheimnisse. Nie ein Passwort.
  details    jsonb,

  -- Wurde der Nutzer erreicht? Ein Eingriff ohne Benachrichtigung ist
  -- kein Fehler der Datenbank, aber er gehoert sichtbar gemacht, damit
  -- er nachgeholt wird.
  notified   boolean not null default false,

  created_at timestamptz not null default now()
);

comment on table public.account_actions is
  'M4 4.7. Wer hat wann an welchem Konto was getan und warum. Keine '
  'Insert-Policy und keine Delete-Policy: geschrieben wird nur aus der '
  'Edge Function, geloescht wird nie.';

create index account_actions_recent_idx on public.account_actions (created_at desc);
create index account_actions_target_idx on public.account_actions (target_id, created_at desc);

alter table public.account_actions enable row level security;

-- Lesen duerfen Moderatoren — und der Betroffene seine eigenen Zeilen.
-- Transparenz heisst auch, dass der Nutzer nachschauen kann, was mit
-- seinem Konto geschehen ist.
create policy account_actions_read on public.account_actions
  for select to authenticated
  using (public.is_moderator() or target_id = (select auth.uid()));

-- --------------------------------------------------------------------
-- Geschlossene Konten
-- --------------------------------------------------------------------
--
-- Schliessen heisst nicht loeschen. Ein geloeschtes Konto nimmt seine
-- Eintraege mit, und damit auch die Belege zu einer Meldung. Ein
-- geschlossenes Konto bleibt stehen, kommt aber nicht mehr herein und
-- taucht nirgends mehr auf.

alter table public.profiles
  add column closed_at timestamptz,
  add column closed_reason text;

comment on column public.profiles.closed_at is
  'Gesetzt heisst: Konto geschlossen. Nicht geloescht — die Eintraege '
  'sind Belege zu Meldungen und muessen auffindbar bleiben.';
