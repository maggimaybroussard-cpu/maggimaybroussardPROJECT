import { callAIEndpoint } from './aiClient';

const ENDPOINT = '/api/ai/chat-completion';

// Default cost-efficient model
const DEFAULT_PROVIDER = 'OPEN_AI';
const DEFAULT_MODEL = 'gpt-4o-mini';

// Fallback providers when primary hits rate limits or quota errors
const PROVIDER_FALLBACKS: Record<string, { provider: string; model: string }[]> = {
  OPEN_AI: [
    { provider: 'GEMINI', model: 'gemini-2.0-flash' },
    { provider: 'ANTHROPIC', model: 'claude-haiku-4-5' },
  ],
  GEMINI: [
    { provider: 'OPEN_AI', model: 'gpt-4o-mini' },
    { provider: 'ANTHROPIC', model: 'claude-haiku-4-5' },
  ],
};

function isRateLimitOrQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('rate_limit') ||
    lower.includes('ratelimit') ||
    lower.includes('quota') ||
    lower.includes('billing') ||
    lower.includes('exceeded') ||
    lower.includes('insufficient_quota') ||
    lower.includes('busy')
  );
}

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

async function attemptStreaming(
  provider: string,
  model: string,
  messages: object[],
  onChunk: (chunk: any) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  parameters: object
): Promise<'success' | 'rate_limit' | 'error'> {
  return new Promise(async (resolve) => {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, messages, stream: true, parameters }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error: ${response.status}`;
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          // ignore JSON parse error
        }
        if (response.status === 429 || errorMessage.includes('429')) {
          resolve('rate_limit');
          return;
        } else if (response.status === 503 || response.status === 502) {
          errorMessage = 'The AI service is temporarily unavailable. Please try again shortly.';
        }
        resolve('error');
        onError(new Error(errorMessage));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        resolve('error');
        onError(new Error('Response body is not readable'));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let resolved = false;

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
                if (!resolved) {
                  resolved = true;
                  resolve('success');
                }
                onChunk(data.chunk);
              } else if (data.type === 'done') {
                if (!resolved) resolve('success');
                onComplete();
              } else if (data.type === 'error') {
                console.error('API Route Error:', { error: data.error, details: data.details });
                const combinedMsg = `${data.error || ''} ${data.details || ''}`;
                if (isRateLimitOrQuotaError(combinedMsg)) {
                  if (!resolved) {
                    resolved = true;
                    resolve('rate_limit');
                  }
                  return;
                }
                let errMsg = data.error || 'Streaming error';
                if (!resolved) {
                  resolved = true;
                  resolve('error');
                }
                onError(new Error(errMsg));
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      if (!resolved) resolve('success');
    } catch (error) {
      console.error('Streaming error:', error);
      resolve('error');
      onError(error instanceof Error ? error : new Error('Streaming error'));
    }
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
  // Build attempt list: primary + fallbacks
  const fallbacks = PROVIDER_FALLBACKS[provider] || [];
  const attempts = [
    { provider, model },
    ...fallbacks,
  ];

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    const isLast = i === attempts.length - 1;

    const result = await attemptStreaming(
      attempt.provider,
      attempt.model,
      messages,
      onChunk,
      onComplete,
      isLast ? onError : () => {},
      parameters
    );

    if (result === 'success') return;

    if (result === 'rate_limit') {
      if (!isLast) {
        console.warn(`Provider ${attempt.provider} rate limited, trying fallback ${attempts[i + 1].provider}...`);
        continue;
      }
      // All providers exhausted
      onError(new Error('The AI assistant is currently busy. Please wait a moment and try again.'));
      return;
    }

    if (result === 'error') {
      // Non-rate-limit error — don't fallback, already called onError
      return;
    }
  }
}
