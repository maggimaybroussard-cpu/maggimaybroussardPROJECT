import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

const brand = {
  bg: '#FAF7F2',
  bgCard: '#FFFFFF',
  primary: '#4A3728',
  accent: '#C8965A',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  white: '#FFFFFF',
  green: '#355E3B',
  greenLight: '#EAF2EB',
  amber: '#B45309',
  amberLight: '#FFFBEB',
  blue: '#1D4ED8',
  blueLight: '#EFF6FF',
};

const OUTCOME_LABELS: Record<string, string> = {
  won: 'Won',
  settled: 'Settled',
  favorable_judgment: 'Favorable Judgment',
  dismissed: 'Dismissed',
  lost: 'Lost',
  withdrawn: 'Withdrawn',
  pending_close: 'Pending Close',
};

const OUTCOME_COLORS: Record<string, { badge: string; text: string; light: string }> = {
  won:                { badge: brand.green,   text: brand.white, light: brand.greenLight },
  settled:            { badge: brand.green,   text: brand.white, light: brand.greenLight },
  favorable_judgment: { badge: brand.green,   text: brand.white, light: brand.greenLight },
  dismissed:          { badge: brand.blue,    text: brand.white, light: brand.blueLight },
  lost:               { badge: '#B91C1C',     text: brand.white, light: '#FEF2F2' },
  withdrawn:          { badge: brand.amber,   text: brand.white, light: brand.amberLight },
  pending_close:      { badge: brand.muted,   text: brand.white, light: brand.secondary },
};

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

