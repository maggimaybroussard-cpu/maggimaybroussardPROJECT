import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ─── GET — fetch recent email send log ────────────────────────────────────────
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase?.from('email_send_log')?.select('id, template_id, to_email, to_name, subject, resend_email_id, cc_internal, sent_at')?.order('sent_at', { ascending: false })?.limit(100);

    if (error) throw error;
    return NextResponse?.json({ logs: data ?? [] });
  } catch (err) {
    console.error('[email send-log GET]', err);
    return NextResponse?.json({ logs: [] });
  }
}
