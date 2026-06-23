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
  // BROUSSARD_API_URL now points to this site's own domain.
  // Fall back to NEXT_PUBLIC_SITE_URL so it always resolves locally.
  const url =
    process.env.BROUSSARD_API_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://broussardlegalservices.com';

  // BROUSSARD_API_KEY should equal LEGAL_ASSISTANT_KEY (same secret, same site).
  const key =
    process.env.BROUSSARD_API_KEY || process.env.LEGAL_ASSISTANT_KEY;

  if (!key) {
    console.warn(
      'Broussard sync skipped: missing BROUSSARD_API_KEY / LEGAL_ASSISTANT_KEY'
    );
    return;
  }

  try {
    const { id, userId, title, summary, messages } = conversation;
    const res = await fetch(`${url}/api/assistant/conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': key,
      },
      body: JSON.stringify({ id, userId, title, summary, messages }),
    });

    if (!res.ok) {
      console.error(`Conversation sync failed: ${res.status} ${await res.text()}`);
      return;
    }

    return await res.json();
  } catch (e) {
    console.error('Failed to sync conversation locally', e);
  }
}
