import { createClient } from '@supabase/supabase-js';

/**
 * The pipeline is the only writer of the catalog tables, and the only
 * place in this repo that holds the service-role key (M0 0.2). Nothing
 * here ever runs inside a deployed app.
 */
export function createPipelineClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. See packages/pipeline/.env.example.',
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
}
