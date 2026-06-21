import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export type CaseLifecycleEventType =
  | 'deliverable_approved' |'case_stage_changed' |'invoice_issued' |'deadline_approaching';

export interface CaseLifecycleEmailPayload {
  eventType: CaseLifecycleEventType;
  clientEmail: string;
  clientName: string;
  inquiryId?: string;
  details: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const body: CaseLifecycleEmailPayload = await req.json();
    const { eventType, clientEmail, clientName, inquiryId, details } = body;

    if (!eventType || !clientEmail || !clientName) {
      return NextResponse.json(
        { error: 'eventType, clientEmail, and clientName are required' },
        { status: 400 }
      );
    }

    const validEvents: CaseLifecycleEventType[] = [
      'deliverable_approved',
      'case_stage_changed',
      'invoice_issued',
      'deadline_approaching',
    ];
    if (!validEvents.includes(eventType)) {
      return NextResponse.json({ error: `Invalid eventType: ${eventType}` }, { status: 400 });
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
        { status: 503 }
      );
    }

    const edgeRes = await fetch(
      `${SUPABASE_URL}/functions/v1/send-case-lifecycle-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ eventType, clientEmail, clientName, inquiryId, details }),
      }
    );

    const data = await edgeRes.json().catch(() => ({}));

    if (!edgeRes.ok) {
      throw new Error(data?.error ?? `Edge function returned ${edgeRes.status}`);
    }

    return NextResponse.json({ success: true, emailId: data.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send lifecycle email' },
      { status: 500 }
    );
  }
}
