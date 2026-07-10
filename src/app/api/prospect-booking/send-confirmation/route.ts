import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendAppointmentConfirmationSMS } from '@/lib/twilio/smsClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, service, date, time, caseSummary, firm, budget, phone, smsConsent } = body;

    if (!name || !email || !service || !date || !time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json({ error: 'Supabase URL not configured' }, { status: 500 });
    }

    const supabase = await createClient();
    const { error: fnError } = await supabase.functions.invoke('send-prospect-booking-confirmation', {
      body: { name, email, service, date, time, caseSummary, firm, budget },
    });

    if (fnError) {
      console.error('Edge function error:', fnError);
      return NextResponse.json({ error: 'Failed to send confirmation email' }, { status: 500 });
    }

    // Send SMS confirmation if phone provided and consent given
    if (phone && smsConsent) {
      sendAppointmentConfirmationSMS({
        to: phone,
        clientName: name,
        appointmentType: 'Strategy Session (45 min)',
        appointmentDate: date,
        appointmentTime: time,
        timezone: 'America/Chicago',
      }).catch(() => { /* fire-and-forget */ });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Prospect booking confirmation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
