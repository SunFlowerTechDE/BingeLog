import { createClient } from '@/lib/supabase/server';

export interface Viewer {
  id: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
}

/**
 * The signed-in user and their profile, or null.
 *
 * A user without a profile row has signed up but not yet chosen a
 * username; the protected layout sends them to /willkommen. That state is
 * real and short-lived, so it is represented rather than assumed away.
 */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    username: profile?.username ?? null,
    displayName: profile?.display_name ?? null,
  };
}
