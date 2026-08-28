-- JPEG als Ausweg zulassen.
--
-- `canvas.toBlob` ignoriert eine Formatangabe, die der Browser nicht
-- kennt, und liefert stillschweigend PNG. Safari konnte lange kein WebP
-- schreiben — der Upload scheiterte dort mit einer Meldung ueber die
-- Groesse, obwohl das Format das Problem war.
--
-- Nachgestellt am 28.08.2026: derselbe Code brachte in Chromium ein
-- Rauschbild von 13 MB auf 107 KB und lehnte in Safari ein gewoehnliches
-- Portraet ab.
--
-- JPEG ist bei einem Portraet in dieser Groesse kaum schlechter. Ein
-- Profilbild nicht hochladen zu koennen, weil der Browser ein Format
-- nicht kennt, waere die schlechteste aller Antworten.
--
-- PNG bleibt draussen: es ist fuer Fotos das falsche Format und wiegt
-- ein Vielfaches.

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    return;
  end if;

  update storage.buckets
     set allowed_mime_types = array['image/webp', 'image/jpeg']
   where id = 'avatars';
end
$$;
