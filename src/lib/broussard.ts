/**
 * broussard.ts
 *
 * Saves legal assistant conversations directly to Supabase.
 * Previously synced to an external Replit endpoint — now fully self-contained.
 */

import { createClient } from '@supabase/supabase-js';

export interface BroussardConversation {
  conversationId?: string;
  clientName?: string;
  clientEmail?: string;
  clientFirm?: string;
  service?: string;
  messages?: Array<{ from: string; text: string }>;
  [key: string]: unknown;
}

export interface BroussardSyncResult {
  ok: boolean;
  conversationId: string;
  created: boolean;
  messageCount: number;
}

export async function pushConversationToBroussard(conversation: {
  id: string | number;
  userId?: string | number;
  title: string;
  summary?: string;
  messages: { role: string; content: string }[];
}): Promise<BroussardSyncResult | undefined> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Broussard sync skipped: Supabase credentials not configured');
    return;
  }

  const { id, userId, title, summary, messages } = conversation;
  const conversationId = String(id);

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if this is a new record
    const { data: existing } = await supabase
      .from('assistant_conversations')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    const isNew = !existing;

    const { error } = await supabase.from('assistant_conversations').upsert(
      {
        conversation_id: conversationId,
        user_id: userId ? String(userId) : null,
        title: String(title),
        summary: summary ?? null,
        messages: messages,
        message_count: messages.length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id' }
    );

    if (error) {
      console.error('Broussard Supabase upsert error:', error);
      return;
    }

    console.log(
      `Broussard sync ok: conversation ${conversationId} ${isNew ? 'created' : 'updated'} (${messages.length} messages)`
    );

    return {
      ok: true,
      conversationId,
      created: isNew,
      messageCount: messages.length,
    };
  } catch (e) {
    console.error('Failed to sync conversation to Supabase', e);
  }
}
