-- Die vier Lieblingsfilme (M4 4.2).
--
-- Vier selbst gewaehlte Filme, die oben auf dem Profil stehen bleiben.
-- **Nicht abgeleitet.** Die bestbewerteten Filme sind eine andere
-- Aussage: man kann einem Film vier Popcorn geben und ihn nie wieder
-- anschauen, und man kann einen Film lieben, dem man nuechtern drei
-- gibt. Die vier Plaetze sind kein Ranking, sondern eine Visitenkarte.
--
-- Deshalb eine Tabelle und keine Abfrage ueber `diary_entries`.
--
-- Waehlbar ist jeder Film aus dem Katalog, nicht nur die eigenen
-- Eintraege. Einen Lieblingsfilm hat man oft, lange bevor man ihn hier
-- eintraegt — und ein Profil, dessen vier Plaetze erst nach dem
-- zwanzigsten Eintrag befuellbar sind, bleibt leer.

create table public.favourites (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  film_id  text not null references public.films(wikidata_id) on delete cascade,
  -- Die Reihenfolge ist Teil der Aussage: Platz eins ist Platz eins.
  position smallint not null check (position between 1 and 4),

  primary key (user_id, position),
  -- Derselbe Film nicht zweimal. Vier Plaetze, vier Filme.
  unique (user_id, film_id)
);

comment on table public.favourites is
  'M4 4.2. Vier selbst gewaehlte Filme je Profil. Bewusst nicht aus den '
  'Bewertungen abgeleitet — Lieblingsfilm und Bestnote sind zweierlei.';

alter table public.favourites enable row level security;

-- Oeffentlich lesbar. Sie sind eine Visitenkarte, das ist ihr Zweck;
-- ein Schalter dafuer waere eine Einstellung fuer etwas, das ohnehin
-- jeder zeigen will. Anders als die Watchlist, die eine Absicht verraet
-- und deshalb einen Schalter hat.
create policy favourites_read on public.favourites
  for select to anon, authenticated
  using (true);

-- Schreiben nur am eigenen Profil. `(select auth.uid())` und nicht
-- `auth.uid()`: so wertet Postgres es einmal aus statt je Zeile.
create policy favourites_own_insert on public.favourites
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy favourites_own_update on public.favourites
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy favourites_own_delete on public.favourites
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Das Profil liest sie je Aufruf, sortiert nach Platz. Der
-- Primaerschluessel deckt das ab; ein eigener Index waere Ballast.
