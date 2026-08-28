-- Profilbilder.
--
-- Der Pfad steht in `profiles`, die Datei im Objektspeicher. Ein Bild
-- gehoert nicht in die Datenbank: es waere in jedem Backup, in jeder
-- Abfrage auf `select *` und in jedem Dump, den jemand herumschickt.
--
-- Pfadform: `{user_id}/{zufall}.webp` — seit 20260828220000 auch `.jpg`
--
-- Der erste Teil traegt die Regel — nur wer die ID besitzt, darf in den
-- Ordner schreiben. Der zweite sorgt dafuer, dass ein neues Bild eine
-- neue Adresse bekommt: sonst zeigen Browser und CDN tagelang das alte,
-- und der Nutzer glaubt, das Hochladen sei fehlgeschlagen.

alter table public.profiles
  add column avatar_path text;

comment on column public.profiles.avatar_path is
  'Pfad im Bucket `avatars`, Form {user_id}/{zufall}.webp. NULL heisst: '
  'Initialen anzeigen.';

-- --------------------------------------------------------------------
-- Der Bucket
-- --------------------------------------------------------------------
--
-- Nur auf einer echten Supabase-Instanz. Das lokale Testpostgres kennt
-- das Schema `storage` nicht, und die Schemapruefung soll daran nicht
-- scheitern — genauso wie beim pg_cron-Auftrag in 20260826090200.

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'Schema storage fehlt, Bucket wird uebersprungen';
    return;
  end if;

  -- Oeffentlich lesbar, weil ein Profilbild auf einer oeffentlichen
  -- Profilseite steht. Signierte Adressen waeren eine Sperre vor einer
  -- offenen Tuer.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 262144, array['image/webp'])
  on conflict (id) do update
    set public             = true,
        file_size_limit    = 262144,
        allowed_mime_types = array['image/webp'];

  -- 256 KB und ausschliesslich WebP. Verkleinert wird im Browser, bevor
  -- etwas losgeht; diese Grenze faengt ab, wer das umgeht. Ein
  -- Handyfoto von sechs Megabyte fuer einen Kreis von 96 Pixeln zahlt
  -- sonst der Betreiber — an Speicher und an Verkehr.

  execute $p$
    create policy avatars_read on storage.objects
      for select to anon, authenticated
      using (bucket_id = 'avatars');
  $p$;

  -- Der Ordnername ist die Nutzer-ID. Wer nicht sie ist, schreibt nicht
  -- hinein. Das ist dieselbe Trennung wie bei den Tagebucheintraegen,
  -- nur eine Ebene tiefer.
  execute $p$
    create policy avatars_own_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  $p$;

  execute $p$
    create policy avatars_own_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  $p$;

  execute $p$
    create policy avatars_own_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  $p$;
end
$$;

-- --------------------------------------------------------------------
-- Was beim Loeschen eines Kontos passiert
-- --------------------------------------------------------------------
--
-- **Nichts, und das ist eine offene Flanke.** Die Datenbank raeumt per
-- Kaskade auf, der Objektspeicher nicht: loescht jemand sein Konto,
-- bleibt sein Gesicht liegen.
--
-- Ein Trigger kann das nicht erledigen — Postgres kommt an den
-- Objektspeicher nicht heran. Es gehoert in den Weg, der ein Konto
-- loescht, und den gibt es noch nicht. Wenn er gebaut wird, gehoert das
-- Entfernen des Ordners dazu, bevor die Zeile faellt.
--
-- Bis dahin betrifft es niemanden, weil sich noch niemand loeschen
-- kann. Sobald doch, ist es eine Pflicht und keine Aufraeumarbeit.
