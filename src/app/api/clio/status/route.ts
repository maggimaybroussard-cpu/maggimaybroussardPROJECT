import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: token } = await supabase?.from('clio_tokens')?.select('*')?.order('created_at', { ascending: false })?.limit(1)?.single();

    if (!token) {
      return NextResponse?.json({ connected: false });
    }

    const isExpired = new Date(token.expires_at) < new Date();

    return NextResponse?.json({
      connected: true,
      expired: isExpired,
      clio_user_name: token?.clio_user_name,
      clio_user_id: token?.clio_user_id,
      clio_account_id: token?.clio_account_id,
      token_created_at: token?.created_at,
    });
  } catch (err) {
    return NextResponse?.json({ connected: false, error: 'Failed to check status' });
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();
    await supabase?.from('clio_tokens')?.delete()?.neq('id', '00000000-0000-0000-0000-000000000000');
    return NextResponse?.json({ disconnected: true });
  } catch (err) {
    return NextResponse?.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
