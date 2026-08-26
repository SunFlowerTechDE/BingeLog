import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@binge-log/db';

import { env } from '@/lib/env';

/**
 * Server client for Server Components, Route Handlers and Server Actions.
 *
 * It carries the anon key and the caller's session, so RLS applies here
 * exactly as it does in the browser. Running on the server grants no extra
 * rights, which is the point: the spoiler gate (ADR-010) cannot be
 * sidestepped by moving a query server-side.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware instead (M3).
        }
      },
    },
  });
}
