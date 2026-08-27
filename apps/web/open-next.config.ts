import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * Cloudflare is where the app runs (docs/betrieb/hosting.md). Vercel's
 * Hobby tier is non-commercial only and names donations explicitly, so
 * the supporter subscription in M7 would have ruled it out anyway.
 *
 * No incremental cache configured: nothing in this app is statically
 * regenerated. Search results depend on the query, film pages on the
 * catalog, and posters carry their own cache headers.
 */
export default defineCloudflareConfig();
