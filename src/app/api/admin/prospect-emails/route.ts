import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_BASE = 'https://api.resend.com';

interface ResendEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  created_at: string;
  last_event: string;
}

interface ResendEmailDetail extends ResendEmail {
  html?: string;
  text?: string;
  tags?: { name: string; value: string }[];
}

interface SequenceRow {
  id: string;
  inquiry_id: string;
  sequence_type: string;
  step_number: number;
  scheduled_at: string;
  sent_at: string | null;
  send_status: string;
  resend_email_id: string | null;
  error_message: string | null;
  contact_inquiries: {
    name: string;
    email: string;
    firm: string;
    service: string;
  } | null;
}

export interface ProspectEmail {
  sequenceId: string;
  resendEmailId: string | null;
  inquiryId: string;
  prospectName: string;
  prospectEmail: string;
  firm: string;
  service: string;
  sequenceType: string;
  stepNumber: number;
  stepLabel: string;
  scheduledAt: string;
  sentAt: string | null;
  sendStatus: 'pending' | 'sent' | 'failed' | 'skipped';
  // Resend-enriched fields
  subject: string | null;
  lastEvent: string | null;
  createdAt: string | null;
  // Derived display status
  displayStatus: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed' | 'skipped';
}

function mapLastEventToDisplay(
  sendStatus: string,
  lastEvent: string | null
): ProspectEmail['displayStatus'] {
  if (sendStatus === 'skipped') return 'skipped';
  if (sendStatus === 'failed') return 'failed';
  if (sendStatus === 'pending') return 'queued';
  // sendStatus === 'sent' — use Resend last_event for finer status
  if (!lastEvent) return 'sent';
  switch (lastEvent) {
    case 'clicked': return 'clicked';
    case 'opened': return 'opened';
    case 'delivered': return 'delivered';
    case 'bounced': return 'bounced';
    case 'complained': return 'complained';
    default: return 'sent';
  }
}

function stepLabel(sequenceType: string, stepNumber: number): string {
  if (sequenceType === 'prospect_followup') {
    return stepNumber === 1 ? 'Day 1 — Case Summary' : 'Day 3 — Reminder';
  }
  return `Step ${stepNumber}`;
}

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);

    // 1. Fetch prospect_followup sequences from Supabase
    const supabase = supabaseAdmin();
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
        contact_inquiries (
          name,
          email,
          firm,
          service
        )
      `)
      .eq('sequence_type', 'prospect_followup')
      .order('scheduled_at', { ascending: false })
      .limit(limit);

    if (statusFilter !== 'all') {
      query = query.eq('send_status', statusFilter);
    }

    const { data: sequences, error: dbError } = await query;
    if (dbError) throw dbError;

    const rows = (sequences || []) as SequenceRow[];

    // 2. For sent sequences with resend_email_id, fetch Resend details in parallel
    const resendIds = rows
      .filter((r) => r.resend_email_id && r.send_status === 'sent')
      .map((r) => r.resend_email_id as string);

    const resendDetailMap = new Map<string, ResendEmailDetail>();

    if (RESEND_API_KEY && resendIds.length > 0) {
      // Batch fetch — Resend doesn't have a bulk endpoint, so we fetch in parallel (capped at 20)
      const toFetch = resendIds.slice(0, 20);
      const results = await Promise.allSettled(
        toFetch.map((id) =>
          fetch(`${RESEND_BASE}/emails/${id}`, {
            headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
            next: { revalidate: 60 },
          }).then((r) => (r.ok ? r.json() : null))
        )
      );
      toFetch.forEach((id, i) => {
        const result = results[i];
        if (result.status === 'fulfilled' && result.value) {
          resendDetailMap.set(id, result.value as ResendEmailDetail);
        }
      });
    }

    // 3. Also fetch the Resend emails list to catch any sent emails not yet in Supabase
    let resendListEmails: ResendEmail[] = [];
    if (RESEND_API_KEY) {
      try {
        const listRes = await fetch(`${RESEND_BASE}/emails?limit=100`, {
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
          next: { revalidate: 60 },
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          resendListEmails = (listData.data || []) as ResendEmail[];
        }
      } catch {
        // Non-blocking — continue with Supabase data only
      }
    }

    // 4. Build enriched prospect email objects
    const prospectEmails: ProspectEmail[] = rows.map((row) => {
      const inquiry = row.contact_inquiries;
      const resendDetail = row.resend_email_id
        ? resendDetailMap.get(row.resend_email_id)
        : undefined;

      const lastEvent = resendDetail?.last_event ?? null;
      const displayStatus = mapLastEventToDisplay(row.send_status, lastEvent);

      return {
        sequenceId: row.id,
        resendEmailId: row.resend_email_id,
        inquiryId: row.inquiry_id,
        prospectName: inquiry?.name ?? 'Unknown',
        prospectEmail: inquiry?.email ?? '',
        firm: inquiry?.firm ?? '',
        service: inquiry?.service ?? '',
        sequenceType: row.sequence_type,
        stepNumber: row.step_number,
        stepLabel: stepLabel(row.sequence_type, row.step_number),
        scheduledAt: row.scheduled_at,
        sentAt: row.sent_at,
        sendStatus: row.send_status as ProspectEmail['sendStatus'],
        subject: resendDetail?.subject ?? null,
        lastEvent,
        createdAt: resendDetail?.created_at ?? null,
        displayStatus,
      };
    });

    // 5. Summary stats
    const stats = {
      total: prospectEmails.length,
      queued: prospectEmails.filter((e) => e.displayStatus === 'queued').length,
      sent: prospectEmails.filter((e) =>
        ['sent', 'delivered', 'opened', 'clicked'].includes(e.displayStatus)
      ).length,
      opened: prospectEmails.filter((e) =>
        ['opened', 'clicked'].includes(e.displayStatus)
      ).length,
      clicked: prospectEmails.filter((e) => e.displayStatus === 'clicked').length,
      bounced: prospectEmails.filter((e) => e.displayStatus === 'bounced').length,
      failed: prospectEmails.filter((e) => e.displayStatus === 'failed').length,
      skipped: prospectEmails.filter((e) => e.displayStatus === 'skipped').length,
      resendConnected: !!RESEND_API_KEY && RESEND_API_KEY !== 'your-resend-api-key-here',
    };

    return NextResponse.json({ emails: prospectEmails, stats, resendListCount: resendListEmails.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch prospect emails';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
