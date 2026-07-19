import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/referrals/track — log a referral
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referred_by_client_id, referred_by_name, new_client_name, new_client_email, source_note, booking_id } = body;

    if (!new_client_name || !new_client_email) {
      return NextResponse.json({ error: 'new_client_name and new_client_email are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('referral_tracking')
      .insert({
        referred_by_client_id: referred_by_client_id || null,
        referred_by_name: referred_by_name || null,
        new_client_name,
        new_client_email,
        source_note: source_note || null,
        booking_id: booking_id || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, referral: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/referrals/track — fetch referral analytics
export async function GET() {
  try {
    const { data: referrals, error } = await supabase
      .from('referral_tracking')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Aggregate by referrer
    const byReferrer: Record<string, { name: string; count: number; converted: number }> = {};
    for (const r of referrals ?? []) {
      const key = r.referred_by_client_id || r.referred_by_name || 'Unknown';
      if (!byReferrer[key]) {
        byReferrer[key] = { name: r.referred_by_name || 'Unknown', count: 0, converted: 0 };
      }
      byReferrer[key].count++;
      if (r.status === 'converted') byReferrer[key].converted++;
    }

    return NextResponse.json({
      total: referrals?.length ?? 0,
      converted: referrals?.filter(r => r.status === 'converted').length ?? 0,
      pending: referrals?.filter(r => r.status === 'pending').length ?? 0,
      by_referrer: Object.values(byReferrer).sort((a, b) => b.count - a.count),
      recent: referrals?.slice(0, 20) ?? [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
