/**
 * Environment access for the web workspace.
 *
 * Everything here is public by construction. The service-role key belongs
 * to packages/pipeline and to nothing else (M0 0.2).
 */
function requiredPublic(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Copy apps/web/.env.example to .env.local.`);
  }
  return value;
}

export const env = {
  supabaseUrl: requiredPublic('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: requiredPublic(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
} as const;
