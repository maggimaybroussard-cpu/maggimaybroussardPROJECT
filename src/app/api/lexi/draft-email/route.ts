import { NextRequest, NextResponse } from 'next/server';

const brand = {
  bg: '#FAF7F2',
  bgCard: '#FFFFFF',
  primary: '#4A3728',
  accent: '#C8965A',
  accentLight: '#F5EDE0',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  white: '#FFFFFF',
};

const headerHtml = `
  <div style="height:4px; background: linear-gradient(to right, ${brand.accent}, #E8B87A, ${brand.accent});"></div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding: 28px 36px 24px; background-color:${brand.primary};">
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
    </tr>
  </table>
  <div style="height:1px; background: linear-gradient(to right, ${brand.accent}, rgba(200,150,90,0.2), transparent); margin: 0 36px; background-color:${brand.primary};"></div>
  <div style="height:20px; background-color:${brand.primary};"></div>
`;

function buildEmailHtml(subject: string, bodyHtml: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; background-color:${brand.secondary}; font-family:Georgia,'Times New Roman',serif;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary}; padding:40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border:1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">
            <tr><td style="background-color:${brand.primary}; padding:0;">${headerHtml}</td></tr>
            <tr>
              <td style="padding:32px 36px 0;">
                <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">${subject}</h2>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 32px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
                <p style="margin:0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">Maggi May Broussard Legal Services &nbsp;·&nbsp; Louisiana &amp; Nationwide</p>
                <p style="margin:6px 0 0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">
                  <a href="https://broussardlegalservices.com" style="color:${brand.accent}; text-decoration:none;">broussardlegalservices.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

function wrapBodyText(text: string): string {
  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => `<p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family:Georgia,serif;">${line}</p>`)
    .join('');
}

// Template starters for AI drafting context
const TEMPLATE_PROMPTS: Record<string, string> = {
  discovery_request: `Draft a professional legal email requesting discovery documents from the opposing party or client. The email should:
- Reference the case matter clearly
- List specific document categories needed (contracts, communications, financial records, etc.)
- Set a reasonable response deadline
- Cite the applicable discovery rules if relevant
- Be formal and professional in tone
- Sign off as Maggi May Broussard, Paralegal Services`,

  settlement_offer: `Draft a professional legal email presenting or responding to a settlement offer. The email should:
- Clearly state the settlement amount or terms being proposed
- Reference the case matter and parties involved
- Outline key conditions of the settlement
- Request confirmation or counter-proposal within a specified timeframe
- Maintain a professional, measured tone
- Sign off as Maggi May Broussard, Paralegal Services`,

  case_update: `Draft a professional case status update email to the client. The email should:
- Summarize recent developments in the case
- Outline upcoming deadlines or next steps
- Note any action items required from the client
- Provide reassurance and clear communication
- Be warm yet professional in tone
- Sign off as Maggi May Broussard, Paralegal Services`,

  motion_draft: `Draft a professional legal email transmitting or summarizing a motion document. The email should:
- Identify the type of motion (e.g., Motion to Dismiss, Motion for Summary Judgment, Motion to Compel)
- Briefly state the grounds and relief sought
- Note the filing deadline and court/jurisdiction
- List any supporting documents or exhibits attached
- Request client review and approval if applicable
- Be formal and precise in tone
- Sign off as Maggi May Broussard, Paralegal Services`,

  brief_summary: `Draft a professional legal email transmitting or summarizing a legal brief. The email should:
- Identify the brief type (e.g., Opening Brief, Response Brief, Appellate Brief)
- Summarize the key legal arguments and supporting authorities
- Note the filing deadline and word/page count compliance
- Highlight any critical points requiring client attention
- Request client review and sign-off if needed
- Be thorough yet accessible in tone
- Sign off as Maggi May Broussard, Paralegal Services`,

  deposition_summary: `Draft a professional legal email providing a deposition summary to the client or attorney. The email should:
- Identify the deponent and deposition date/location
- Summarize key testimony highlights and admissions
- Note any inconsistencies or significant statements
- Flag follow-up action items (additional discovery, expert review, etc.)
- Outline next steps in the litigation timeline
- Be analytical and precise in tone
- Sign off as Maggi May Broussard, Paralegal Services`,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, templateType, clientName, clientEmail, caseDetails, customInstructions, draftedBody, subject } = body;

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    // ── DRAFT: Use /api/ai/chat-completion route (standardized) ───────────
    if (action === 'draft') {
      const templatePrompt = TEMPLATE_PROMPTS[templateType] || TEMPLATE_PROMPTS.case_update;
      const systemPrompt = `You are Lexi, an expert legal secretary at Broussard Legal Services. You draft professional, precise legal emails.`;

      const userPrompt = `${templatePrompt}

Client Name: ${clientName || 'the client'}
Case Details: ${caseDetails || 'Not specified'}
${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}

Return ONLY the email body text (no subject line, no HTML). Use plain paragraphs separated by newlines. Start with "Dear [Name]," and end with a professional sign-off.`;

      // Route through the centralized /api/ai/chat-completion endpoint
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const aiRes = await fetch(`${baseUrl}/api/ai/chat-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'OPEN_AI',
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          parameters: {
            max_completion_tokens: 1400,
            temperature: 0.4,
          },
        }),
      });

      if (!aiRes.ok) {
        const err = await aiRes.json();
        throw new Error(err.error?.message || err.error || 'AI API error');
      }

      const aiData = await aiRes.json();
      const draftText = aiData.choices?.[0]?.message?.content?.trim() || '';

      // Generate subject line
      const subjectMap: Record<string, string> = {
        discovery_request: `Discovery Request — ${caseDetails || 'Your Matter'} — Broussard Legal Services`,
        settlement_offer: `Settlement Proposal — ${caseDetails || 'Your Matter'} — Broussard Legal Services`,
        case_update: `Case Update — ${caseDetails || 'Your Matter'} — Broussard Legal Services`,
        motion_draft: `Motion — ${caseDetails || 'Your Matter'} — Broussard Legal Services`,
        brief_summary: `Legal Brief — ${caseDetails || 'Your Matter'} — Broussard Legal Services`,
        deposition_summary: `Deposition Summary — ${caseDetails || 'Your Matter'} — Broussard Legal Services`,
      };

      return NextResponse.json({
        success: true,
        draft: draftText,
        suggestedSubject: subjectMap[templateType] || `Message from Broussard Legal Services`,
      });
    }

    // ── SEND: Send the reviewed/edited email via Resend ────────────────────
    if (action === 'send') {
      if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
        return NextResponse.json({ error: 'RESEND_API_KEY is not configured.' }, { status: 503 });
      }

      if (!clientEmail || !draftedBody || !subject) {
        return NextResponse.json({ error: 'Missing required fields: clientEmail, draftedBody, subject' }, { status: 400 });
      }

      const bodyHtml = wrapBodyText(draftedBody);
      const html = buildEmailHtml(subject, bodyHtml);

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: [clientEmail],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.message || 'Resend API error');
      }

      const data = await res.json();
      return NextResponse.json({ success: true, emailId: data.id });
    }

    return NextResponse.json({ error: 'Invalid action. Use "draft" or "send".' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Request failed' },
      { status: 500 }
    );
  }
}
