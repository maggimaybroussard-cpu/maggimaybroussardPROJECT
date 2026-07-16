import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();

    const {
      inquiryId,
      trigger,
      emailType,
      // optional overrides
      amount,
      paymentDate,
      invoiceId,
      prepLink,
      documents,
      customMessage,
      nextSteps,
    } = body as {
      inquiryId: string;
      trigger: 'confirmed' | 'completed' | 'no_show' | 'manual';
      emailType?: string;
      amount?: string;
      paymentDate?: string;
      invoiceId?: string;
      prepLink?: string;
      documents?: Array<{ name: string; url: string; description?: string }>;
      customMessage?: string;
      nextSteps?: string[];
    };

    if (!inquiryId || !trigger) {
      return NextResponse.json({ error: 'Missing required fields: inquiryId, trigger' }, { status: 400 });
    }

    if (trigger === 'manual' && !emailType) {
      return NextResponse.json({ error: 'emailType is required for manual trigger' }, { status: 400 });
    }

    // Fetch the consultation record
    const { data: consultation, error: fetchError } = await supabase
      .from('contact_inquiries')
      .select('id, name, email, service, calendly_start_time, calendly_end_time, calendly_meeting_location, calendly_event_name, status')
      .eq('id', inquiryId)
      .single();

    if (fetchError || !consultation) {
      return NextResponse.json({ error: 'Consultation not found' }, { status: 404 });
    }

    if (!consultation.email) {
      return NextResponse.json({ error: 'Consultation has no client email' }, { status: 400 });
    }

    // Format booking date/time for emails
    let bookingDate: string | undefined;
    let bookingTime: string | undefined;

    if (consultation.calendly_start_time) {
      try {
        const dt = new Date(consultation.calendly_start_time);
        bookingDate = dt.toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          timeZone: 'America/Chicago',
        });
        bookingTime = dt.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
          timeZone: 'America/Chicago',
        });
      } catch {
        // leave undefined
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase service role key not configured' }, { status: 500 });
    }

    const payload: Record<string, unknown> = {
      trigger,
      inquiryId,
      clientEmail: consultation.email,
      clientName: consultation.name ?? 'Client',
      service: consultation.service ?? 'Legal Services',
      bookingDate,
      bookingTime,
      meetingLocation: consultation.calendly_meeting_location ?? undefined,
    };

    if (trigger === 'manual') payload.emailType = emailType;
    if (amount) payload.amount = amount;
    if (paymentDate) payload.paymentDate = paymentDate;
    if (invoiceId) payload.invoiceId = invoiceId;
    if (prepLink) payload.prepLink = prepLink;
    if (documents) payload.documents = documents;
    if (customMessage) payload.customMessage = customMessage;
    if (nextSteps) payload.nextSteps = nextSteps;

    const fnRes = await fetch(
      `${supabaseUrl}/functions/v1/schedule-onboarding-sequence`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const fnData = await fnRes.json();

    if (!fnRes.ok) {
      return NextResponse.json({ error: fnData.error ?? 'Edge function error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, trigger, results: fnData.results ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send onboarding email' },
      { status: 500 }
    );
  }
}

// GET — fetch onboarding email logs for a consultation
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(req.url);
    const inquiryId = searchParams.get('inquiryId');

    if (!inquiryId) {
      return NextResponse.json({ error: 'inquiryId is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('consultation_onboarding_email_logs')
      .select('*')
      .eq('inquiry_id', inquiryId)
      .order('sent_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ logs: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