function emailWrapper(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maggi May Broussard Legal Services</title>
  ${preheader ? `<div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
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
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="border-right:2px solid ${brand.accent};padding-right:14px;vertical-align:middle;">
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Paralegal</p>
                        <p style="margin:0;font-size:10px;color:${brand.accent};letter-spacing:0.18em;text-transform:uppercase;font-family:Georgia,serif;line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left:14px;vertical-align:middle;">
                        <h1 style="margin:0;font-size:24px;color:${brand.white};font-family:Georgia,'Times New Roman',serif;font-weight:normal;letter-spacing:0.01em;line-height:1.2;">Maggi May Broussard</h1>
                        <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 32px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
              You are receiving this because you have an active matter with Broussard Legal Services.
              &nbsp;·&nbsp;
              <a href="${SITE_URL}/portal/login" style="color:${brand.accent};text-decoration:none;">Access your portal</a>
              &nbsp;·&nbsp;
              <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};text-decoration:none;">Contact us</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function sig(): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p>
          <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
          <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
          <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
          &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
          <a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">broussardlegalservices.com</a>
        </td>
      </tr>
    </table>`;
}

function detailRow(label: string, value: string, last = false): string {
  const border = last ? '' : `border-bottom:1px solid rgba(217,208,197,0.5);`;
  return `
    <tr>
      <td style="padding:9px 0;color:${brand.muted};font-size:13px;width:40%;${border};font-family:Georgia,serif;">${label}</td>
      <td style="padding:9px 0;color:${brand.foreground};font-size:14px;font-weight:bold;${border};font-family:Georgia,serif;">${value}</td>
    </tr>`;
}

function buildClientCloseEmail(d: {
  clientName: string;
  caseType: string;
  outcome: string;
  closeDate: string;
  settlementAmount: number | null;
  notes: string | null;
  nextStepsUrl: string;
}): { subject: string; html: string } {
  const firstName = d.clientName.split(' ')[0] || d.clientName;
  const outcomeLabel = OUTCOME_LABELS[d.outcome] ?? d.outcome;
  const colors = OUTCOME_COLORS[d.outcome] ?? { badge: brand.accent, text: brand.white, light: brand.secondary };

  const subject = `Your Matter Has Closed — ${outcomeLabel}`;

  const isPositive = ['won', 'settled', 'favorable_judgment', 'dismissed'].includes(d.outcome);
  const headline = isPositive
    ? `Congratulations, ${firstName} — your matter has closed`
    : `Your matter has been closed, ${firstName}`;

  const intro = isPositive
    ? `We are pleased to inform you that your legal matter has been officially closed with a <strong>${outcomeLabel}</strong> outcome. It has been a privilege to assist you through this process.`
    : `We are writing to inform you that your legal matter has been officially closed. The outcome has been recorded as <strong>${outcomeLabel}</strong>.`;

  const settlementRow = d.settlementAmount
    ? detailRow('Settlement Amount', `<span style="color:${brand.green};font-weight:bold;">${fmt(d.settlementAmount)}</span>`)
    : '';

  const notesRow = d.notes ? detailRow('Notes', d.notes, !d.settlementAmount) : '';

  const content = `
    <span style="display:inline-block;background-color:${colors.badge};color:${colors.text};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#9670; Matter Closed</span>

    <h2 style="margin:0 0 16px;font-size:22px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">
      ${headline}
    </h2>

    <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
      ${intro}
    </p>

    <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
      <div style="background-color:${brand.primary};padding:12px 22px;">
        <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128203; Matter Summary</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%;border-collapse:collapse;">
          ${detailRow('Case Type', d.caseType)}
          ${detailRow('Outcome', `<span style="display:inline-block;background-color:${colors.badge};color:${colors.text};font-size:11px;font-weight:bold;padding:3px 12px;border-radius:10px;">${outcomeLabel}</span>`)}
          ${detailRow('Close Date', new Date(d.closeDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}
          ${settlementRow}
          ${notesRow}
        </table>
      </div>
    </div>

    <div style="background-color:${colors.light};border-left:3px solid ${colors.badge};padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:${brand.foreground};line-height:1.7;font-family:Georgia,serif;">
        Please review your next steps and any outstanding items in your client portal. If you have any questions about your matter or the outcome, do not hesitate to reach out.
      </p>
    </div>

    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;">
      <tr>
        <td style="background-color:${brand.accent};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.25);">
          <a href="${d.nextStepsUrl}" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">View Next Steps &rarr;</a>
        </td>
      </tr>
    </table>

    ${sig()}`;

  return { subject, html: emailWrapper(content, `Your matter has closed with outcome: ${outcomeLabel}.`) };
}

function buildStaffCloseEmail(d: {
  clientName: string;
  clientEmail: string;
  caseType: string;
  outcome: string;
  closeDate: string;
  settlementAmount: number | null;
  notes: string | null;
  inquiryId: string;
  nextStepsUrl: string;
}): { subject: string; html: string } {
  const outcomeLabel = OUTCOME_LABELS[d.outcome] ?? d.outcome;
  const colors = OUTCOME_COLORS[d.outcome] ?? { badge: brand.accent, text: brand.white, light: brand.secondary };

  const subject = `[Staff] Matter Closed — ${d.clientName} · ${outcomeLabel}`;

  const settlementRow = d.settlementAmount
    ? detailRow('Settlement Amount', `<span style="color:${brand.green};font-weight:bold;">${fmt(d.settlementAmount)}</span>`)
    : '';

  const notesRow = d.notes ? detailRow('Notes', d.notes, true) : '';

  const content = `
    <span style="display:inline-block;background-color:${colors.badge};color:${colors.text};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#9670; Matter Closed — Staff Notification</span>

    <h2 style="margin:0 0 16px;font-size:22px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">
      Matter closed: ${d.clientName}
    </h2>

    <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
      A matter has been officially closed and recorded in the system. The client notification has been sent. Please review the details below and complete any outstanding administrative tasks.
    </p>

    <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
      <div style="background-color:${brand.primary};padding:12px 22px;">
        <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128203; Closed Matter Details</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%;border-collapse:collapse;">
          ${detailRow('Client', d.clientName)}
          ${detailRow('Client Email', `<a href="mailto:${d.clientEmail}" style="color:${brand.accent};text-decoration:none;">${d.clientEmail}</a>`)}
          ${detailRow('Case Type', d.caseType)}
          ${detailRow('Outcome', `<span style="display:inline-block;background-color:${colors.badge};color:${colors.text};font-size:11px;font-weight:bold;padding:3px 12px;border-radius:10px;">${outcomeLabel}</span>`)}
          ${detailRow('Close Date', new Date(d.closeDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}
          ${detailRow('Matter ID', `#${d.inquiryId.slice(0, 8).toUpperCase()}`)}
          ${settlementRow}
          ${notesRow}
        </table>
      </div>
    </div>

    <div style="background-color:${brand.secondary};border:1px solid ${brand.border};border-radius:8px;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:${brand.primary};font-family:Georgia,serif;">&#9745; Post-Close Checklist</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:${brand.foreground};line-height:2;font-family:Georgia,serif;">
        <li>Confirm all invoices are settled and closed</li>
        <li>Archive case documents in the client portal</li>
        <li>Update case status to Closed in the admin panel</li>
        <li>Request a client review if outcome was favorable</li>
        <li>Tag expertise areas for marketing if applicable</li>
      </ul>
    </div>

    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;">
      <tr>
        <td style="background-color:${brand.primary};border-radius:7px;">
          <a href="${d.nextStepsUrl}" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">View Matter in Admin &rarr;</a>
        </td>
      </tr>
    </table>

    ${sig()}`;

  return { subject, html: emailWrapper(content, `Matter closed for ${d.clientName} — ${outcomeLabel}.`) };
}

async function sendEmail(to: string, subject: string, html: string, fromName = 'Maggi May Broussard'): Promise<{ id: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${fromName} <maggimay@broussardlegalservices.com>`,
      reply_to: 'maggimaybroussard@gmail.com',
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { message?: string }).message || `Resend error: ${res.status}`);
  }

  return res.json() as Promise<{ id: string }>;
}

