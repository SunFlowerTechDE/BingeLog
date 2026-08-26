import { createClient } from '@supabase/supabase-js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy packages/db/.env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const SUPABASE_URL = required('SUPABASE_URL');
export const ANON_KEY = required('SUPABASE_ANON_KEY');
const SERVICE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');

/** Bypasses RLS. Used for fixtures and teardown only, never for assertions. */
export const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Anonymous client: what an unauthenticated visitor sees. */
export function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  client: ReturnType<typeof anonClient>;
}

let userCounter = 0;

/**
 * Creates a confirmed auth user plus its profile and returns a client
 * signed in as that user. Signed-in clients carry the anon key, so every
 * assertion made through them goes through RLS exactly as the app does.
 */
export async function createTestUser(label: string): Promise<TestUser> {
  const suffix = `${String(Date.now())}-${String(userCounter++)}`;
  const email = `rls-${label}-${suffix}@bingelog.test`;
  const password = `test-${suffix}-Aa1!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error ?? !data.user) throw error ?? new Error('user creation returned no user');
  const id = data.user.id;

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id, username: `rls_${label}_${String(userCounter)}`.slice(0, 24) });
  if (profileError) throw profileError;

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id, email, password, client };
}

export async function deleteTestUser(user: TestUser): Promise<void> {
  await user.client.auth.signOut();
  await admin.auth.admin.deleteUser(user.id);
}

/**
 * Distinguishes one test run from another. Deriving the IMDb id from the
 * film id looked fine but took the leading digits of the epoch, which are
 * identical for every film created in the same era — so every fixture
 * collided on the unique index after the first one.
 */
const RUN_PREFIX = String(Math.floor(Math.random() * 9000) + 1000);

/** Inserts a catalog film via the service role, the pipeline's only path in. */
export async function createTestFilm(wikidataId: string): Promise<void> {
  const { error } = await admin.from('films').insert({
    wikidata_id: wikidataId,
    imdb_id: `tt${RUN_PREFIX}${String(userCounter++).padStart(5, '0')}`,
    title_original: 'RLS Fixture',
    title_de: 'RLS-Vorrichtung',
    release_year: 2000,
    sitelink_count: 1,
  });
  if (error) throw error;
}

export async function deleteTestFilm(wikidataId: string): Promise<void> {
  await admin.from('films').delete().eq('wikidata_id', wikidataId);
}

export function uniqueFilmId(): string {
  return `Q9${RUN_PREFIX}${String(userCounter++).padStart(5, '0')}`;
}
