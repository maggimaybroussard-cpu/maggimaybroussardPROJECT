import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

const brand = {
  bg: '#FAF7F2',
  primary: '#4A3728',
  accent: '#C8965A',
  accentLight: '#F5EDE0',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  white: '#FFFFFF',
  green: '#355E3B',
  greenLight: '#EAF2EB',
};

// Milestone stage definitions
const MILESTONE_STAGES: Record<string, { label: string; description: string; nextStep: string; icon: string }> = {
  new: {
    label: 'Inquiry Received',
    description: 'Your inquiry has been received and is being reviewed by Maggi May.',
    nextStep: 'You will hear back within 1–2 business days to discuss your matter.',
    icon: '📋',
  },
  in_review: {
    label: 'Case Under Review',
    description: 'Maggi May is actively reviewing your case details and preparing a strategy.',
    nextStep: 'A consultation will be scheduled to discuss next steps.',
    icon: '🔍',
  },
  contacted: {
    label: 'Case Active — Work in Progress',
    description: 'Your case is now active. Maggi May is working on your matter.',
    nextStep: 'You can track progress, upload documents, and message directly through your portal.',
    icon: '⚖️',
  },
  active: {
    label: 'Case Active — Work in Progress',
    description: 'Your case is now active. Maggi May is working on your matter.',
    nextStep: 'You can track progress, upload documents, and message directly through your portal.',
    icon: '⚖️',
  },
  active_client: {
    label: 'Case Active — Work in Progress',
    description: 'Your case is now active. Maggi May is working on your matter.',
    nextStep: 'You can track progress, upload documents, and message directly through your portal.',
    icon: '⚖️',
  },
  billed: {
    label: 'Work Completed — Invoice Issued',
    description: 'The work on your matter has been completed and an invoice has been issued.',
    nextStep: 'Please review and pay your invoice through the billing section of your portal.',
    icon: '📄',
  },
  closed: {
    label: 'Engagement Closed',
    description: 'Your case engagement has been successfully closed.',
    nextStep: 'All documents remain accessible in your portal. Thank you for choosing Broussard Legal Services.',
    icon: '✅',
  },
};

