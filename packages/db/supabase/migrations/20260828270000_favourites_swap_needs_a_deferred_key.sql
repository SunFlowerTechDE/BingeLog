-- Der Platztausch scheiterte am Primaerschluessel.
--
-- Gefunden am 28.08.2026 beim Durchklicken auf Staging: "Nach vorn"
-- meldete "Das hat nicht geklappt", die Plaetze blieben stehen.
--
-- Der Schluessel stand auf (user_id, position). Postgres prueft eine
-- eindeutige Bedingung **je Zeile**, nicht am Ende der Anweisung —
-- selbst wenn beide Zeilen in einem einzigen UPDATE stecken. Der Tausch
-- schreibt zuerst Platz eins auf zwei, und Platz zwei gibt es in dem
-- Moment noch. Das Ergebnis waere gueltig gewesen, der Zwischenschritt
-- war es nicht.
--
-- Der Ausweg ist nicht, den Tausch in drei Schritte zu zerlegen — ein
-- Zwischenplatz ausserhalb von 1 bis 4 verstiesse gegen die Pruefung,
-- und ein abgebrochener Vorgang liesse den Film dort liegen.
--
-- Stattdessen tragen die beiden Bedingungen jetzt, was sie meinen:
--
-- **Ein Film hoechstens einmal** — das ist der Primaerschluessel, und
-- der darf sofort pruefen. Ein Film wandert nie durch einen
-- Zwischenzustand.
--
-- **Ein Platz hoechstens einmal** — das ist eine eigene Bedingung, und
-- sie prueft erst beim Abschluss. Genau der Zwischenschritt, den der
-- Tausch braucht.

alter table public.favourites
  drop constraint favourites_pkey,
  drop constraint favourites_user_id_film_id_key;

alter table public.favourites
  add constraint favourites_pkey primary key (user_id, film_id);

alter table public.favourites
  add constraint favourites_one_film_per_place unique (user_id, position)
    deferrable initially deferred;

comment on constraint favourites_one_film_per_place on public.favourites is
  'Aufgeschoben, damit ein Tausch zweier Plaetze in einer Anweisung '
  'moeglich ist. Sofort geprueft schluege der Zwischenschritt fehl, '
  'obwohl das Ergebnis gueltig ist.';
