import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getChatCompletion } from '@/lib/ai/chatCompletion';

const brand = {
  primary: '#4A3728',
  accent: '#C8965A',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  bg: '#FAF7F2',
  white: '#FFFFFF',
};

function buildNurtureEmailHtml(
  subject: string,
  body: string,
  ctaText: string,
  ctaUrlHint: string,
  preheader: string
): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://broussardlegalservices.com';
  const ctaUrl = ctaUrlHint.startsWith('http')
    ? ctaUrlHint
    : `${siteUrl}/${ctaUrlHint.replace(/^\//, '')}`;

  // Convert plain text body to HTML paragraphs
  const bodyHtml = body
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => `<p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;line-height:1.7;">${line}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:${brand.secondary};font-family:Georgia,'Times New Roman',serif;">
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
        <!-- Header bar -->
        <tr>
          <td style="background-color:${brand.primary};padding:0;">
            <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;background-color:${brand.primary};">
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
          </td>
        </tr>
        <!-- Subject line -->
        <tr>
          <td style="padding:32px 36px 0;">
            <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">${subject}</h2>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:0 36px 24px;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- CTA Button -->
        <tr>
          <td style="padding:0 36px 32px;text-align:center;">
            <a href="${ctaUrl}" style="display:inline-block;background-color:${brand.primary};color:${brand.white};font-family:Georgia,serif;font-size:15px;font-weight:normal;letter-spacing:0.04em;text-decoration:none;padding:14px 32px;border-radius:8px;border:1px solid ${brand.accent};">${ctaText}</a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;">Maggi May Broussard Legal Services &nbsp;·&nbsp; Louisiana &amp; Nationwide</p>
            <p style="margin:6px 0 0;font-size:11px;color:${brand.muted};font-family:Georgia,serif;">
              <a href="${siteUrl}" style="color:${brand.accent};text-decoration:none;">broussardlegalservices.com</a>
              &nbsp;·&nbsp;
              <a href="${siteUrl}/unsubscribe" style="color:${brand.muted};text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sequenceId,
      sequenceType = 'nurture', // 'nurture' | 'abandoned'
      name,
      email,
      leadScore,
      scoreTier,
      triggerType,
      serviceInterest,
      currentStep,
      totalSteps,
      lastEmailSentAt,
      followUpCount,
      conversionType,
      // Optional: pre-generated email content (skip AI generation if provided)
      preGeneratedSubject,
      preGeneratedBody,
      preGeneratedPreheader,
      preGeneratedCtaText,
      preGeneratedCtaUrlHint,
      provider = 'ANTHROPIC',
      model = 'anthropic/claude-haiku-4-5',
    } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 503 });
    }

    let subject: string;
    let preheader: string;
    let emailBody: string;
    let ctaText: string;
    let ctaUrlHint: string;

    // ── Step 1: Generate email content (or use pre-generated) ──────────────────
    if (preGeneratedSubject && preGeneratedBody) {
      subject = preGeneratedSubject;
      preheader = preGeneratedPreheader || '';
      emailBody = preGeneratedBody;
      ctaText = preGeneratedCtaText || 'Schedule a Consultation';
      ctaUrlHint = preGeneratedCtaUrlHint || 'book-consultation';
    } else {
      // Build engagement context
      const engagementContext: string[] = [];
      if (currentStep && totalSteps) {
        engagementContext.push(`Currently on step ${currentStep} of ${totalSteps} in the nurture sequence`);
      }
      if (lastEmailSentAt) {
        const daysSince = Math.floor(
          (Date.now() - new Date(lastEmailSentAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        engagementContext.push(`Last email was sent ${daysSince} day${daysSince !== 1 ? 's' : ''} ago`);
      }
      if (followUpCount) {
        engagementContext.push(`${followUpCount} follow-up${followUpCount !== 1 ? 's' : ''} have been sent so far`);
      }
      if (conversionType) {
        engagementContext.push(`Previously expressed interest in: ${conversionType}`);
      }

      const triggerLabels: Record<string, string> = {
        form_submission: 'submitted a contact form',
        abandoned_booking: 'started but did not complete a booking',
        intake_incomplete: 'began an intake form but did not finish',
        consultation_no_show: 'missed a scheduled consultation',
        post_consultation_no_convert: 'had a consultation but has not yet retained services',
      };
      const triggerDescription = triggerLabels[triggerType] || triggerType || 'engaged with the website';

      const tierGuidance: Record<string, string> = {
        hot: 'This is a HOT lead (score 70+). Use a direct, confident, and slightly urgent tone. Emphasize immediate value and a clear call-to-action to book or call now.',
        warm: 'This is a WARM lead (score 45–69). Use a helpful, informative tone. Provide value, address potential hesitations, and gently encourage the next step.',
        cold: 'This is a COLD lead (score below 45). Use a soft, educational tone. Focus on building trust, sharing a relevant insight or resource, and keeping the door open without pressure.',
      };
      const toneGuidance = tierGuidance[scoreTier] || tierGuidance.warm;

      const systemPrompt = `You are an expert legal marketing copywriter for Broussard Legal Services, a professional paralegal firm. 