export interface MatterCloseEmailPayload {
  inquiryId: string;
  clientName: string;
  clientEmail: string;
  caseType: string;
  outcome: string;
  closeDate: string;
  settlementAmount: number | null;
  notes: string | null;
  // Staff recipients (defaults to firm email if not provided)
  staffEmails?: string[];
  // Override next-steps URL (defaults to portal case-status)
  nextStepsUrl?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: MatterCloseEmailPayload = await req.json();

    const {
      inquiryId,
      clientName,
      clientEmail,
      caseType,
      outcome,
      closeDate,
      settlementAmount,
      notes,
      staffEmails,
      nextStepsUrl,
    } = body;

    if (!inquiryId || !clientName || !clientEmail || !caseType || !outcome || !closeDate) {
      return NextResponse.json(
        { error: 'Missing required fields: inquiryId, clientName, clientEmail, caseType, outcome, closeDate' },
        { status: 400 }
      );
    }

    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json(
        { error: 'RESEND_API_KEY is not configured.' },
        { status: 503 }
      );
    }

    const clientNextSteps = nextStepsUrl ?? `${SITE_URL}/portal/case-status`;
    const staffNextSteps = `${SITE_URL}/admin`;

    const results: { recipient: string; emailId: string; type: 'client' | 'staff' }[] = [];
    const errors: { recipient: string; error: string }[] = [];

    // ── Send to client ──────────────────────────────────────────────────────
    try {
      const { subject, html } = buildClientCloseEmail({
        clientName,
        caseType,
        outcome,
        closeDate,
        settlementAmount,
        notes,
        nextStepsUrl: clientNextSteps,
      });
      const { id } = await sendEmail(clientEmail, subject, html);
      results.push({ recipient: clientEmail, emailId: id, type: 'client' });
    } catch (err) {
      errors.push({ recipient: clientEmail, error: err instanceof Error ? err.message : 'Failed to send client email' });
    }

    // ── Send to staff ───────────────────────────────────────────────────────
    const staffList = staffEmails && staffEmails.length > 0
      ? staffEmails
      : ['maggimaybroussard@gmail.com'];

    for (const staffEmail of staffList) {
      try {
        const { subject, html } = buildStaffCloseEmail({
          clientName,
          clientEmail,
          caseType,
          outcome,
          closeDate,
          settlementAmount,
          notes,
          inquiryId,
          nextStepsUrl: staffNextSteps,
        });
        const { id } = await sendEmail(staffEmail, subject, html);
        results.push({ recipient: staffEmail, emailId: id, type: 'staff' });
      } catch (err) {
        errors.push({ recipient: staffEmail, error: err instanceof Error ? err.message : 'Failed to send staff email' });
      }
    }

    return NextResponse.json({
      success: true,
      sent: results.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('[matter-close/send-emails]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send matter-close emails' },
      { status: 500 }
    );
  }
}
