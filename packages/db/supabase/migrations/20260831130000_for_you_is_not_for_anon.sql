-- `films_for_me` ist wirklich nur fuer Angemeldete.
--
-- Das `grant execute ... to authenticated` in …120000 hat nichts
-- ausgeschlossen, und der Grund ist aelter als Supabase: **Postgres
-- vergibt `EXECUTE` auf jede neue Funktion an `PUBLIC`.** Jede Rolle hat
-- es also von Anfang an, ein Grant fuegt nur einen zweiten Weg dazu, und
-- ein `revoke ... from anon` laeuft ins Leere, solange `PUBLIC` das
-- Recht noch traegt.
--
-- Aufgefallen ist es ueber PostgREST: der anonyme Aufruf ging durch.
--
-- Ausgelaufen ist dabei nichts. Die Funktion ist `security invoker` und
-- liest ueber `auth.uid()`, das ohne Sitzung `null` ist; sie antwortet
-- mit einer leeren Liste. Aber "es faellt nichts an" ist kein
-- Zugriffsschutz, sondern eine gluecklche Fuegung, und die naechste
-- Aenderung an der Abfrage koennte sie aufheben.
--
-- Dieselbe Lage haben `following_feed` und `my_facet_ratings` — und
-- streng genommen jede Funktion im Projekt, die nur an `authenticated`
-- gegrantet ist. Alle verhalten sich aus demselben Grund harmlos, und
-- alle werden im Web nur fuer Angemeldete aufgerufen. Sie hier
-- mitzuaendern waere ein Eingriff in Wege, die laufen, ohne dass ein
-- Test sie deckt. Deshalb nur die neue Funktion — und der Befund steht
-- hier, damit er nicht verlorengeht.

revoke execute on function public.films_for_me(integer) from public;
revoke execute on function public.films_for_me(integer) from anon;
grant execute on function public.films_for_me(integer) to authenticated;

comment on function public.films_for_me(integer) is
  'Entdecken-Konzept 3, einfache Fassung: Genres der eigenen gut bewerteten '
  'Filme, daraus Vorschlaege ohne eigenen Tagebucheintrag. Kein '
  'Match-Prozentsatz — eine Genre-Zaehlung traegt keine Prozentangabe. '
  'Security invoker, und PUBLIC ist das Ausfuehren entzogen: Postgres '
  'vergibt EXECUTE sonst an jede Rolle, und ein Grant schliesst niemanden aus.';