You write personalized, empathetic, and professional follow-up emails that feel human — never robotic or salesy.
The firm helps attorneys and individuals with paralegal support, document preparation, legal research, and case management.
Always write in first person from "Maggi Broussard" and sign off with her name.
Keep subject lines under 60 characters. Keep email body under 200 words. Use plain, warm language.`;

      const userPrompt = `Write a personalized follow-up email for this lead:

**Lead Details:**
- Name: ${name}
- Lead Score: ${leadScore}/100 (${scoreTier} tier)
- How they engaged: ${triggerDescription}
- Service interest: ${serviceInterest || 'General paralegal services'}
${engagementContext.length > 0 ? `- Engagement history: ${engagementContext.join('; ')}` : ''}

**Tone Guidance:**
${toneGuidance}

**Output Format (return valid JSON only, no markdown):**
{
  "subject": "Email subject line here",
  "preheader": "Short preview text (max 90 chars)",
  "body": "Full email body with greeting, 2-3 short paragraphs, and sign-off",
  "cta_text": "Call-to-action button text",
  "cta_url_hint": "Suggested destination (e.g. book-consultation, contact, services)"
}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const content = await getChatCompletion(messages, {
        model,
        max_completion_tokens: 600,
        temperature: 0.7,
      });

      try {
        const cleaned = (content as string)
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        const parsed = JSON.parse(cleaned);
        subject = parsed.subject;
        preheader = parsed.preheader || '';
        emailBody = parsed.body;
        ctaText = parsed.cta_text || 'Schedule a Consultation';
        ctaUrlHint = parsed.cta_url_hint || 'book-consultation';
      } catch {
        subject = `Following up — ${name}`;
        preheader = 'A quick note from Maggi Broussard';
        emailBody = content as string;
        ctaText = 'Schedule a Consultation';
        ctaUrlHint = 'book-consultation';
      }
    }

    // ── Step 2: Build branded HTML ─────────────────────────────────────────────
    const html = buildNurtureEmailHtml(subject, emailBody, ctaText, ctaUrlHint, preheader);

    // ── Step 3: Send via Resend ────────────────────────────────────────────────
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Maggi Broussard <onboarding@resend.dev>',
        to: [email],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      throw new Error(resendData?.message || `Resend error: ${resendRes.status}`);
    }

    const resendEmailId: string = resendData.id;

    // ── Step 4: Log to nurture_email_logs + update sequence ───────────────────
    try {
      const supabase = await createClient();
      const now = new Date().toISOString();

      // Log the sent email
      await supabase.from('nurture_email_logs').insert({
        sequence_id: sequenceId || null,
        sequence_type: sequenceType,
        recipient_email: email,
        recipient_name: name,
        subject,
        body_preview: emailBody.substring(0, 300),
        resend_email_id: resendEmailId,
        sent_at: now,
        trigger_type: triggerType || null,
        lead_score: leadScore || null,
        score_tier: scoreTier || null,
        step_number: currentStep || null,
      });

      // Update sequence last_email_sent_at and advance step
      if (sequenceId) {
        if (sequenceType === 'nurture') {
          const nextStep = (currentStep || 0) + 1;
          const isComplete = totalSteps && nextStep > totalSteps;
          const nextEmailDate = new Date();
          nextEmailDate.setDate(nextEmailDate.getDate() + 3); // default 3-day cadence

          await supabase
            .from('lead_nurture_sequences')
            .update({
              last_email_sent_at: now,
              current_step: nextStep,
              sequence_status: isComplete ? 'completed' : 'active',
              next_email_scheduled_at: isComplete ? null : nextEmailDate.toISOString(),
            })
            .eq('id', sequenceId);
        } else if (sequenceType === 'abandoned') {
          const nextFollowUp = new Date();
          nextFollowUp.setDate(nextFollowUp.getDate() + 2); // 2-day cadence for abandoned

          await supabase
            .from('abandoned_booking_sequences')
            .update({
              last_follow_up_at: now,
              follow_up_count: (followUpCount || 0) + 1,
              next_follow_up_at: nextFollowUp.toISOString(),
            })
            .eq('id', sequenceId);
        }
      }
    } catch (dbErr) {
      // Non-critical — email was sent, just log the DB error
      console.error('DB log error after send:', dbErr);
    }

    return NextResponse.json({
      success: true,
      resendEmailId,
      subject,
      preheader,
      body: emailBody,
      cta_text: ctaText,
      cta_url_hint: ctaUrlHint,
    });
  } catch (error) {
    console.error('Send nurture email error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}
