-- Nicht zugeordnete Eintraege von Hand klaeren (M5).
--
-- Einzelne Fehler blockieren den Import nicht — der Rest laeuft durch,
-- und was uebrigbleibt, landet in "Nicht erkannt". Dort waehlt der
-- Nutzer den richtigen Film oder legt den Eintrag beiseite.
--
-- **Als Funktionen und nicht als UPDATE-Policy.** Eine Policy kann
-- Zeilen einschraenken, aber keine Spalten: mit ihr koennte der Nutzer
-- auch `raw_title` oder `status` auf 'imported' setzen, ohne dass je
-- etwas geschrieben wurde. Hier darf er genau zweierlei — einen Film
-- zuweisen oder den Eintrag ueberspringen.

create or replace function public.resolve_import_item(item uuid, film text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  gehoert boolean;
begin
  select exists (
    select 1
      from public.import_items i
      join public.import_batches b on b.id = i.batch_id
     where i.id = item
       and b.user_id = (select auth.uid())
  ) into gehoert;

  if not gehoert then
    return false;
  end if;

  -- Der Film muss es geben. Ein Bezeichner aus der Luft wuerde beim
  -- naechsten Durchlauf am Fremdschluessel scheitern, und der Eintrag
  -- saehe geklaert aus, ohne es zu sein.
  if not exists (select 1 from public.films f where f.wikidata_id = film) then
    return false;
  end if;

  update public.import_items
     set film_id = film,
         status = 'matched',
         error_code = null
   where id = item;

  return true;
end;
$$;

comment on function public.resolve_import_item(uuid, text) is
  'M5. Weist einem nicht erkannten Eintrag von Hand einen Film zu. Der '
  'naechste Durchlauf traegt ihn dann ein. Nur am eigenen Import.';

revoke execute on function public.resolve_import_item(uuid, text) from public;
grant execute on function public.resolve_import_item(uuid, text) to authenticated;

create or replace function public.skip_import_item(item uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  gehoert boolean;
begin
  select exists (
    select 1
      from public.import_items i
      join public.import_batches b on b.id = i.batch_id
     where i.id = item
       and b.user_id = (select auth.uid())
  ) into gehoert;

  if not gehoert then
    return false;
  end if;

  update public.import_items
     set status = 'skipped', processed_at = now()
   where id = item;

  return true;
end;
$$;

comment on function public.skip_import_item(uuid) is
  'M5. Legt einen nicht erkannten Eintrag beiseite. Die Zeile bleibt '
  'stehen — sonst taucht sie beim naechsten Import derselben Datei wieder '
  'auf, und das Beiseitelegen waere folgenlos.';

revoke execute on function public.skip_import_item(uuid) from public;
grant execute on function public.skip_import_item(uuid) to authenticated;

-- --------------------------------------------------------------------
-- Was noch offen ist
-- --------------------------------------------------------------------
--
-- Ueber alle Staepel des Nutzers, nicht nur den letzten: wer zweimal
-- importiert hat, soll nicht zwei Listen durchgehen muessen.

create or replace function public.unmatched_imports(max_results integer default 100)
returns table (
  id         uuid,
  batch_id   uuid,
  kind       public.import_item_kind,
  status     public.import_item_status,
  raw_title  text,
  raw_year   integer,
  rating     smallint,
  watched_on date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.id, i.batch_id, i.kind, i.status, i.raw_title, i.raw_year, i.rating, i.watched_on
  from public.import_items i
  join public.import_batches b on b.id = i.batch_id
  where b.user_id = (select auth.uid())
    and i.status in ('failed', 'needs_review')
  order by i.raw_title, i.raw_year
  limit greatest(1, least(max_results, 500));
$$;

comment on function public.unmatched_imports(integer) is
  'M5. Was aus allen eigenen Importen offen ist. Security invoker — die '
  'Policy auf import_items zeigt nur die eigenen.';

revoke execute on function public.unmatched_imports(integer) from public;
grant execute on function public.unmatched_imports(integer) to authenticated;
