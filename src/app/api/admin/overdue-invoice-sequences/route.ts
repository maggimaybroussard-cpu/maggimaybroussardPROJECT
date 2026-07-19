import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ─── GET: Fetch all active overdue sequences ──────────────────────────────────
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: sequences, error } = await supabase
      .from('overdue_invoice_sequences')
      .select(`
        *,
        client_invoices (
          id, invoice_number, due_date, amount, amount_paid, status, payment_token,
          contact_inquiries ( name, email, phone, service )
        )
      `)
      .eq('resolved', false)
      .order('days_overdue', { ascending: false });

    if (error) throw error;

    // Compute summary stats
    const stats = {
      total: sequences?.length ?? 0,
      stage_7d: sequences?.filter((s) => s.tier === 1 && !s.email_sent_7d).length ?? 0,
      stage_14d: sequences?.filter((s) => s.tier === 2 && !s.email_sent_14d).length ?? 0,
      stage_30d: sequences?.filter((s) => s.tier === 3 && !s.email_sent_30d).length ?? 0,
      final_notice: sequences?.filter((s) => s.final_notice_sent && !s.portal_suspended).length ?? 0,
      suspended: sequences?.filter((s) => s.portal_suspended).length ?? 0,
      total_amount_overdue: sequences?.reduce((sum, s) => sum + Number(s.amount_due ?? 0), 0) ?? 0,
    };

    return NextResponse.json({ sequences: sequences ?? [], stats });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch sequences' }, { status: 500 });
  }
}

// ─── POST: Trigger processing or manage sequences ────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { action } = body;

    // ── Trigger the edge function ──────────────────────────────────────────
    if (action === 'run_sequences') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const res = await fetch(`${supabaseUrl}/functions/v1/process-overdue-invoice-sequences`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          send_emails: body.send_emails !== false,
          send_sms: body.send_sms !== false,
          dry_run: body.dry_run === true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Edge function failed');
      return NextResponse.json(data);
    }

    // ── Resolve a sequence (invoice paid) ─────────────────────────────────
    if (action === 'resolve') {
      const { sequenceId } = body;
      const { error } = await supabase
        .from('overdue_invoice_sequences')
        .update({ resolved: true, resolved_at: new Date().toISOString(), sequence_stage: 'resolved' })
        .eq('id', sequenceId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ── Unsuspend portal access ────────────────────────────────────────────
    if (action === 'unsuspend_portal') {
      const { sequenceId, inquiryId } = body;

      if (inquiryId) {
        await supabase
          .from('client_portal_access')
          .update({ is_active: true, suspended_reason: null, suspended_at: null })
          .eq('inquiry_id', inquiryId);
      }

      await supabase
        .from('overdue_invoice_sequences')
        .update({ portal_suspended: false, portal_suspended_at: null, sequence_stage: 'active' })
        .eq('id', sequenceId);

      return NextResponse.json({ success: true });
    }

    // ── Add notes ─────────────────────────────────────────────────────────
    if (action === 'add_note') {
      const { sequenceId, notes } = body;
      const { error } = await supabase
        .from('overdue_invoice_sequences')
        .update({ notes })
        .eq('id', sequenceId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Request failed' }, { status: 500 });
  }
}
