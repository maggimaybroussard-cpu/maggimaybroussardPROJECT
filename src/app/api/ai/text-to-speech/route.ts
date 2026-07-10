import { NextRequest, NextResponse } from 'next/server';
import { speech } from '@rocketnew/llm-sdk';

const API_KEYS: Record<string, string | undefined> = {
  OPEN_AI: process.env.OPENAI_API_KEY,
  GEMINI: process.env.GEMINI_API_KEY,
};

function formatErrorResponse(error: unknown, provider?: string) {
  const statusCode = (error as any)?.statusCode || (error as any)?.status || 500;
  const providerName = (error as any)?.llmProvider || provider || 'Unknown';

  return {
    error: `${providerName.toUpperCase()} API error: ${statusCode}`,
    details: error instanceof Error ? error.message : String(error),
    statusCode,
  };
}

export async function POST(request: NextRequest) {
  let body: any = {};

  try {
    body = await request.json();
    const { provider, model, input, voice, parameters = {} } = body;

    if (!provider || !model || !input) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, model, input', details: 'Request validation failed' },
        { status: 400 }
      );
    }

    const apiKey = API_KEYS[provider];
    if (!apiKey) {
      return NextResponse.json(
        { error: `${provider.toUpperCase()} API key is not configured`, details: 'The API key for this provider is missing in environment variables' },
        { status: 400 }
      );
    }

    const audio = await speech({
      ...parameters,
      model,
      input,
      voice,
      api_key: apiKey,
    });

    const contentType = audio.headers.get('content-type') ?? 'audio/mpeg';

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of audio.iterBytes()) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
      cancel() {
        void audio.close();
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: { 'Content-Type': contentType },
    });
  } catch (error) {
    const formatted = formatErrorResponse(error, body?.provider);
    console.error('API Route Error:', { error: formatted.error, details: formatted.details });
    return NextResponse.json(
      { error: formatted.error, details: formatted.details },
      { status: formatted.statusCode }
    );
  }
}

