-- Melden und Moderieren (M4 4.7).
--
-- Pflicht, nicht Kuer: der Digital Services Act gilt seit Februar 2024
-- fuer jeden Anbieter in der EU, auch fuer kleine. Artikel 16 verlangt
-- ein Meldeverfahren, das jeder findet und benutzen kann — **auch ohne
-- Konto**. Artikel 17 verlangt eine begruendete Entscheidung an beide
-- Seiten und einen Hinweis auf Widerspruch. Beides braucht einen Ort mit
-- Zustand und Zeitstempeln; ein Postfach hat weder das eine noch das
-- andere.

-- --------------------------------------------------------------------
-- Wer moderieren darf
-- --------------------------------------------------------------------
--
-- **Eine eigene Tabelle und keine Spalte in `profiles`.** Das eigene
-- Profil darf man bearbeiten, dafuer gibt es eine Update-Policy. Laege
-- die Rolle in derselben Zeile, koennte jeder Nutzer sie mitschreiben
-- und sich selbst ernennen. Der Fehler waere still und faellt erst auf,
-- wenn er ausgenutzt wurde.
--
-- Diese Tabelle hat **keine Schreib-Policy**. Ohne Policy schreibt
-- niemand hinein, auch nicht ueber die App. Eingetragen wird mit dem
-- Service-Role-Schluessel, den es nur in `packages/pipeline` gibt.

create table public.moderators (
  user_id  uuid primary key references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now()
);

comment on table public.moderators is
  'M4 4.7. Keine Schreib-Policy und mit Absicht: eine Rolle, die sich '
  'ueber die App setzen laesst, ist keine Rolle. Eintragen nur mit dem '
  'Service-Role-Schluessel.';

alter table public.moderators enable row level security;

-- Lesbar nur fuer einen selbst: die Oberflaeche muss wissen, ob sie den
-- Menuepunkt zeigt. Wer sonst moderiert, geht niemanden etwas an.
create policy moderators_read_self on public.moderators
  for select to authenticated
  using (user_id = (select auth.uid()));

/**
 * Darf der Aufrufer moderieren?
 *
 * `security definer`, weil die Policy oben nur die eigene Zeile
 * freigibt — eine Policy auf `reports`, die direkt in `moderators`
 * schaut, traefe dort wieder auf RLS. Dieselbe Bauart wie
 * `list_is_readable` und `are_friends`.
 */
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.moderators m where m.user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_moderator() to anon, authenticated;

-- --------------------------------------------------------------------
-- Die Meldungen
-- --------------------------------------------------------------------

create type public.report_target as enum ('message', 'review', 'profile', 'list', 'other');

create type public.report_reason as enum (
  'spoiler',      -- unmarkierter Spoiler
  'harassment',   -- Beleidigung, Belaestigung
  'hate',         -- Hass und Hetze
  'sexual',       -- sexueller Inhalt
  'violence',     -- Gewaltdarstellung
  'spam',         -- Spam, Werbung
  'illegal',      -- sonst rechtswidrig
  'other'
);

create type public.report_status as enum ('open', 'in_progress', 'resolved', 'rejected');

create table public.reports (
  id          uuid primary key default gen_random_uuid(),

  target_kind public.report_target not null,
  -- Als Text, weil die Ziele verschiedene Schluesseltypen haben: eine
  -- Nachricht ist uuid, ein Film ist "Q12345". Kein Fremdschluessel,
  -- **mit Absicht**: wird der gemeldete Inhalt geloescht, muss die
  -- Meldung stehen bleiben. Eine Kaskade wuerde die Spur mitnehmen.
  target_id   text not null,

  reason      public.report_reason not null,
  body        text check (length(body) <= 2000),

  -- Eins von beiden. Angemeldet zaehlt das Konto, sonst die Adresse,
  -- an die die Empfangsbestaetigung geht (Art. 16 Abs. 4 DSA).
  reporter_id    uuid references public.profiles(id) on delete set null,
  reporter_email text check (reporter_email is null or reporter_email like '%_@_%'),

  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now(),

  -- Die Entscheidung. Artikel 17 verlangt sie begruendet, und
  -- "begruendet" heisst aufschreiben, nicht denken.
  decided_at   timestamptz,
  decided_by   uuid references public.profiles(id) on delete set null,
  decision     text check (length(decision) <= 2000),

  constraint reports_has_a_reporter
    check (reporter_id is not null or reporter_email is not null)
);

comment on table public.reports is
  'M4 4.7. DSA Art. 16/17. Kein Fremdschluessel auf das Ziel: wird der '
  'Inhalt entfernt, bleibt die Meldung — eine Spur, die sich selbst '
  'wegraeumt, ist keine.';

