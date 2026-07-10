import { NextRequest, NextResponse } from 'next/server';
import { transcription } from '@rocketnew/llm-sdk';

const API_KEYS: Record<string, string | undefined> = {
  OPEN_AI: process.env.OPENAI_API_KEY,
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
  let provider: string | undefined;

  try {
    const formData = await request.formData();
    provider = formData.get('provider')?.toString();
    const model = formData.get('model')?.toString();
    const parametersRaw = formData.get('parameters')?.toString() ?? '{}';
    const fileEntry = formData.get('file');

    if (!provider || !model || !(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, model, file', details: 'Request validation failed (expected multipart/form-data with a named File part)' },
        { status: 400 }
      );
    }

    let parameters: Record<string, any> = {};
    try {
      parameters = parametersRaw ? JSON.parse(parametersRaw) : {};
    } catch {
      return NextResponse.json(
        { error: 'Invalid parameters', details: 'parameters must be valid JSON' },
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

    const response = await transcription({
      ...parameters,
      model,
      file: fileEntry,
      api_key: apiKey,
    });

    return NextResponse.json(response);
  } catch (error) {
    const formatted = formatErrorResponse(error, provider);
    console.error('API Route Error:', { error: formatted.error, details: formatted.details });
    return NextResponse.json(
      { error: formatted.error, details: formatted.details },
      { status: formatted.statusCode }
    );
  }
}

