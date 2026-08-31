-- Zehn Favoritenplaetze statt vier (31.08.2026).
--
-- Vier war eine Entscheidung fuer Knappheit: wer nur vier nennen darf,
-- nennt die vier, die zaehlen. Zehn ist die Ansage des Produkts, und
-- die Ansage schlaegt die Vermutung.
--
-- **Die Reihenfolge bleibt Teil der Aussage.** Platz eins ist Platz
-- eins, und `swap_favourites` bleibt unveraendert — es tauscht zwei
-- Plaetze, welche das sind, ist ihm gleich. Die aufgeschobene
-- Eindeutigkeit von 20260828270000 traegt den Tausch weiterhin: ohne
-- sie schlaegt er fehl, weil Postgres jede Zeile einzeln prueft.
--
-- Bestehende Zeilen sind alle in 1..4 und damit auch in 1..10 gueltig;
-- es ist eine Erweiterung, kein Umbau. Trotzdem wird die alte Schranke
-- ausdruecklich geloescht und neu gesetzt: `check` laesst sich nicht
-- ersetzen.

alter table public.favourites
  drop constraint favourites_position_check;

alter table public.favourites
  add constraint favourites_position_check check (position between 1 and 10);

comment on column public.favourites.position is
  'Platz 1 bis 10. Die Reihenfolge ist Teil der Aussage — Platz eins ist '
  'Platz eins. Von vier auf zehn erweitert am 31.08.2026.';
