import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;

/**
 * POST /api/lexi/tts
 * Converts text to speech using ElevenLabs API for Lexi voice responses.
 * Body: { text: string, voice_id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice_id = '21m00Tcm4TlvDq8ikWAM' } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Missing required field: text' }, { status: 400 });
    }

    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.slice(0, 5000), // ElevenLabs limit
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[ElevenLabs TTS] API error:', errData);
      return NextResponse.json(
        { error: errData?.detail?.message ?? `ElevenLabs API error: ${response.status}` },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[/api/lexi/tts] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
