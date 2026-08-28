'use server';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { FEED_SEITE, type FeedEintrag } from '@/lib/feed';

/**
 * Die naechste Seite des Feeds.
 *
 * Cursor statt Offset (M4 4.4): mit Offset verschiebt jeder neue Eintrag
 * waehrend des Blaetterns alles nach hinten, und man bekommt dieselbe
 * Zeile zweimal oder gar nicht.
 */
export async function moreFeed(beforeAt: string, beforeId: string): Promise<FeedEintrag[]> {
  const viewer = await getViewer();
  if (!viewer?.username) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('following_feed', {
    before_at: beforeAt,
    before_id: beforeId,
    max_results: FEED_SEITE,
  });

  if (error) {
    console.error('moreFeed failed:', error.message);
    return [];
  }

  return data;
}
