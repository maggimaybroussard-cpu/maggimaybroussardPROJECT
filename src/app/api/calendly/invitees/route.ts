import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eventUuid = searchParams.get('event_uuid') ?? '';

  if (!eventUuid) {
    return NextResponse.json({ collection: [] });
  }

  const apiKey = process.env.CALENDLY_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json({ collection: [] });
  }

  try {
    const res = await fetch(
      `https://api.calendly.com/scheduled_events/${eventUuid}/invitees?count=1&status=active`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ collection: [] }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error', collection: [] },
      { status: 500 }
    );
  }
}
