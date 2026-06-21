'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Persists a portal engagement event to the portal_engagement_events table.
 * Call this alongside GA4 trackEvent calls for server-side analytics.
 * Non-blocking — errors are silently swallowed to avoid disrupting UX.
 */
export async function logPortalEvent(
  eventType: string,
  eventData: Record<string, unknown> = {}
): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('portal_engagement_events').insert({
      user_id: user.id,
      event_type: eventType,
      event_data: eventData,
    });
  } catch {
    // Non-blocking — never throw
  }
}