function buildMilestoneEmail(params: {
  clientName: string;
  caseName: string;
  caseId: string;
  service: string;
  previousStage: string;
  newStage: string;
  customMessage?: string;
}): string {
  const { clientName, caseName, caseId, service, previousStage, newStage, customMessage } = params;
  const firstName = clientName.split(' ')[0];
  const milestone = MILESTONE_STAGES[newStage] ?? {
    label: newStage,
    description: 'Your case has been updated.',
    nextStep: 'Log in to your portal to see the latest details.',
    icon: '📌',
  };
  const prevMilestone = MILESTONE_STAGES[previousStage];

  // Build progress bar steps
  const stages = ['new', 'in_review', 'contacted', 'billed', 'closed'];
  const currentIdx = stages.indexOf(newStage === 'active' || newStage === 'active_client' ? 'contacted' : newStage);

  const progressSteps = [
    { label: 'Received', stage: 'new' },
    { label: 'In Review', stage: 'in_review' },
    { label: 'Active', stage: 'contacted' },
    { label: 'Billed', stage: 'billed' },
    { label: 'Closed', stage: 'closed' },
  ];

  const progressHtml = progressSteps.map((step, idx) => {
    const isDone = idx < currentIdx;
    const isActive = idx === currentIdx;
    const dotColor = isDone ? brand.green : isActive ? brand.accent : brand.border;
    const textColor = isDone || isActive ? brand.foreground : brand.muted;
    return `
      <td style="text-align:center; vertical-align:top; padding: 0 4px;">
        <div style="width:28px; height:28px; border-radius:50%; background-color:${dotColor}; margin:0 auto 6px; display:flex; align-items:center; justify-content:center;">
          ${isDone ? `<span style="color:white; font-size:12px;">✓</span>` : isActive ? `<span style="color:white; font-size:10px;">●</span>` : ''}
        </div>
        <p style="margin:0; font-size:10px; color:${textColor}; font-family:Georgia,serif; white-space:nowrap;">${step.label}</p>
      </td>
    `;
  }).join(`<td style="vertical-align:middle; padding-bottom:22px;"><div style="height:2px; width:100%; background-color:${brand.border};"></div></td>`);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Case Milestone Update — Broussard Legal Services</title>
</head>
<body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding: 40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border: 1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">

        <!-- Header -->
        <tr>
          <td style="background-color:${brand.primary}; padding:0;">
            <div style="height:4px; background: linear-gradient(to right, ${brand.accent}, #E8B87A, ${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 28px 36px 24px;">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="border-right: 2px solid ${brand.accent}; padding-right: 14px; vertical-align: middle;">
                        <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family: Georgia, serif; line-height:1.4;">Paralegal</p>
                        <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.18em; text-transform:uppercase; font-family: Georgia, serif; line-height:1.4;">Services</p>
                      </td>
                      <td style="padding-left: 14px; vertical-align: middle;">
                        <h1 style="margin:0; font-size:24px; color:${brand.white}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:0.01em; line-height:1.2;">Maggi May Broussard</h1>
                        <p style="margin:4px 0 0; font-size:12px; color:rgba(255,255,255,0.65); font-family: Georgia, serif; letter-spacing:0.06em;">Louisiana &amp; Nationwide</p>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="text-align:right; vertical-align:middle;">
                  <p style="margin:0; font-size:11px; color:${brand.accent}; letter-spacing:0.12em; text-transform:uppercase; font-family: Georgia, serif;">Case Milestone</p>
                  <p style="margin:4px 0 0; font-size:13px; color:${brand.white}; font-family: Georgia, serif; font-weight:bold;">#${caseId.slice(0, 8).toUpperCase()}</p>
                </td>
              </tr>
            </table>
            <div style="height:1px; background: linear-gradient(to right, ${brand.accent}, rgba(200,150,90,0.2), transparent); margin: 0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 36px 36px 32px;">

            <!-- Milestone badge -->
            <div style="display:inline-block; background-color:${brand.accentLight}; border:1px solid rgba(200,150,90,0.4); border-radius:10px; padding:12px 20px; margin-bottom:24px;">
              <p style="margin:0; font-size:11px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.12em; font-family:Georgia,serif;">Case Milestone Reached</p>
              <p style="margin:6px 0 0; font-size:18px; color:${brand.primary}; font-family:Georgia,serif; font-weight:bold;">${milestone.icon} ${milestone.label}</p>
            </div>

            <!-- Greeting -->
            <h2 style="margin:0 0 16px; font-size:22px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">
              Your case has moved forward, ${firstName}
            </h2>

            <p style="margin:0 0 20px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">
              ${prevMilestone ? `Your case has progressed from <strong>${prevMilestone.label}</strong> to <strong>${milestone.label}</strong>.` : `Your case status has been updated to <strong>${milestone.label}</strong>.`}
              ${milestone.description}
            </p>

            <!-- Progress tracker -->
            <div style="background-color:${brand.white}; border:1px solid ${brand.border}; border-radius:12px; padding:20px 24px; margin:0 0 24px;">
              <p style="margin:0 0 16px; font-size:11px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.12em; font-family:Georgia,serif;">Case Progress</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>${progressHtml}</tr>
              </table>
            </div>

            <!-- Case details -->
            <div style="background-color:${brand.secondary}; border:1px solid ${brand.border}; border-radius:10px; padding:18px 24px; margin:0 0 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:8px 0; border-bottom:1px solid rgba(217,208,197,0.5); width:40%;">
                    <p style="margin:0; font-size:11px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.06em; font-family:Georgia,serif;">Case</p>
                  </td>
                  <td style="padding:8px 0; border-bottom:1px solid rgba(217,208,197,0.5); text-align:right;">
                    <p style="margin:0; font-size:13px; color:${brand.foreground}; font-family:Georgia,serif; font-weight:bold;">${caseName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0; width:40%;">
                    <p style="margin:0; font-size:11px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.06em; font-family:Georgia,serif;">Service</p>
                  </td>
                  <td style="padding:8px 0; text-align:right;">
                    <p style="margin:0; font-size:13px; color:${brand.foreground}; font-family:Georgia,serif;">${service}</p>
                  </td>
                </tr>
              </table>
            </div>

            ${customMessage ? `
            <!-- Custom message from attorney -->
            <div style="background-color:${brand.accentLight}; border:1px solid rgba(200,150,90,0.35); border-radius:10px; padding:20px 24px; margin:0 0 24px;">
              <p style="margin:0 0 8px; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">Note from Maggi May</p>
              <p style="margin:0; font-size:13px; color:${brand.foreground}; line-height:1.7; font-family: Georgia, serif;">${customMessage}</p>
            </div>
            ` : ''}

            <!-- Next step -->
            <div style="background-color:${brand.greenLight}; border:1px solid rgba(53,94,59,0.25); border-radius:10px; padding:16px 20px; margin:0 0 28px;">
              <p style="margin:0 0 6px; font-size:11px; color:${brand.green}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family:Georgia,serif;">What Happens Next</p>
              <p style="margin:0; font-size:13px; color:${brand.foreground}; line-height:1.7; font-family:Georgia,serif;">${milestone.nextStep}</p>
            </div>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 24px 0;">
              <tr>
                <td style="background-color:${brand.green}; border-radius:7px; box-shadow: 0 2px 8px rgba(53,94,59,0.30);">
                  <a href="${SITE_URL}/portal/cases" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">View Case in Portal &rarr;</a>
                </td>
              </tr>
            </table>

            <!-- Signature -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
              <tr>
                <td>
                  <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family: Georgia, serif;">Warm regards,</p>
                  <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">Maggi May Broussard</p>
                  <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
                  <a href="mailto:broussardlegalservices@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">broussardlegalservices@gmail.com</a>
                  &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
                  <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">${SITE_URL.replace('https://', '')}</a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:${brand.secondary}; padding: 20px 36px; border-top: 1px solid ${brand.border};">
            <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7;">
              You received this because you have an active case with Broussard Legal Services.
              <a href="${SITE_URL}" style="color:${brand.accent}; text-decoration:none;">Visit our site</a>
              &nbsp;·&nbsp;
              <a href="mailto:broussardlegalservices@gmail.com?subject=Unsubscribe" style="color:${brand.muted}; text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName,
      clientEmail,
      clientUserId,
      caseName,
      caseId,
      service,
      previousStage,
      newStage,
      customMessage,
    } = body;

    if (!clientEmail || !clientName || !caseId || !newStage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createServerClient();

    // Insert in-app notification
    const notifPayload = {
      user_id: clientUserId ?? null,
      inquiry_id: caseId,
      type: 'case_milestone',
      title: `Case Milestone: ${MILESTONE_STAGES[newStage]?.label ?? newStage}`,
      body: MILESTONE_STAGES[newStage]?.description ?? `Your case has moved to ${newStage}.`,
      read: false,
      metadata: { previousStage, newStage, caseName, service },
    };

    await supabase.from('notifications').insert(notifPayload).select().maybeSingle();

    // Send email notification
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      console.warn('RESEND_API_KEY not configured — skipping milestone email');
      return NextResponse.json({ success: true, emailSent: false, message: 'In-app notification created; email skipped (no API key)' });
    }

    const html = buildMilestoneEmail({ clientName, caseName, caseId, service, previousStage, newStage, customMessage });

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Maggi May Broussard <noreply@broussardlegalservices.com>',
        to: [clientEmail],
        subject: `Case Update: ${MILESTONE_STAGES[newStage]?.label ?? newStage} — ${caseName}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error:', err);
      return NextResponse.json({ success: true, emailSent: false, error: err });
    }

    return NextResponse.json({ success: true, emailSent: true });
  } catch (err: any) {
    console.error('Milestone notification error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}
