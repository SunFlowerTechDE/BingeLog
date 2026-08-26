import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/proxy';

/**
 * Next 16 renamed this convention from middleware to proxy. Same job:
 * refresh the session on every request and keep unauthenticated
 * callers out of the protected routes (M3 3.1).
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the poster route. Posters are
     * cached for a year and carry no session; running auth on them would
     * make every tile in a grid refresh a token.
     */
    '/((?!_next/static|_next/image|favicon.ico|poster/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
