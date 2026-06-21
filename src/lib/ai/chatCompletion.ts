import { callAIEndpoint } from './aiClient';

const ENDPOINT = '/api/ai/chat-completion';

// Default cost-efficient model
const DEFAULT_PROVIDER = 'OPEN_AI';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Unified chat completion helper.
 *
 * Supports two call signatures for backward compatibility:
 *   1. getChatCompletion(provider, model, messages, parameters?)  — explicit provider/model
 *   2. getChatCompletion(messages, options?)                       — legacy shorthand (defaults to gpt-4o-mini)
 *
 * Returns the full API response object for the explicit form,
 * or the text content string for the legacy shorthand form.
 */
export async function getChatCompletion(
  providerOrMessages: string | object[],
  modelOrOptions?: string | Record<string, unknown>,
  messages?: object[],
  parameters: Record<string, unknown> = {}
): Promise<any> {
  // ── Legacy shorthand: getChatCompletion(messages[], options?) ─────────────
  if (Array.isArray(providerOrMessages)) {
    const msgs = providerOrMessages;
    const opts = (modelOrOptions as Record<string, unknown>) ?? {};
    const { model = DEFAULT_MODEL, ...rest } = opts;
    // Apply a sensible default token cap to keep costs low
    const safeParams = { max_completion_tokens: 2000, ...rest };
    const data = await callAIEndpoint(ENDPOINT, {
      provider: DEFAULT_PROVIDER,
      model,
      messages: msgs,
      stream: false,
      parameters: safeParams,
    });
    // Return plain text for legacy callers
    return data?.choices?.[0]?.message?.content ?? '';
  }

  // ── Explicit form: getChatCompletion(provider, model, messages[], params?) ─
  const provider = providerOrMessages as string;
  const model = modelOrOptions as string;
  // Apply a sensible default token cap
  const safeParams = { max_completion_tokens: 2000, ...parameters };
  return callAIEndpoint(ENDPOINT, {
    provider,
    model,
    messages,
    stream: false,
    parameters: safeParams,
  });
}

export async function getStreamingChatCompletion(
  provider: string,
  model: string,
  messages: object[],
  onChunk: (chunk: any) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  parameters: object = {}
) {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, messages, stream: true, parameters }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || `HTTP error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk' && data.chunk) {
              onChunk(data.chunk);
            } else if (data.type === 'done') onComplete();
            else if (data.type === 'error') {
              console.error('API Route Error:', {
                error: data.error,
                details: data.details,
              });
              onError(new Error(data.error));
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('Streaming error:', error);
    onError(error instanceof Error ? error : new Error('Streaming error'));
  }
}
