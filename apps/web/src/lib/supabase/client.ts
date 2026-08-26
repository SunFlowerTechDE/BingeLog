'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@binge-log/db';

import { env } from '@/lib/env';

/**
 * Browser client. Carries the anon key and is subject to RLS like every
 * other caller. Security rules live in the database, never here.
 */
export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}
