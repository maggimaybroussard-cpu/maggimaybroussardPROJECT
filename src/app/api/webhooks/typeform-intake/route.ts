import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Typeform webhook payload types
interface TypeformAnswer {
  field: { id: string; ref: string; type: string };
  type: string;
  text?: string;
  email?: string;
  phone_number?: string;
  choice?: { label: string };
  choices?: { labels: string[] };
}

interface TypeformResponse {
  form_id: string;
  token: string;
  submitted_at: string;
  answers: TypeformAnswer[];
}

interface TypeformWebhookPayload {
  event_id: string;
  event_type: string;
  form_response: TypeformResponse;
}

function getAnswer(answers: TypeformAnswer[], ref: string): string {
  const answer = answers.find((a) => a.field.ref === ref);
  if (!answer) return '';
  if (answer.type === 'text') return answer.text ?? '';
  if (answer.type === 'email') return answer.email ?? '';
  if (answer.type === 'phone_number') return answer.phone_number ?? '';
  if (answer.type === 'choice') return answer.choice?.label ?? '';
  if (answer.type === 'choices') return answer.choices?.labels?.join(', ') ?? '';
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const payload: TypeformWebhookPayload = await req.json();

    if (payload.event_type !== 'form_response') {
      return NextResponse.json({ ok: true });
    }

    const { answers, submitted_at } = payload.form_response;

    const name = getAnswer(answers, 'full_name');
    const email = getAnswer(answers, 'email_address');
    const phone = getAnswer(answers, 'phone_number');
    const firmName = getAnswer(answers, 'firm_or_company');
    const service = getAnswer(answers, 'service_type');
    const message = getAnswer(answers, 'matter_description');
    const opposingParty = getAnswer(answers, 'opposing_party');
    const jurisdiction = getAnswer(answers, 'jurisdiction');
    const caseStage = getAnswer(answers, 'case_stage');
    const urgency = getAnswer(answers, 'urgency');
    const budget = getAnswer(answers, 'budget_range');
    const preferredContact = getAnswer(answers, 'preferred_contact');
    const hearAboutUs = getAnswer(answers, 'hear_about_us');
    const additionalNotes = getAnswer(answers, 'additional_notes');

    if (!name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build enriched notes for admin
    const noteParts: string[] = ['[Typeform Intake]'];
    if (opposingParty) noteParts.push(`Opposing Party: ${opposingParty}`);
    if (jurisdiction) noteParts.push(`Jurisdiction: ${jurisdiction}`);
    if (caseStage) noteParts.push(`Case Stage: ${caseStage}`);
    if (urgency) noteParts.push(`Urgency: ${urgency}`);
    if (budget) noteParts.push(`Budget: ${budget}`);
    if (preferredContact) noteParts.push(`Preferred Contact: ${preferredContact}`);
    if (hearAboutUs) noteParts.push(`Heard About Us: ${hearAboutUs}`);
    if (additionalNotes) noteParts.push(`Additional Notes: ${additionalNotes}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Insert into contact_inquiries as a new lead
    const { data: inquiry, error: inquiryError } = await supabase
      .from('contact_inquiries')
      .insert({
        name,
        email,
        firm: firmName || null,
        firm_name: firmName || null,
        service,
        message,
        status: 'new',
        source: 'typeform_intake',
        booking_stage: 'inquiry',
        notes: noteParts.join('\n'),
      })
      .select('id')
      .single();

    if (inquiryError) {
      console.error('Supabase insert error:', inquiryError);
      return NextResponse.json({ error: inquiryError.message }, { status: 500 });
    }

    // Also insert into intake_submissions for full detail record
    const { data: intakeRecord } = await supabase
      .from('intake_submissions')
      .insert({
        name,
        email,
        phone: phone || null,
        firm_name: firmName || null,
        case_type: service,
        case_description: message,
        opposing_party: opposingParty || null,
        urgency: urgency?.toLowerCase().includes('urgent')
          ? 'urgent' : urgency?.toLowerCase().includes('priority')
          ? 'priority' : 'standard',
        additional_notes: additionalNotes || null,
        inquiry_id: inquiry.id,
        submitted_at,
      })
      .select('id')
      .single();

    const intakeId: string | null = intakeRecord?.id ?? null;

    // ── Auto-create / update client_profiles from intake data ───────────────
    try {
      const notesForProfile = [
        `[Intake ${submitted_at?.slice(0, 10) ?? 'submitted'}]`,
        service ? `Service: ${service}` : null,
        message ? `Matter: ${message.slice(0, 200)}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      await supabase.rpc('upsert_client_profile_from_intake', {
        p_name: name,
        p_email: email,
        p_phone: phone || null,
        p_firm: firmName || null,
        p_notes: notesForProfile || null,
      });
    } catch (profileErr) {
      // Non-blocking — intake still succeeds even if profile creation fails
      console.error('client_profiles upsert error:', profileErr);
    }

    // ── Notify admin of new lead ─────────────────────────────────────────────
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
    fetch(`${appUrl}/api/notifications/new-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadName: name,
        leadEmail: email,
        service: service ?? 'Not specified',
        message: message ?? '',
        source: 'typeform_intake',
        inquiryId: inquiry.id,
        phone: phone ?? undefined,
        firmName: firmName ?? undefined,
      }),
    }).catch(() => { /* fire-and-forget */ });

    // ── Auto-route intake: assign attorney, send confirmation, pre-populate case ──
    if (intakeId) fetch(`${appUrl}/api/intake/process-routing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intakeSubmissionId: intakeId,
        inquiryId: inquiry.id,
        clientName: name,
        clientEmail: email,
        clientPhone: phone ?? undefined,
        firmName: firmName ?? undefined,
        practiceArea: service ?? 'General Inquiry',
        matterDescription: message ?? '',
        opposingParty: opposingParty ?? undefined,
        urgency: urgency?.toLowerCase().includes('urgent')
          ? 'urgent' : urgency?.toLowerCase().includes('priority')
          ? 'priority' :'standard',
        additionalNotes: additionalNotes ?? undefined,
        submittedAt: submitted_at,
      }),
    }).catch(() => { /* fire-and-forget */ });

    return NextResponse.json({ ok: true, inquiry_id: inquiry.id });
  } catch (err) {
    console.error('Typeform webhook error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
