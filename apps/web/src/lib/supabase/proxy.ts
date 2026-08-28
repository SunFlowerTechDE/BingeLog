import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@binge-log/db';

import { env } from '@/lib/env';

/**
 * Routes that require a signed-in user. Everything else — the catalog,
 * search, a public diary — is readable without an account, because RLS
 * already decides what a visitor may see (M0 0.3).
 */
const PROTECTED = ['/tagebuch', '/einstellungen', '/willkommen', '/watchlist'];

/**
 * Refreshes the session on every request and keeps unauthenticated
 * callers out of the protected routes.
 *
 * The session lives in cookies, never in local storage: a token in local
 * storage is readable by any script that ends up on the page, and it
 * cannot be refreshed server-side (M3 3.1).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser, not getSession: it verifies the token with the auth server
  // instead of trusting whatever the cookie claims.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (needsAuth && !user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/anmelden';
    // So the user lands where they were going, not on the home page.
    redirect.searchParams.set('weiter', pathname);
    return NextResponse.redirect(redirect);
  }

  return response;
}
