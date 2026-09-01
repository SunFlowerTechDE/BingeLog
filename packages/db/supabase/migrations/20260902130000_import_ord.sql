-- Die Reihenfolge der Favoriten aus dem Import (M5).
--
-- `profile.csv` nennt die Favoriten in ihrer Reihenfolge, und die ist
-- Teil der Aussage: Platz eins ist Platz eins. Ohne diese Spalte
-- kaeme sie beim Abarbeiten der Zeilen abhanden — die werden in
-- Scheiben verarbeitet, und deren Reihenfolge ist nicht die der Datei.

alter table public.import_items
  add column ord smallint;

comment on column public.import_items.ord is
  'Der Platz, fuer Favoriten aus profile.csv. Sonst null.';
