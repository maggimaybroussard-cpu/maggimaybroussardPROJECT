import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// POST /api/retainer/check-hours
// Triggers the check-retainer-hours edge function for one or all active subscriptions
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { subscriptionId } = body;

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 503 });
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/check-retainer-hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(subscriptionId ? { subscriptionId } : {}),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error ?? `check-retainer-hours returned ${res.status}`);
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to check retainer hours' },
      { status: 500 }
    );
  }
}
