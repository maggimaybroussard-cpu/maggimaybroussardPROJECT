import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://broussardlegalservices.com';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientName,
      clientEmail,
      paymentIntentId,
      invoiceId,
      inquiryId,
      retainerAmount,
      eventName,
    } = body as {
      clientName: string;
      clientEmail: string;
      paymentIntentId?: string;
      invoiceId?: string;
      inquiryId?: string;
      retainerAmount?: number;
      eventName?: string;
    };

    if (!clientName || !clientEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    // Idempotency: check if letter already exists for this payment intent
    if (paymentIntentId) {
      const { data: existing } = await supabase
        .from('engagement_letters')
        .select('id, token')
        .eq('payment_intent_id', paymentIntentId)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ letterId: existing.id, token: existing.token, existing: true });
      }
    }

    const deposit = retainerAmount ?? 250;
    const firstName = clientName.split(' ')[0];
    const serviceLabel = eventName ?? 'Legal Consultation';

    // Build letter content
    const scope = `This engagement covers the following legal services: ${serviceLabel}. Broussard Legal Services will provide legal counsel, document preparation, and representation as applicable to your matter. The scope may be expanded by mutual written agreement.`;

    const fees = `Attorney fees are billed at the agreed hourly rate or flat-fee arrangement as discussed during your consultation. All fees are outlined in the final retainer agreement. Additional costs (court filing fees, third-party expenses) are billed separately and require prior approval.`;

    const timeline = `Engagement begins upon receipt of the signed letter and deposit. Initial case review will be completed within 3–5 business days. You will receive a detailed timeline and milestone schedule after the intake process is complete.`;

    const nextSteps = `1. Review and sign this engagement letter below.\n2. Complete your client intake questionnaire (link will be emailed separately).\n3. Schedule your onboarding call via the client portal.\n4. Upload any relevant documents to your secure client portal.\n5. Your attorney will contact you within 1 business day to confirm next steps.`;

    const { data: letter, error: insertError } = await supabase
      .from('engagement_letters')
      .insert({
        client_name: clientName,
        client_email: clientEmail,
        payment_intent_id: paymentIntentId ?? null,
        invoice_id: invoiceId ?? null,
        inquiry_id: inquiryId ?? null,
        retainer_amount: deposit,
        scope,
        fees,
        timeline,
        next_steps: nextSteps,
        status: 'pending',
      })
      .select('id, token')
      .single();

    if (insertError || !letter) {
      console.error('[engagement-letter/generate] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create engagement letter' }, { status: 500 });
    }

    const signingUrl = `${SITE_URL}/engagement-letter/${letter.token}`;

    // Send email to client with signing link
    if (RESEND_API_KEY && RESEND_API_KEY !== 'your-resend-api-key-here' && clientEmail) {
      const emailHtml = `
        <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#FAF7F2;border-radius:12px;border:1px solid #D9D0C5;">
          <div style="text-align:center;margin-bottom:28px;">
            <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#7A6B5D;margin:0 0 8px;">Broussard Legal Services</p>
            <h1 style="font-size:26px;color:#2C1F14;margin:0 0 8px;font-weight:normal;">Your Engagement Letter is Ready</h1>
            <p style="color:#7A6B5D;font-size:14px;margin:0;">Please review and sign to begin your engagement.</p>
          </div>

          <div style="background:#fff;border-radius:10px;padding:24px;border:1px solid #EDE8E0;margin-bottom:24px;">
            <p style="font-size:14px;color:#4A3728;margin:0 0 16px;">Dear ${firstName},</p>
            <p style="font-size:14px;color:#4A3728;line-height:1.7;margin:0 0 16px;">
              Thank you for your deposit of <strong>$${deposit.toFixed(2)}</strong>. Your engagement with Broussard Legal Services has been confirmed.
            </p>
            <p style="font-size:14px;color:#4A3728;line-height:1.7;margin:0 0 20px;">
              Your personalized engagement letter is ready for your review and digital signature. This letter outlines the scope of services, fee structure, retainer applied, timeline, and your next steps.
            </p>
            <div style="text-align:center;">
              <a href="${signingUrl}" style="display:inline-block;background:#355E3B;color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:13px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
                Review &amp; Sign Engagement Letter
              </a>
            </div>
          </div>

          <div style="background:rgba(200,150,90,0.08);border:1px solid rgba(200,150,90,0.25);border-radius:8px;padding:16px;margin-bottom:24px;">
            <p style="font-size:12px;color:#7A6B5D;margin:0;line-height:1.6;">
              <strong style="color:#C8965A;">⏱ Please sign within 30 days.</strong> This link is secure and unique to you. If you have questions, reply to this email or contact us at <a href="mailto:maggimay@broussardlegalservices.com" style="color:#C8965A;">maggimay@broussardlegalservices.com</a>.
            </p>
          </div>

          <p style="font-size:12px;color:#7A6B5D;text-align:center;margin:0;">
            Broussard Legal Services · <a href="${SITE_URL}" style="color:#C8965A;">${SITE_URL}</a>
          </p>
        </div>
      `;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'maggimay@broussardlegalservices.com',
            to: [clientEmail],
            subject: `Your Engagement Letter — Broussard Legal Services`,
            html: emailHtml,
          }),
        });
      } catch (emailErr) {
        console.error('[engagement-letter/generate] Email send error:', emailErr);
        // Non-fatal
      }
    }

    return NextResponse.json({
      letterId: letter.id,
      token: letter.token,
      signingUrl,
    });
  } catch (err) {
    console.error('[engagement-letter/generate] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate engagement letter' },
      { status: 500 }
    );
  }
}