create index reports_queue_idx on public.reports (status, created_at);

alter table public.reports enable row level security;

-- Melden darf jeder, auch ohne Konto. Das ist der Punkt von Artikel 16.
create policy reports_anyone_may_file on public.reports
  for insert to anon, authenticated
  with check (
    status = 'open'
    and decided_at is null
    and decided_by is null
    -- Wer angemeldet ist, meldet unter seinem eigenen Namen. Fremde
    -- Meldungen in jemandes Namen einzureichen waere ein Weg, ein Konto
    -- in Verruf zu bringen.
    and (reporter_id is null or reporter_id = (select auth.uid()))
  );

-- Lesen und entscheiden: nur Moderatoren.
create policy reports_moderators_read on public.reports
  for select to authenticated
  using (public.is_moderator());

create policy reports_moderators_decide on public.reports
  for update to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- Kein Loeschen, fuer niemanden. Die Aufbewahrung ist der Zweck.

-- --------------------------------------------------------------------
-- Wie oft jemand melden darf
-- --------------------------------------------------------------------
--
-- Ein offenes Formular mit Bild-Upload ist ein Ziel. Zehn Meldungen je
-- Stunde und Melder reichen fuer jeden ehrlichen Fall und bremsen die
-- Fleissarbeit.
--
-- Ein Trigger und keine Policy: eine Policy auf `reports`, die `reports`
-- zaehlt, liefe durch ihre eigene Lesesperre — Melder duerfen nicht
-- lesen. Der Trigger laeuft als Eigentuemer und sieht die Wahrheit.
-- Dasselbe Muster wie beim Rate-Limit der Diskussion (20260826090300).

create or replace function public.enforce_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  select count(*) into recent
    from public.reports r
   where r.created_at > now() - interval '1 hour'
     and (
       (new.reporter_id is not null and r.reporter_id = new.reporter_id)
       or (new.reporter_id is null and new.reporter_email is not null
           and r.reporter_email = new.reporter_email)
     );

  if recent >= 10 then
    raise exception 'report rate limit reached'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger reports_rate_limit
  before insert on public.reports
  for each row execute function public.enforce_report_rate_limit();

-- --------------------------------------------------------------------
-- Die Bilder zur Meldung
-- --------------------------------------------------------------------
--
-- **Nicht oeffentlich**, anders als Avatare und Banner. Wer einen
-- Beitrag meldet, laedt oft einen Bildschirmausschnitt hoch — und der
-- enthaelt genau das, was gemeldet wurde. Ein oeffentlicher Bucket
-- machte aus jeder Meldung eine Veroeffentlichung.

/**
 * Nimmt diese Meldung noch Bilder an?
 *
 * Die Meldung wird zuerst angelegt, dann kommen die Bilder — anders
 * herum gaebe es keinen Ordner, in den sie gehoeren. Das Fenster ist
 * eng: nach einer Viertelstunde nimmt eine Meldung nichts mehr an, sonst
 * waere jede je erstellte Meldung ein dauerhafter Uploadplatz.
 */
create or replace function public.report_accepts_uploads(report uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reports r
     where r.id = report
       and r.created_at > now() - interval '15 minutes'
  );
$$;

grant execute on function public.report_accepts_uploads(uuid) to anon, authenticated;

create table public.report_images (
  report_id uuid not null references public.reports(id) on delete cascade,
  path      text primary key,
  added_at  timestamptz not null default now()
);

alter table public.report_images enable row level security;

create policy report_images_attach on public.report_images
  for insert to anon, authenticated
  with check (public.report_accepts_uploads(report_id));

create policy report_images_moderators_read on public.report_images
  for select to authenticated
  using (public.is_moderator());


do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'Schema storage fehlt, Bucket wird uebersprungen';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('reports', 'reports', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
  on conflict (id) do update
    set public             = false,
        file_size_limit    = 2097152,
        allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

  -- PNG ist hier erlaubt, anders als bei den Profilbildern: ein
  -- Bildschirmausschnitt ist kein Foto, und PNG haelt Text scharf. Zwei
  -- Megabyte, weil ein Beleg lesbar sein muss.

  execute $p$
    create policy report_images_upload on storage.objects
      for insert to anon, authenticated
      with check (
        bucket_id = 'reports'
        and public.report_accepts_uploads(((storage.foldername(name))[1])::uuid)
      );
  $p$;

  execute $p$
    create policy report_images_read on storage.objects
      for select to authenticated
      using (bucket_id = 'reports' and public.is_moderator());
  $p$;
end
$$;
