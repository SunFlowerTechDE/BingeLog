-- Das Bild ueber dem Profil.
--
-- Dieselbe Bauart wie beim Profilbild in 20260828210000: Pfad in
-- `profiles`, Datei im Objektspeicher, Ordnername ist die Nutzer-ID.
-- Ein eigener Bucket und keine gemeinsame Ablage, weil die Grenzen
-- verschieden sind — ein Streifen ueber die volle Breite darf mehr
-- wiegen als ein Kreis von 96 Pixeln.
--
-- Pfadform: `{user_id}/{zufall}.webp`, auch `.jpg`
--
-- 400 KB. Das Bild steht ueber der Seite und wird als erstes geladen;
-- was hier zu schwer ist, verzoegert alles Uebrige. Zugeschnitten und
-- verkleinert wird im Browser, diese Grenze faengt ab, wer das umgeht.

alter table public.profiles
  add column banner_path text;

comment on column public.profiles.banner_path is
  'Pfad im Bucket `banners`. NULL heisst: kein Bild, das Profil beginnt '
  'auf dem normalen Grund.';

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'Schema storage fehlt, Bucket wird uebersprungen';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('banners', 'banners', true, 409600, array['image/webp', 'image/jpeg'])
  on conflict (id) do update
    set public             = true,
        file_size_limit    = 409600,
        allowed_mime_types = array['image/webp', 'image/jpeg'];

  execute $p$
    create policy banners_read on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'banners');
  $p$;

  execute $p$
    create policy banners_own_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'banners'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  $p$;

  execute $p$
    create policy banners_own_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'banners'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  $p$;

  execute $p$
    create policy banners_own_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'banners'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  $p$;
end
$$;

-- Beim Loeschen eines Kontos gilt dasselbe wie fuer das Profilbild: die
-- Kaskade raeumt die Zeile, den Objektspeicher raeumt sie nicht. Wer den
-- Loeschweg baut, muss **beide** Ordner mitnehmen.
