-- Filme von Hand bearbeiten (M4 4.7), und die Korrektur ueberleben
-- lassen.
--
-- **Der Fund zuerst.** `loadFilms` in packages/pipeline schreibt
-- `title_de`, `title_original`, `title_en`, `release_year` und
-- `runtime_min` bei jedem Lauf neu aus Wikidata. Eine Korrektur von Hand
-- waere beim naechsten Import still verschwunden — und "still" ist das
-- Schlimme daran: niemand haette gesehen, warum der falsche Titel wieder
-- dasteht.
--
-- Dass Poster und tvdb_id verschont bleiben, stand schon da. Fuer die
-- Metadaten fehlte die Entsprechung.
--
-- `manual_fields` haelt fest, **welche** Felder ein Mensch gesetzt hat.
-- Der Import laesst genau diese stehen und schreibt alle anderen weiter
-- fort. Ein Flag "dieser Film ist von Hand" waere zu grob: wer einen
-- Titel korrigiert, will trotzdem die neue Laufzeit aus Wikidata.
--
-- Das widerspricht ADR-002 nicht. Dort steht, woher Metadaten kommen
-- duerfen — Wikidata, nicht TheTVDB. Eine Korrektur durch den Betreiber
-- ist keine zweite Quelle, sondern das Eingestaendnis, dass die erste
-- sich irren kann.

alter table public.films
  add column manual_fields text[] not null default '{}',
  add column edited_at     timestamptz,
  add column edited_by     uuid references public.profiles(id) on delete set null;

comment on column public.films.manual_fields is
  'Felder, die ein Mensch gesetzt hat. Der Wikidata-Import laesst genau '
  'diese stehen — siehe packages/pipeline/src/wikidata/load.ts.';

-- --------------------------------------------------------------------
-- FSK
-- --------------------------------------------------------------------
--
-- Von Hand, weil es keine bezahlbare Quelle gibt: die Anfrage bei der
-- FSK ergab 850 Euro einmalig plus 250 im Monat
-- (docs/betrieb/fsk-anfrage.md). Fuer einen Katalog dieser Groesse ist
-- das keine Zahl.
--
-- Die fuenf Stufen sind die amtlichen. `null` heisst **nicht** "ohne
-- Altersbeschraenkung", sondern "wir wissen es nicht" — der Unterschied
-- ist bei einer Altersfreigabe kein sprachlicher.

alter table public.films
  add column fsk smallint check (fsk in (0, 6, 12, 16, 18)),
  add column fsk_note text check (length(fsk_note) <= 200);

comment on column public.films.fsk is
  'Amtliche Stufe: 0, 6, 12, 16, 18. NULL heisst "unbekannt" und nicht '
  '"ohne Beschraenkung". Von Hand gepflegt (docs/betrieb/fsk-anfrage.md).';

create index films_fsk_idx on public.films (fsk) where fsk is not null;

-- Keine Schreib-Policy auf `films` — die Pruefung "catalog tables carry
-- SELECT policies only" in scripts/verify.ts bleibt gueltig. Geschrieben
-- wird aus der Edge Function `admin-film`, wie beim Katalog ueberhaupt.
