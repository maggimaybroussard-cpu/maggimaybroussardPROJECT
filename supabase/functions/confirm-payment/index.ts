import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

interface ConfirmPaymentBody {
  paymentIntentId: string;
  tableName: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = 'https://broussardlegalservices.com';

const brand = {
  bg: '#FAF7F2',
  primary: '#4A3728',
  accent: '#C8965A',
  foreground: '#2C1F14',
  muted: '#7A6B5D',
  border: '#D9D0C5',
  secondary: '#EDE8E0',
  white: '#FFFFFF',
  green: '#355E3B',
  greenLight: '#EAF2EB',
};

function buildPortalCredentialsEmail(
  clientName: string,
  clientEmail: string,
  service: string,
  amount: number,
  referenceCode: string,
  paymentType: string,
  portalLoginUrl: string
): string {
  const firstName = clientName.split(' ')[0];
  const isRetainer = paymentType === 'retainer';
  const paymentLabel = isRetainer ? 'Retainer Payment' : 'Legal Services Payment';

  const p = (text: string) =>
    `<p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family:Georgia,serif;">${text}</p>`;

  const cta = (label: string, href: string, color = brand.accent) => `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;">
      <tr>
        <td style="background-color:${color}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.25);">
          <a href="${href}" style="display:inline-block; padding:14px 32px; color:${brand.white}; text-decoration:none; font-size:14px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">${label} &rarr;</a>
        </td>
      </tr>
    </table>
  `;

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
    <div style="height:20px; background-color:${brand.primary};"></div>
  `;

  const bodyHtml = `
    <!-- Payment confirmed badge -->
    <div style="background-color:${brand.greenLight}; border:1px solid rgba(53,94,59,0.2); border-radius:10px; padding:16px 20px; margin-bottom:24px; display:flex; align-items:center;">
      <span style="display:inline-block; background-color:${brand.green}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; font-family:Georgia,serif;">&#10003; Payment Confirmed</span>
      <span style="margin-left:12px; font-size:13px; color:${brand.green}; font-family:Georgia,serif; font-weight:bold;">${referenceCode}</span>
    </div>

    ${p(`Dear ${firstName},`)}
    ${p(`Your payment of <strong>$${amount.toLocaleString()} USD</strong> for <strong>${service}</strong> has been received and confirmed. Your case has been created in our client portal.`)}

    <!-- Receipt summary -->
    <div style="background-color:${brand.white}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin-bottom:24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family:Georgia,serif;">Payment Summary</p>
      </div>
      <div style="padding:16px 22px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="font-family:Georgia,serif;">
          <tr>
            <td style="padding:8px 0; border-bottom:1px solid rgba(217,208,197,0.5); width:45%;">
              <p style="margin:0; font-size:12px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.04em;">Service</p>
            </td>
            <td style="padding:8px 0 8px 12px; border-bottom:1px solid rgba(217,208,197,0.5); text-align:right;">
              <p style="margin:0; font-size:14px; color:${brand.foreground}; font-weight:bold;">${service}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0; border-bottom:1px solid rgba(217,208,197,0.5);">
              <p style="margin:0; font-size:12px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.04em;">Payment Type</p>
            </td>
            <td style="padding:8px 0 8px 12px; border-bottom:1px solid rgba(217,208,197,0.5); text-align:right;">
              <p style="margin:0; font-size:14px; color:${brand.foreground}; font-weight:bold;">${paymentLabel}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0 6px; border-top:2px solid ${brand.accent};">
              <p style="margin:0; font-size:13px; color:${brand.foreground}; font-weight:bold; text-transform:uppercase; letter-spacing:0.06em;">Total Paid</p>
            </td>
            <td style="padding:12px 0 6px 12px; border-top:2px solid ${brand.accent}; text-align:right;">
              <p style="margin:0; font-size:20px; color:${brand.green}; font-weight:bold;">$${amount.toLocaleString()} <span style="font-size:12px; color:${brand.muted};">USD</span></p>
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Portal access section -->
    <div style="background-color:${brand.greenLight}; border-left:3px solid ${brand.green}; padding:20px 22px; border-radius:0 8px 8px 0; margin-bottom:24px;">
      <p style="margin:0 0 8px; font-size:12px; color:${brand.green}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family:Georgia,serif;">&#128274; Your Client Portal Access</p>
      <p style="margin:0 0 12px; font-size:14px; color:${brand.foreground}; line-height:1.7; font-family:Georgia,serif;">
        A secure client portal account has been created for you at <strong>${clientEmail}</strong>. 
        Click the button below to set your password and access your portal.
      </p>
      <p style="margin:0; font-size:12px; color:${brand.muted}; font-family:Georgia,serif;">
        The setup link is valid for 24 hours. If it expires, you can request a new one from the portal login page.
      </p>
    </div>

    ${cta('Set Up My Portal Access', portalLoginUrl, brand.green)}

    <!-- Next steps -->
    <div style="background-color:${brand.white}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin-bottom:24px;">
      <div style="background-color:${brand.primary}; padding:12px 22px;">
        <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family:Georgia,serif;">&#128203; What Happens Next</p>
      </div>
      <div style="padding:16px 22px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="font-family:Georgia,serif;">
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top; width:36px;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.accent}; text-align:center; line-height:28px; font-size:12px; font-weight:bold; color:${brand.white};">1</div>
            </td>
            <td style="padding:10px 0 10px 14px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Set Up Your Portal</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">Click the button above to create your password and access your secure client portal.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.accent}; text-align:center; line-height:28px; font-size:12px; font-weight:bold; color:${brand.white};">2</div>
            </td>
            <td style="padding:10px 0 10px 14px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">Upload Your Documents</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">Log in to your portal and upload any relevant documents so I can review them before our first call.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.accent}; text-align:center; line-height:28px; font-size:12px; font-weight:bold; color:${brand.white};">3</div>
            </td>
            <td style="padding:10px 0 10px 14px; border-bottom:1px solid rgba(217,208,197,0.5); vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">${isRetainer ? 'Book Your Onboarding Call' : 'Schedule Your Consultation'}</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">${isRetainer ? 'Book your kickoff call so we can align on priorities and get started on your matter.' : 'Use the scheduling link to pick a time that works for you.'}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0; vertical-align:top;">
              <div style="width:28px; height:28px; border-radius:50%; background-color:${brand.green}; text-align:center; line-height:28px; font-size:12px; font-weight:bold; color:${brand.white};">4</div>
            </td>
            <td style="padding:10px 0 10px 14px; vertical-align:top;">
              <p style="margin:0 0 3px; font-size:14px; color:${brand.foreground}; font-weight:bold;">We Get to Work</p>
              <p style="margin:0; font-size:12px; color:${brand.muted};">Once your documents are reviewed and our call is complete, I will begin work on your matter immediately.</p>
            </td>
          </tr>
        </table>
      </div>
    </div>

    ${p(`Questions? Reply to this email or reach out directly — I typically respond within one business day.`)}
    ${p(`Warm regards,<br/><strong>Maggi May Broussard</strong><br/><span style="font-size:12px; color:${brand.muted};">Broussard Legal Services</span>`)}
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Confirmed — Maggi May Broussard</title>
    </head>
    <body style="margin:0; padding:0; background-color:${brand.secondary}; font-family:Georgia,'Times New Roman',serif; -webkit-text-size-adjust:100%;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${brand.secondary}; padding:40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border:1px solid ${brand.border}; box-shadow:0 4px 24px rgba(74,55,40,0.10);">
            <tr><td style="background-color:${brand.primary}; padding:0;">${headerHtml}</td></tr>
            <tr>
              <td style="padding:32px 36px 0;">
                <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family:Georgia,serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">Payment Confirmed &amp; Portal Access Ready</h2>
              </td>
            </tr>
            <tr><td style="padding:0 36px 32px;">${bodyHtml}</td></tr>
            <tr>
              <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
                <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family:Georgia,serif;">Maggi May Broussard Legal Services</p>
                <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7; font-family:Georgia,serif;">
                  You received this because you made a payment at maggimay.com.
                  <a href="${SITE_URL}" style="color:${brand.accent}; text-decoration:none;">Visit our site</a>
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { paymentIntentId, tableName } = (await req.json()) as ConfirmPaymentBody;

    if (!paymentIntentId || !tableName) {
      return new Response(
        JSON.stringify({ error: 'Missing paymentIntentId or tableName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const { data: record, error: findError } = await supabase
      .from(tableName)
      .select('*')
      .eq('payment_intent_id', paymentIntentId)
      .single();

    if (findError || !record) {
      throw new Error('Payment record not found');
    }

    const paymentStatus = paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending';

    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        payment_status: paymentStatus,
        stripe_charge_id: paymentIntent.latest_charge as string | null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    if (updateError) throw new Error(updateError.message);

    // ── On successful payment: create case record + invite client + send confirmation email ──
    if (paymentStatus === 'succeeded' && record.customer_email) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const resendApiKey = Deno.env.get('RESEND_API_KEY');

      try {
        // ── 1. Create or find a contact_inquiries (case) record ──
        let inquiryId: string | null = null;

        // Check if a case already exists for this payment
        const { data: existingInquiry } = await supabase
          .from('contact_inquiries')
          .select('id')
          .eq('payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (existingInquiry?.id) {
          inquiryId = existingInquiry.id;
        } else {
          // Create a new case record
          const serviceName = record.description ?? 'Legal Services';
          const { data: newInquiry, error: inquiryError } = await supabase
            .from('contact_inquiries')
            .insert({
              name: record.customer_name ?? 'Client',
              email: record.customer_email,
              firm: record.firm_name ?? null,
              service: serviceName,
              message: `Case created automatically on payment confirmation. Payment reference: RCP-${paymentIntentId.slice(-8).toUpperCase()}. Amount: $${Number(record.amount).toLocaleString()} USD.`,
              status: 'active',
              booking_stage: 'active_client',
              source: 'payment',
              payment_intent_id: paymentIntentId,
              payment_type: record.payment_type ?? null,
            })
            .select('id')
            .single();

          if (!inquiryError && newInquiry?.id) {
            inquiryId = newInquiry.id;

            // Add a welcome timeline event
            await supabase.from('case_timeline').insert({
              inquiry_id: inquiryId,
              event_title: 'Case Opened',
              event_description: `Case created following payment confirmation. Service: ${serviceName}. Amount paid: $${Number(record.amount).toLocaleString()} USD. Reference: RCP-${paymentIntentId.slice(-8).toUpperCase()}.`,
              event_date: new Date().toISOString(),
            });
          } else {
            console.error('Failed to create case record:', inquiryError?.message);
          }
        }

        // ── 2. Invite client to portal (create auth user) ──
        let portalLoginUrl = `${SITE_URL}/portal/login`;

        try {
          const inviteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              email: record.customer_email,
              email_confirm: false,
              user_metadata: { full_name: record.customer_name ?? 'Client' },
              send_confirmation: false,
            }),
          });

          if (inviteRes.ok) {
            const inviteData = await inviteRes.json();
            const newUserId = inviteData?.id;

            // Link user to case via client_portal_access
            if (newUserId && inquiryId) {
              await supabase
                .from('client_portal_access')
                .upsert(
                  { user_id: newUserId, inquiry_id: inquiryId },
                  { onConflict: 'user_id,inquiry_id' }
                );
            }

            // Generate a magic link / invite link for the client
            try {
              const magicLinkRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${newUserId}/generate-link`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': serviceRoleKey,
                  'Authorization': `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({
                  type: 'invite',
                  email: record.customer_email,
                  redirect_to: `${SITE_URL}/portal/dashboard`,
                }),
              });

              if (magicLinkRes.ok) {
                const linkData = await magicLinkRes.json();
                if (linkData?.action_link) {
                  portalLoginUrl = linkData.action_link;
                }
              }
            } catch {
              // Non-fatal — use default portal login URL
            }
          } else {
            // User may already exist — try to look them up and link
            const listRes = await fetch(
              `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(record.customer_email)}`,
              {
                headers: {
                  'apikey': serviceRoleKey,
                  'Authorization': `Bearer ${serviceRoleKey}`,
                },
              }
            );

            if (listRes.ok) {
              const listData = await listRes.json();
              const existingUser = listData?.users?.[0];
              if (existingUser?.id && inquiryId) {
                await supabase
                  .from('client_portal_access')
                  .upsert(
                    { user_id: existingUser.id, inquiry_id: inquiryId },
                    { onConflict: 'user_id,inquiry_id' }
                  );
              }
            }
          }
        } catch (inviteErr) {
          console.error('Portal invite error (non-fatal):', inviteErr);
        }

        // ── 3. Send confirmation email with portal credentials + next steps ──
        if (resendApiKey && resendApiKey !== 'your-resend-api-key-here') {
          const referenceCode = `RCP-${paymentIntentId.slice(-8).toUpperCase()}`;
          const emailHtml = buildPortalCredentialsEmail(
            record.customer_name ?? 'Valued Client',
            record.customer_email,
            record.description ?? 'Legal Services',
            Number(record.amount),
            referenceCode,
            record.payment_type ?? 'payment',
            portalLoginUrl
          );

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: 'maggimay@broussardlegalservices.com',
              to: [record.customer_email],
              subject: `Payment confirmed — your portal access is ready (${referenceCode})`,
              html: emailHtml,
            }),
          });
        }

        // ── 4. Send payment receipt email via notify-client ──
        await fetch(`${supabaseUrl}/functions/v1/notify-client`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            clientEmail: record.customer_email,
            clientName: record.customer_name ?? 'Valued Client',
            eventType: 'payment_receipt',
            details: {
              amount: record.amount,
              currency: record.currency ?? 'usd',
              paymentType: record.payment_type,
              description: record.description,
              paymentIntentId: paymentIntentId,
            },
          }),
        });

        // ── 5. Generate PDF invoice ──
        await fetch(`${supabaseUrl}/functions/v1/generate-invoice`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            clientEmail: record.customer_email,
            clientName: record.customer_name ?? 'Valued Client',
            paymentIntentId: paymentIntentId,
            paymentType: record.payment_type,
            amount: record.amount,
            currency: record.currency ?? 'usd',
            description: record.description,
          }),
        });

        // ── 6. Schedule post-payment welcome email sequence ──
        await fetch(`${supabaseUrl}/functions/v1/schedule-post-payment-sequence`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            inquiryId: inquiryId,
            recipientEmail: record.customer_email,
            recipientName: record.customer_name ?? 'Valued Client',
            service: record.description ?? 'Legal Services',
            amount: record.amount,
            paymentType: record.payment_type,
            referenceCode: `RCP-${paymentIntentId.slice(-8).toUpperCase()}`,
            paymentIntentId: paymentIntentId,
            paymentDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          }),
        });
      } catch (postPaymentErr) {
        // Non-fatal: log but don't fail the payment confirmation
        console.error('Post-payment processing error:', postPaymentErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, status: paymentStatus, record }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Confirmation failed';
    console.error('confirm-payment error:', e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
