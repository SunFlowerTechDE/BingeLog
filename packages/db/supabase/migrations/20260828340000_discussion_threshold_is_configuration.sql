-- Die Aktivierungsschwelle gehoert nicht in den Code (M4 4.5).
--
-- Sie stand als `viewer_count >= 5` im Trigger. Fuenf ist eine Zahl fuer
-- heute: bei zehn Nutzern ist sie unerreichbar, bei zehntausend ist sie
-- zu niedrig. Sie zu aendern hiesse bisher, eine Migration zu schreiben
-- und auszurollen — fuer eine Zahl.
--
-- Jetzt steht sie in einer Tabelle. Aendern heisst: eine Zeile
-- schreiben.

create table public.app_settings (
  key         text primary key,
  value       integer not null,
  description text not null,
  updated_at  timestamptz not null default now()
);

comment on table public.app_settings is
  'Stellschrauben, die sich mit der Nutzerzahl aendern. Keine Geheimnisse '
  '— alles hier ist oeffentlich lesbar, damit die Oberflaeche erklaeren '
  'kann, warum etwas noch nicht offen ist.';

alter table public.app_settings enable row level security;

-- Lesbar fuer alle: die Filmseite sagt "noch drei Leute, dann geht die
-- Diskussion auf", und dafuer muss sie die Zahl kennen. Ein Geheimnis
-- waere sie nur, wenn man sie umgehen koennte, und das kann man nicht.
create policy app_settings_read on public.app_settings
  for select to anon, authenticated
  using (true);

-- Keine Schreib-Policy. Geaendert wird mit dem Service-Role-Schluessel,
-- also aus `packages/pipeline` heraus — nicht aus der App.

insert into public.app_settings (key, value, description) values
  ('discussion_threshold', 5,
   'Ab so vielen Nutzern mit Eintrag geht die Diskussion zu einem Film auf.');

-- --------------------------------------------------------------------
-- Der Trigger liest die Zahl jetzt
-- --------------------------------------------------------------------
--
-- Nur der letzte Abschnitt aendert sich. Der Rest steht unveraendert aus
-- 20260826090300 — die Buchfuehrung ueber `viewer_count` war nie das
-- Problem.

create or replace function public.sync_thread_viewer_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_film text;
  affected_user uuid;
  remaining     integer;
  schwelle      integer;
begin
  if tg_op = 'DELETE'
     or (tg_op = 'UPDATE'
         and (old.film_id is distinct from new.film_id
              or old.user_id is distinct from new.user_id)) then
    affected_film := old.film_id;
    affected_user := old.user_id;

    select count(*) into remaining
    from public.diary_entries d
    where d.film_id = affected_film
      and d.user_id = affected_user;

    if remaining = 0 then
      update public.film_threads
      set viewer_count = greatest(viewer_count - 1, 0)
      where film_id = affected_film;
    end if;
  end if;

  if tg_op = 'INSERT'
     or (tg_op = 'UPDATE'
         and (old.film_id is distinct from new.film_id
              or old.user_id is distinct from new.user_id)) then
    affected_film := new.film_id;
    affected_user := new.user_id;

    select count(*) into remaining
    from public.diary_entries d
    where d.film_id = affected_film
      and d.user_id = affected_user
      and d.id <> new.id;

    if remaining = 0 then
      insert into public.film_threads (film_id, viewer_count)
      values (affected_film, 1)
      on conflict (film_id) do update
        set viewer_count = public.film_threads.viewer_count + 1;

      select s.value into schwelle
        from public.app_settings s
       where s.key = 'discussion_threshold';

      -- Fehlt die Zeile, bleibt es bei fuenf. Eine fehlende Einstellung
      -- darf keine Diskussion aufreissen, die niemand wollte.
      schwelle := coalesce(schwelle, 5);

      -- Die Aktivierung rastet ein. Sie faellt nie zurueck: ein Thread
      -- mit Beitraegen darf nicht verschwinden, weil jemand seinen
      -- Eintrag loescht.
      update public.film_threads
      set is_active = true
      where film_id = affected_film
        and viewer_count >= schwelle
        and is_active = false;
    end if;
  end if;

  return null;
end;
$$;
