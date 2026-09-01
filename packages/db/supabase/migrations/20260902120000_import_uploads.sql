-- Wo die hochgeladene Exportdatei liegt (M5).
--
-- **Nicht oeffentlich, und nicht laenger als noetig.** Die Datei ist die
-- halbe Filmgeschichte eines Menschen: wann er was gesehen hat, was er
-- darueber geschrieben hat. Sie wird gelesen, verarbeitet und geloescht.
--
-- Der Pfad ist `<user-id>/<batch-id>.zip`. Die Policy prueft den ersten
-- Ordner gegen `auth.uid()` — ein anderer Ordner wird abgewiesen, und
-- damit kann niemand die Datei eines anderen hochladen oder lesen.

-- Das lokale Postgres der Tests kennt kein `storage`-Schema. Ohne diese
-- Pruefung bricht die Migration dort ab — und ein fehlgeschlagener
-- Migrationslauf laesst in der Harness jeden Test abgebrochen statt
-- fehlgeschlagen aussehen. Dieselbe Umschliessung wie bei `avatars` und
-- `banners`.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'Schema storage fehlt, Bucket wird uebersprungen';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'imports',
    'imports',
    false,
    -- 25 MB. Ein Export mit 10.000 Filmen liegt bei wenigen Megabyte;
    -- alles darueber ist keine Filmgeschichte mehr.
    26214400,
    array['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
  )
  on conflict (id) do update
    set public             = false,
        file_size_limit    = 26214400,
        allowed_mime_types = array[
          'application/zip', 'application/x-zip-compressed', 'application/octet-stream'
        ];

  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'imports_own_insert'
  ) then
    execute $p$
      create policy imports_own_insert on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'imports'
          and (storage.foldername(name))[1] = (select auth.uid())::text
        );
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'imports_own_read'
  ) then
    execute $p$
      create policy imports_own_read on storage.objects
        for select to authenticated
        using (
          bucket_id = 'imports'
          and (storage.foldername(name))[1] = (select auth.uid())::text
        );
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'imports_own_delete'
  ) then
    execute $p$
      create policy imports_own_delete on storage.objects
        for delete to authenticated
        using (
          bucket_id = 'imports'
          and (storage.foldername(name))[1] = (select auth.uid())::text
        );
    $p$;
  end if;
end $$;
