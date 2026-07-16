import { NextResponse } from 'next/server';
import { pushConversationToBroussard } from '@/lib/broussard';

export async function POST() {
  const testConversation = {
    id: `test-${Date.now()}`,
    userId: 'rocketai-test-user',
    title: 'RocketAI Test Conversation',
    messages: [
      { role: 'user', content: 'Hello, I need help with a legal matter.' },
      {
        role: 'assistant',
        content:
          'Hello! I\'m Lexi, the Broussard Legal Services AI assistant. I\'d be happy to help. Could you briefly describe your legal situation?',
      },
      {
        role: 'user',
        content: 'I have a question about a contract dispute with a vendor.',
      },
      {
        role: 'assistant',
        content:
          'Contract disputes can be complex. I recommend scheduling a consultation with Ms. Broussard to review the contract terms and discuss your options. Would you like me to help you book a consultation?',
      },
    ],
  };

  const result = await pushConversationToBroussard(testConversation);

  if (!result) {
    return NextResponse?.json(
      {
        ok: false,
        message:
          'Sync skipped or failed. Check server logs and verify BROUSSARD_API_URL and BROUSSARD_API_KEY are set.',
      },
      { status: 500 }
    );
  }

  return NextResponse?.json({
    ok: true,
    message: `Broussard sync successful — conversation ${result?.created ? 'created' : 'updated'} (ID: ${result?.conversationId}, messages: ${result?.messageCount})`,
    result,
  });
}
