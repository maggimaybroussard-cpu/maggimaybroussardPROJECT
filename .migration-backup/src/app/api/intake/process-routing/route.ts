import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'broussardlegalservices@gmail.com';

const brand = {
  bg: '#FAF7F2',
  primary: '#4A3728',
  accent: '#C8965A',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  white: '#FFFFFF',
};

// ─── Email Templates ──────────────────────────────────────────────────────────

function buildClientConfirmationEmail(params: {
  clientName: string;
  practiceArea: string;
  attorneyName: string;
  caseRecordId: string;
  matterTitle: string;
  submittedAt: string;
}): string {
  const { clientName, practiceArea, attorneyName, caseRecordId, matterTitle, submittedAt } = params;
  const dateStr = new Date(submittedAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Intake Confirmation — Broussard Legal Services</title>
</head>
<body style="margin:0;padding:0;background-color:${brand.secondary};font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <!-- Header -->
        <tr>
          <td style="background-color:${brand.primary};padding:0;">
            <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="border-right:2px solid ${brand.accent};padding-right:14px;vertical-align:middle;">
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Paralegal</p>
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left:14px;vertical-align:middle;">
                        <h1 style="margin:0;font-size:22px;color:${brand.white};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:0.01em;line-height:1.2;">Maggi May Broussard</h1>
                        <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;letter-spacing:0.06em;">Intake Confirmation</p>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="text-align:right;vertical-align:middle;">
                  <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.12em;text-transform:uppercase;font-family:Georgia,serif;">Case Ref</p>
                  <p style="margin:4px 0 0;font-size:13px;color:${brand.white};font-family:Georgia,serif;font-weight:bold;">#${caseRecordId.slice(0, 8).toUpperCase()}</p>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 36px 0;">
            <span style="display:inline-block;background-color:#355E3B;color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:18px;font-family:Georgia,serif;">&#10003; Intake Received</span>
            <h2 style="margin:0 0 8px;font-size:22px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;">Thank you, ${clientName}</h2>
            <p style="margin:0 0 24px;font-size:15px;color:${brand.muted};font-family:Georgia,serif;line-height:1.7;">Your intake submission has been received and a case record has been created. A member of our team will be in touch shortly.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 32px;">
            <!-- Case details card -->
            <div style="background-color:${brand.white};border:1px solid ${brand.border};border-radius:12px;overflow:hidden;margin-bottom:24px;">
              <div style="background:linear-gradient(135deg,${brand.primary} 0%,#3A2A1E 100%);padding:14px 20px;">
                <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.14em;font-family:Georgia,serif;">Your Case Details</p>
              </div>
              <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
                <tr>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;width:40%;border-bottom:1px solid rgba(217,208,197,0.5);">Matter</td>
                  <td style="padding:10px 20px;color:${brand.foreground};font-size:13px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${matterTitle}</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;border-bottom:1px solid rgba(217,208,197,0.5);">Practice Area</td>
                  <td style="padding:10px 20px;color:${brand.foreground};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">${practiceArea}</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;border-bottom:1px solid rgba(217,208,197,0.5);">Assigned To</td>
                  <td style="padding:10px 20px;color:${brand.foreground};font-size:13px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${attorneyName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;border-bottom:1px solid rgba(217,208,197,0.5);">Submitted</td>
                  <td style="padding:10px 20px;color:${brand.foreground};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">${dateStr}</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;">Reference #</td>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;font-family:monospace;">${caseRecordId.slice(0, 8).toUpperCase()}</td>
                </tr>
              </table>
            </div>
            <!-- Next steps -->
            <div style="background-color:#EAF2EB;border:1px solid #C3DEC5;border-radius:10px;padding:18px 20px;margin-bottom:24px;">
              <p style="margin:0 0 10px;font-size:12px;font-weight:bold;color:#355E3B;text-transform:uppercase;letter-spacing:0.1em;font-family:Georgia,serif;">What Happens Next</p>
              <p style="margin:0 0 6px;font-size:13px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.7;">&#8226; <strong>${attorneyName}</strong> will review your submission within 1–2 business days.</p>
              <p style="margin:0 0 6px;font-size:13px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.7;">&#8226; You will receive a follow-up email or phone call to discuss next steps.</p>
              <p style="margin:0;font-size:13px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.7;">&#8226; Please keep your reference number handy for any future correspondence.</p>
            </div>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 8px;">
              <tr>
                <td style="background-color:${brand.accent};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.25);">
                  <a href="${SITE_URL}/intake-status" style="display:inline-block;padding:13px 28px;color:${brand.white};text-decoration:none;font-size:13px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Check Intake Status &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 4px;font-size:11px;color:${brand.muted};line-height:1.7;font-family:Georgia,serif;">Questions? Reply to this email or contact us at <a href="mailto:${ADMIN_EMAIL}" style="color:${brand.accent};text-decoration:none;">${ADMIN_EMAIL}</a></p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;font-family:Georgia,serif;">Broussard Legal Services &bull; ${SITE_URL}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildAttorneyRoutingEmail(params: {
  attorneyName: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  practiceArea: string;
  matterTitle: string;
  matterDescription: string;
  urgency: string;
  caseRecordId: string;
  submittedAt: string;
  firmName?: string;
  opposingParty?: string;
  additionalNotes?: string;
}): string {
  const {
    attorneyName, clientName, clientEmail, clientPhone, practiceArea,
    matterTitle, matterDescription, urgency, caseRecordId, submittedAt,
    firmName, opposingParty, additionalNotes,
  } = params;

  const dateStr = new Date(submittedAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  const urgencyColor = urgency === 'urgent' ? '#DC2626' : urgency === 'priority' ? '#D97706' : '#355E3B';
  const urgencyBg = urgency === 'urgent' ? '#FEF2F2' : urgency === 'priority' ? '#FFFBEB' : '#EAF2EB';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Intake Routed — ${clientName}</title>
</head>
<body style="margin:0;padding:0;background-color:${brand.secondary};font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <tr>
          <td style="background-color:${brand.primary};padding:0;">
            <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
              <tr>
                <td>
                  <h1 style="margin:0;font-size:20px;color:${brand.white};font-family:Georgia,serif;font-weight:normal;">New Intake Assigned to You</h1>
                  <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;">Broussard Legal Services &bull; Intake Routing</p>
                </td>
                <td style="text-align:right;vertical-align:middle;">
                  <span style="display:inline-block;background-color:${urgencyBg};color:${urgencyColor};font-size:10px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;padding:4px 12px;border-radius:20px;font-family:Georgia,serif;">${urgency.toUpperCase()}</span>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px 0;">
            <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.7;">Hi <strong>${attorneyName}</strong>, a new intake submission has been automatically routed to you based on practice area. Please review and follow up with the client.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 32px;">
            <div style="background-color:${brand.white};border:1px solid ${brand.border};border-radius:12px;overflow:hidden;margin-bottom:20px;">
              <div style="background:linear-gradient(135deg,${brand.primary} 0%,#3A2A1E 100%);padding:14px 20px;">
                <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.14em;font-family:Georgia,serif;">Client &amp; Matter Details</p>
              </div>
              <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
                <tr>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;width:38%;border-bottom:1px solid rgba(217,208,197,0.5);">Client Name</td>
                  <td style="padding:10px 20px;color:${brand.foreground};font-size:13px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${clientName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;border-bottom:1px solid rgba(217,208,197,0.5);">Email</td>
                  <td style="padding:10px 20px;border-bottom:1px solid rgba(217,208,197,0.5);"><a href="mailto:${clientEmail}" style="color:${brand.accent};font-size:13px;text-decoration:none;">${clientEmail}</a></td>
                </tr>
                ${clientPhone ? `<tr><td style="padding:10px 20px;color:${brand.muted};font-size:12px;border-bottom:1px solid rgba(217,208,197,0.5);">Phone</td><td style="padding:10px 20px;color:${brand.foreground};font-size:13px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${clientPhone}</td></tr>` : ''}
                ${firmName ? `<tr><td style="padding:10px 20px;color:${brand.muted};font-size:12px;border-bottom:1px solid rgba(217,208,197,0.5);">Firm / Company</td><td style="padding:10px 20px;color:${brand.foreground};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">${firmName}</td></tr>` : ''}
                <tr>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;border-bottom:1px solid rgba(217,208,197,0.5);">Practice Area</td>
                  <td style="padding:10px 20px;color:${brand.foreground};font-size:13px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${practiceArea}</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;border-bottom:1px solid rgba(217,208,197,0.5);">Matter Title</td>
                  <td style="padding:10px 20px;color:${brand.foreground};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">${matterTitle}</td>
                </tr>
                ${opposingParty ? `<tr><td style="padding:10px 20px;color:${brand.muted};font-size:12px;border-bottom:1px solid rgba(217,208,197,0.5);">Opposing Party</td><td style="padding:10px 20px;color:${brand.foreground};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">${opposingParty}</td></tr>` : ''}
                <tr>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;border-bottom:1px solid rgba(217,208,197,0.5);">Submitted</td>
                  <td style="padding:10px 20px;color:${brand.foreground};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">${dateStr}</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;border-bottom:1px solid rgba(217,208,197,0.5);">Case Ref #</td>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;font-family:monospace;border-bottom:1px solid rgba(217,208,197,0.5);">${caseRecordId.slice(0, 8).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding:10px 20px;color:${brand.muted};font-size:12px;vertical-align:top;">Description</td>
                  <td style="padding:10px 20px;color:${brand.foreground};font-size:13px;line-height:1.7;">${matterDescription.replace(/\n/g, '<br/>')}</td>
                </tr>
                ${additionalNotes ? `<tr><td style="padding:10px 20px;color:${brand.muted};font-size:12px;vertical-align:top;border-top:1px solid rgba(217,208,197,0.5);">Additional Notes</td><td style="padding:10px 20px;color:${brand.foreground};font-size:13px;line-height:1.7;border-top:1px solid rgba(217,208,197,0.5);">${additionalNotes.replace(/\n/g, '<br/>')}</td></tr>` : ''}
              </table>
            </div>
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background-color:${brand.accent};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.25);">
                  <a href="${SITE_URL}/admin" style="display:inline-block;padding:13px 28px;color:${brand.white};text-decoration:none;font-size:13px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Open in Admin Dashboard &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;font-family:Georgia,serif;">This intake was automatically routed to you by Broussard Legal Services intake system.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      intakeSubmissionId,
      inquiryId,
      clientName,
      clientEmail,
      clientPhone,
      firmName,
      practiceArea,
      matterDescription,
      opposingParty,
      urgency,
      additionalNotes,
      submittedAt,
    } = body as {
      intakeSubmissionId: string;
      inquiryId?: string;
      clientName: string;
      clientEmail: string;
      clientPhone?: string;
      firmName?: string;
      practiceArea: string;
      matterDescription: string;
      opposingParty?: string;
      urgency?: string;
      additionalNotes?: string;
      submittedAt?: string;
    };

    if (!intakeSubmissionId || !clientName || !clientEmail || !practiceArea) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── 1. Find matching routing rule ────────────────────────────────────────
    // Try exact match first, then fallback to 'General Inquiry'
    const normalizedArea = practiceArea?.trim() ?? '';

    const { data: routingRules } = await supabase
      .from('intake_routing_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    const exactMatch = routingRules?.find(
      (r) => r.practice_area.toLowerCase() === normalizedArea.toLowerCase()
    );
    const fallbackRule = routingRules?.find(
      (r) => r.practice_area.toLowerCase() === 'general inquiry'
    );
    const routingRule = exactMatch ?? fallbackRule ?? routingRules?.[0] ?? null;

    const assignedAttorneyName = routingRule?.attorney_name ?? 'Maggi May Broussard';
    const assignedAttorneyEmail = routingRule?.attorney_email ?? ADMIN_EMAIL;

    // ── 2. Build matter title ────────────────────────────────────────────────
    const matterTitle = `${normalizedArea || 'General'} — ${clientName}`;

    // ── 3. Pre-populate case record ──────────────────────────────────────────
    const { data: caseRecord, error: caseError } = await supabase
      .from('intake_case_records')
      .insert({
        intake_submission_id: intakeSubmissionId,
        inquiry_id: inquiryId ?? null,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone ?? null,
        firm_name: firmName ?? null,
        practice_area: normalizedArea,
        matter_title: matterTitle,
        matter_description: matterDescription ?? '',
        opposing_party: opposingParty ?? null,
        urgency: urgency ?? 'standard',
        assigned_attorney: assignedAttorneyName,
        assigned_attorney_email: assignedAttorneyEmail,
        status: 'new',
        source: 'intake_form',
        additional_notes: additionalNotes ?? null,
      })
      .select('id')
      .single();

    if (caseError) {
      console.error('[process-routing] case record insert error:', caseError);
      return NextResponse.json({ error: caseError.message }, { status: 500 });
    }

    const caseRecordId = caseRecord.id as string;
    const ts = submittedAt ?? new Date().toISOString();

    // ── 4. Update intake_submission with routing result ───────────────────────
    await supabase
      .from('intake_submissions')
      .update({
        assigned_attorney_name: assignedAttorneyName,
        assigned_attorney_email: assignedAttorneyEmail,
        routing_rule_id: routingRule?.id ?? null,
        case_record_id: caseRecordId,
        routing_status: 'routed',
      })
      .eq('id', intakeSubmissionId);

    // ── 5. Send emails (fire-and-forget if Resend not configured) ────────────
    const emailsEnabled = RESEND_API_KEY && RESEND_API_KEY !== 'your-resend-api-key-here';

    if (emailsEnabled) {
      const sendEmail = async (to: string, subject: string, html: string) => {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Broussard Legal Services <maggimay@broussardlegalservices.com>',
            to: [to],
            subject,
            html,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(err.message ?? `Resend error ${res.status}`);
        }
        return res.json() as Promise<{ id: string }>;
      };

      // Client confirmation email
      const clientHtml = buildClientConfirmationEmail({
        clientName,
        practiceArea: normalizedArea,
        attorneyName: assignedAttorneyName,
        caseRecordId,
        matterTitle,
        submittedAt: ts,
      });

      // Attorney routing notification email
      const attorneyHtml = buildAttorneyRoutingEmail({
        attorneyName: assignedAttorneyName,
        clientName,
        clientEmail,
        clientPhone,
        practiceArea: normalizedArea,
        matterTitle,
        matterDescription: matterDescription ?? '',
        urgency: urgency ?? 'standard',
        caseRecordId,
        submittedAt: ts,
        firmName,
        opposingParty,
        additionalNotes,
      });

      const [clientResult, attorneyResult] = await Promise.allSettled([
        sendEmail(
          clientEmail,
          `Your Intake Has Been Received — Ref #${caseRecordId.slice(0, 8).toUpperCase()}`,
          clientHtml
        ),
        sendEmail(
          assignedAttorneyEmail,
          `New Intake Routed to You: ${clientName} — ${normalizedArea}`,
          attorneyHtml
        ),
      ]);

      // Mark confirmation sent
      if (clientResult.status === 'fulfilled') {
        await supabase
          .from('intake_submissions')
          .update({ confirmation_sent_at: new Date().toISOString() })
          .eq('id', intakeSubmissionId);
      }

      const clientEmailId = clientResult.status === 'fulfilled' ? clientResult.value.id : null;
      const attorneyEmailId = attorneyResult.status === 'fulfilled' ? attorneyResult.value.id : null;

      return NextResponse.json({
        ok: true,
        caseRecordId,
        assignedAttorney: assignedAttorneyName,
        assignedAttorneyEmail,
        clientEmailId,
        attorneyEmailId,
      });
    }

    // Emails skipped — still return success with case record
    return NextResponse.json({
      ok: true,
      caseRecordId,
      assignedAttorney: assignedAttorneyName,
      assignedAttorneyEmail,
      emailsSkipped: true,
    });
  } catch (err) {
    console.error('[process-routing]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
