-- Die Staging-Tabellen standen im Netz offen.
--
-- Gefunden am 28.08.2026 durch `pnpm db:verify`: die Pruefung "every
-- table in public has RLS enabled" nannte fuenf Tabellen, und dahinter
-- steckte mehr als eine fehlende Zeile.
--
-- `staging_films`, `staging_credits`, `staging_film_genres`,
-- `staging_genres` und `staging_people` liegen im Schema `public`. Das
-- ist das Schema, das PostgREST nach aussen gibt. Ohne RLS entscheiden
-- allein die Rechte, und die standen fuer `anon` und `authenticated` auf
-- allem — SELECT, INSERT, UPDATE, DELETE, **TRUNCATE**.
--
-- Der anon-Schluessel liegt im Browser-Bundle. Er ist dafuer gemacht,
-- oeffentlich zu sein; er traegt keine Rechte, sondern nur die Identitaet
-- "niemand". Hier trug er alle. Nachgewiesen mit einem einfachen Aufruf:
--
--   GET /rest/v1/staging_films?select=wikidata_id  ->  200, Daten
--
-- Ein DELETE waere denselben Weg gegangen. Die Tabellen sind der
-- Zwischenstand des Wikidata-Imports; sie zu leeren haette den naechsten
-- Lauf still verfaelscht, und niemand haette gesehen, woher es kam.
--
-- Sie gehoeren keinem Client. Nur `packages/pipeline` schreibt sie, und
-- das mit dem Service-Role-Schluessel, der RLS ohnehin umgeht.
--
-- Zwei Riegel statt einem: die Rechte entzogen **und** RLS an. Ohne
-- Policy heisst RLS "niemand", und wer spaeter versehentlich wieder
-- Rechte vergibt, oeffnet damit noch nichts.

do $$
declare
  t text;
begin
  foreach t in array array[
    'staging_films',
    'staging_credits',
    'staging_film_genres',
    'staging_genres',
    'staging_people'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$$;

-- Kuenftige Tabellen erben das nicht. Die Pruefung in
-- `scripts/verify.ts` faengt sie, und sie faengt sie erst gegen das
-- echte Projekt — hier war sie es, die den Fund gemacht hat.
