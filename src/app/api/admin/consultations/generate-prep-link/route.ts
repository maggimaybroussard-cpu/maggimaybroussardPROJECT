import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { bookingId } = await req.json();
    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Generate a secure random token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const { data, error } = await supabase
      .from('consultation_bookings')
      .update({ prep_access_token: token })
      .eq('id', bookingId)
      .select('id, prep_access_token')
      .single();

    if (error) throw error;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
    const prepUrl = `${baseUrl}/consultation-prep/${token}`;

    return NextResponse.json({ token, prepUrl, bookingId: data.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate prep link' },
      { status: 500 }
    );
  }
}
