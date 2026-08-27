/**
 * Removes accounts created by manual testing.
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

const TEST_DOMAIN = '@bingelog.test';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. See packages/db/.env.example.`);
  return value;
}

const admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin.auth.admin.listUsers();
if (error) throw new Error(error.message);

const testAccounts = data.users.filter((user) => user.email?.endsWith(TEST_DOMAIN));
const spared = data.users.length - testAccounts.length;

if (testAccounts.length === 0) {
  console.log(`Nothing to remove. ${String(spared)} account(s) left untouched.`);
  process.exit(0);
}

for (const user of testAccounts) {
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  console.log(
    deleteError ? `failed  ${user.email ?? user.id}: ${deleteError.message}` : `removed ${user.email ?? user.id}`,
  );
}

console.log(`\n${String(spared)} account(s) outside ${TEST_DOMAIN} left untouched.`);
