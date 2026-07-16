import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseAdmin();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('email_sequences')
      .select(`
        id,
        inquiry_id,
        sequence_type,
        step_number,
        scheduled_at,
        sent_at,
        send_status,
        resend_email_id,
        error_message,
        created_at,
        contact_inquiries (
          name,
          email,
          firm,
          service,
          booking_stage
        )
      `)
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (status) {
      query = query.eq('send_status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ sequences: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch sequences';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, sequenceId, inquiryId, bookingStage, clientEmail, clientName, service } = await req.json();
    const supabase = supabaseAdmin();

    if (action === 'cancel') {
      const { error } = await supabase
        .from('email_sequences')
        .update({ send_status: 'skipped' })
        .eq('id', sequenceId)
        .eq('send_status', 'pending');
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'cancel_all') {
      const { error } = await supabase
        .from('email_sequences')
        .update({ send_status: 'skipped' })
        .eq('inquiry_id', inquiryId)
        .eq('send_status', 'pending');
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'send_now') {
      // Fetch the sequence + inquiry details
      const { data: seq, error: seqErr } = await supabase
        .from('email_sequences')
        .select(`
          id, sequence_type, step_number, inquiry_id,
          contact_inquiries ( name, email, service )
        `)
        .eq('id', sequenceId)
        .single();

      if (seqErr || !seq) throw new Error('Sequence not found');

      const inquiry = (seq as any).contact_inquiries;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/send-nurture-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          sequenceId: seq.id,
          inquiryId: (seq as any).inquiry_id,
          sequenceType: seq.sequence_type,
          stepNumber: seq.step_number,
          recipientEmail: inquiry?.email,
          recipientName: inquiry?.name,
          service: inquiry?.service,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send email');

      return NextResponse.json({ success: true, emailId: result.id });
    }

    // Update booking stage and notify client — triggers post-service follow-up DB trigger when stage = 'completed'
    if (action === 'update_booking_stage') {
      if (!inquiryId || !bookingStage) {
        return NextResponse.json({ error: 'inquiryId and bookingStage are required' }, { status: 400 });
      }

      // Update booking_stage in contact_inquiries
      // When set to 'completed', the DB trigger auto-schedules post_service_followup sequences
      const { error: updateError } = await supabase
        .from('contact_inquiries')
        .update({ booking_stage: bookingStage })
        .eq('id', inquiryId);

      if (updateError) throw updateError;

      // Send a booking stage change notification email to the client
      if (clientEmail && clientName) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        try {
          await fetch(`${supabaseUrl}/functions/v1/notify-client`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              clientEmail,
              clientName,
              eventType: 'booking_stage_change',
              inquiryId,
              details: {
                newStage: bookingStage,
                service: service || '',
              },
            }),
          });
        } catch {
          // Non-blocking — stage update succeeded even if email fails
        }
      }

      return NextResponse.json({ success: true, bookingStage });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Action failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
