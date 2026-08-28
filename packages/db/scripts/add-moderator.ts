/**
 * Einen Moderator eintragen.
 *
 *   pnpm --filter @binge-log/db moderator:add <benutzername>
 *
 * Der einzige Weg in die Tabelle `moderators`. Sie hat keine
 * Schreib-Policy — ueber die App kommt niemand hinein, auch der
 * Betreiber nicht. Das ist der Punkt: eine Rolle, die sich aus dem
 * Browser setzen laesst, ist keine.
 *
 * Braucht SUPABASE_SERVICE_ROLE_KEY, den es nur hier und in
 * `packages/pipeline` gibt.
 */
import { createClient } from '@supabase/supabase-js';

const name = process.argv[2]?.replace(/^@/, '');
if (!name) {
  console.error('Usage: moderator:add <username>');
  process.exit(2);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(2);
}

const supabase = createClient(url, key);

const { data: profile, error: lookup } = await supabase
  .from('profiles')
  .select('id, username')
  .eq('username', name.toLowerCase())
  .maybeSingle();

if (lookup) {
  console.error('Lookup failed:', lookup.message);
  process.exit(1);
}
if (!profile) {
  console.error(`No profile named @${name}.`);
  process.exit(1);
}

const { error } = await supabase
  .from('moderators')
  .upsert({ user_id: profile.id }, { onConflict: 'user_id' });

if (error) {
  console.error('Insert failed:', error.message);
  process.exit(1);
}

console.log(`@${String(profile.username)} may now moderate.`);
