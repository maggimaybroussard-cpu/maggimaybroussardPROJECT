import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minStartTime = searchParams.get('min_start_time') ?? '';
  const maxStartTime = searchParams.get('max_start_time') ?? '';
  const status = searchParams.get('status') ?? 'active';
  const count = searchParams.get('count') ?? '50';

  const CALENDLY_API_KEY = process.env.CALENDLY_API_KEY ?? process.env.NEXT_PUBLIC_CALENDLY_URL ?? '';

  // We need the user URI first — hardcode the known user URI from the connected account
  const USER_URI = 'https://api.calendly.com/users/146764ec-ae3f-436f-9374-789ea7b21ce4';

  const params = new URLSearchParams({
    user: USER_URI,
    status,
    count,
    sort: 'start_time:asc',
  });
  if (minStartTime) params.set('min_start_time', minStartTime);
  if (maxStartTime) params.set('max_start_time', maxStartTime);

  try {
    // Try to get the Calendly API key from env
    const apiKey = process.env.CALENDLY_API_KEY ?? '';
    if (!apiKey) {
      // Return empty collection gracefully if no key configured
      return NextResponse.json({ collection: [], pagination: { count: 0 } });
    }

    const res = await fetch(`https://api.calendly.com/scheduled_events?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: body, collection: [] }, { status: res.status });
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
