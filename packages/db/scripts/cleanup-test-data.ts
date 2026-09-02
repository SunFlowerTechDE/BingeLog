/**
 * Removes accounts and catalogue rows created by testing.
 *
 *   pnpm --filter @binge-log/db cleanup:test
 *
 * Only ever touches addresses on TEST_DOMAIN. That restriction is the
 * point of the file: an ad-hoc loop written to find out which account is
 * left over deleted a real one, because it had no filter. A script with
 * the rule written down cannot make that mistake twice.
 *
 * It reports what it would do and refuses to touch anything else, so a
 * catalog row or a real account is never at stake.
 */
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../src/types.generated.ts';

const TEST_DOMAIN = '@bingelog.test';

/**
 * Die Unterschrift der Katalogzeilen aus `tests/helpers.ts`.
 *
 * `createTestFilm` schreibt genau diese beiden Titel. Geprueft werden
 * **beide** und nicht einer: ein echter Film koennte "RLS Fixture"
 * heissen, aber keiner heisst so und traegt zugleich "RLS-Vorrichtung"
 * als deutschen Titel. Dieselbe Strenge wie bei der Adressregel oben.
 */
const FIXTURE_TITLE_ORIGINAL = 'RLS Fixture';
const FIXTURE_TITLE_DE = 'RLS-Vorrichtung';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. See packages/db/.env.example.`);
  return value;
}

const admin = createClient<Database>(
  required('SUPABASE_URL'),
  required('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

// --------------------------------------------------------------------
// Katalogzeilen
// --------------------------------------------------------------------
//
// `pnpm test:rls` legt Filme ueber den Service-Role-Key an und raeumt
// sie am Ende wieder weg — ausser der Lauf bricht vorher ab. Am
// 30.08.2026 sind so sechzehn Zeilen im Produktivkatalog liegen
// geblieben und erst am 02.09.2026 aufgefallen, weil sie als Filme ohne
// Kategorie in einer ganz anderen Auswertung auftauchten.
const { data: fixtures } = await admin
  .from('films')
  .select('wikidata_id')
  .eq('title_original', FIXTURE_TITLE_ORIGINAL)
  .eq('title_de', FIXTURE_TITLE_DE);

const fixtureIds = (fixtures ?? []).map((row) => row.wikidata_id);

if (fixtureIds.length === 0) {
  console.log('No leftover catalogue fixtures.');
} else {
  // Erst nachsehen, ob wirklich niemand daran haengt. Ein Testfilm, an
  // dem ein echter Tagebucheintrag klebt, ist kein Testfilm mehr — dann
  // ist etwas anderes schiefgelaufen, und Loeschen macht es schlimmer.
  const [{ count: eintraege }, { count: vorgemerkt }, { count: gelistet }] = await Promise.all([
    admin
      .from('diary_entries')
      .select('id', { count: 'exact', head: true })
      .in('film_id', fixtureIds),
    admin
      .from('watchlist')
      .select('film_id', { count: 'exact', head: true })
      .in('film_id', fixtureIds),
    admin
      .from('list_items')
      .select('film_id', { count: 'exact', head: true })
      .in('film_id', fixtureIds),
  ]);

  const haengtDran = (eintraege ?? 0) + (vorgemerkt ?? 0) + (gelistet ?? 0);

  if (haengtDran > 0) {
    console.log(
      `refused ${String(fixtureIds.length)} catalogue fixture(s): ` +
        `${String(haengtDran)} user row(s) point at them. Look before removing.`,
    );
  } else {
    const { error: filmError } = await admin.from('films').delete().in('wikidata_id', fixtureIds);
    console.log(
      filmError
        ? `failed  ${String(fixtureIds.length)} catalogue fixture(s): ${filmError.message}`
        : `removed ${String(fixtureIds.length)} catalogue fixture(s)`,
    );
  }
}

// --------------------------------------------------------------------
// Konten
// --------------------------------------------------------------------

const { data, error } = await admin.auth.admin.listUsers();
if (error) throw new Error(error.message);

const testAccounts = data.users.filter((user) => user.email?.endsWith(TEST_DOMAIN));
const spared = data.users.length - testAccounts.length;

if (testAccounts.length === 0) {
  console.log(`No test accounts. ${String(spared)} account(s) left untouched.`);
  process.exit(0);
}

for (const user of testAccounts) {
  // Erst das Bild, dann das Konto. Der Objektspeicher kaskadiert nicht:
  // faellt die Zeile zuerst, bleibt eine Datei liegen, zu der es kein
  // Profil mehr gibt und die niemand mehr zuordnen kann.
  const { data: profil } = await admin
    .from('profiles')
    .select('avatar_path')
    .eq('id', user.id)
    .maybeSingle();

  if (profil?.avatar_path) {
    await admin.storage.from('avatars').remove([profil.avatar_path]);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  console.log(
    deleteError
      ? `failed  ${user.email ?? user.id}: ${deleteError.message}`
      : `removed ${user.email ?? user.id}`,
  );
}

console.log(`\n${String(spared)} account(s) outside ${TEST_DOMAIN} left untouched.`);
