const ENDPOINT = '/api/ai/text-to-speech';

export async function textToSpeech(
  provider: string,
  model: string,
  input: string,
  voice?: string,
  parameters: object = {}
): Promise<{ blob: Blob; contentType: string }> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model, input, voice, parameters }),
  });

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const data = await response.json();
      if (data?.error) {
        console.error('API Route Error:', {
          error: data.error,
          details: data.details,
        });
        errorMessage = data.error;
      }
    } catch {
      // Response wasn't JSON — fall through with the status-based message.
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type') ?? 'audio/mpeg';
  const blob = await response.blob();
  return { blob, contentType };
}
