import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://broussardlegalservices.com";
const PORTAL_URL = `${SITE_URL}/portal/invoices`;

// ─── Shared Brand Styles ──────────────────────────────────────────────────────
const brand = {
  bg: "#FAF7F2",
  bgCard: "#FFFFFF",
  primary: "#4A3728",
  accent: "#C8965A",
  accentLight: "#F5EDE0",
  foreground: "#2C1F14",
  muted: "#7A6B5D",
  border: "#D9D0C5",
  secondary: "#EDE8E0",
  white: "#FFFFFF",
  red: "#B91C1C",
  redLight: "#FEF2F2",
  orange: "#C2410C",
  orangeLight: "#FFF7ED",
  green: "#355E3B",
  greenLight: "#EAF2EB",
};

// ─── Layout Helpers ───────────────────────────────────────────────────────────

function emailWrapper(content: string, preheader = ""): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>Maggi May Broussard Legal Services</title>
      ${preheader ? `<!--[if !mso]><!--><div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div><!--<![endif]-->` : ""}
    </head>
    <body style="margin:0; padding:0; background-color:#EDE8E0; font-family: Georgia, 'Times New Roman', serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0; padding: 40px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:14px; overflow:hidden; border: 1px solid ${brand.border}; box-shadow: 0 4px 24px rgba(74,55,40,0.10);">

            <!-- ══ BRANDED HEADER ══ -->
            <tr>
              <td style="background-color:${brand.primary}; padding: 0;">
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
                  </tr>
                </table>
                <div style="height:1px; background: linear-gradient(to right, ${brand.accent}, rgba(200,150,90,0.2), transparent); margin: 0 36px;"></div>
                <div style="height:20px;"></div>
              </td>
            </tr>

            <!-- ══ BODY ══ -->
            <tr>
              <td style="padding: 36px 36px 32px;">
                ${content}
              </td>
            </tr>

            <!-- ══ FOOTER ══ -->
            <tr>
              <td style="background-color:${brand.secondary}; padding: 20px 36px; border-top: 1px solid ${brand.border};">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td>
                      <p style="margin:0 0 6px; font-size:12px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
                      <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7;">
                        This is an automated billing reminder. Questions?
                        <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; text-decoration:none;">Contact us directly</a>
                        &nbsp;·&nbsp;
                        <a href="${PORTAL_URL}" style="color:${brand.accent}; text-decoration:none;">View your portal</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

function badge(label: string, bgColor: string, textColor = brand.white): string {
  return `<span style="display:inline-block; background-color:${bgColor}; color:${textColor}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">${label}</span>`;
}

function sectionTitle(text: string): string {
  return `<h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:-0.01em; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">${text}</h2>`;
}

function ctaButton(href: string, label: string, color = brand.accent): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0;">
      <tr>
        <td style="background-color:${color}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.30);">
          <a href="${href}" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">${label} &rarr;</a>
        </td>
      </tr>
    </table>
  `;
}

function alertBox(content: string, bgColor: string, borderColor: string): string {
  return `
    <div style="background-color:${bgColor}; border-left:4px solid ${borderColor}; padding:18px 22px; border-radius:0 8px 8px 0; margin:22px 0;">
      ${content}
    </div>
  `;
}

function infoRow(label: string, value: string, valueColor = brand.foreground): string {
  return `
    <tr>
      <td style="padding:10px 0; color:${brand.muted}; font-size:13px; width:42%; vertical-align:top; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${label}</td>
      <td style="padding:10px 0; color:${valueColor}; font-size:14px; font-weight:bold; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${value}</td>
    </tr>
  `;
}

function detailsTable(rows: string): string {
  return `
    <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif; margin: 20px 0; background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:8px; overflow:hidden;">
      <tbody style="padding:0 16px;">
        ${rows}
      </tbody>
    </table>
  `;
}

function bodyText(text: string): string {
  return `<p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">${text}</p>`;
}

function signature(): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
      <tr>
        <td>
          <p style="margin:0 0 4px; font-size:15px; color:${brand.foreground}; font-family: Georgia, serif;">Warm regards,</p>
          <p style="margin:0 0 2px; font-size:16px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">Maggi May Broussard</p>
          <p style="margin:0 0 6px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif; letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
          <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimaybroussard@gmail.com</a>
          &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
          <a href="${SITE_URL}" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimay.com</a>
        </td>
      </tr>
    </table>
  `;
}

// ─── Email Templates ──────────────────────────────────────────────────────────

/**
 * Template A: Invoice unpaid — gentle first reminder (3 days before due)
 */
function invoiceFirstReminder(opts: {
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  service: string;
  paymentLink?: string;
}): { subject: string; html: string } {
  const firstName = opts.clientName.split(" ")[0];
  const ctaUrl = opts.paymentLink || PORTAL_URL;
  const content = `
    ${badge("Payment Reminder", brand.accent)}
    ${sectionTitle(`Invoice ${opts.invoiceNumber} — Payment Due Soon`)}
    ${bodyText(`Hi ${firstName}, just a friendly heads-up that your invoice for <strong>${opts.service}</strong> is due in <strong>3 days</strong>. Please review the details below and complete your payment at your earliest convenience.`)}
    ${detailsTable(`
      ${infoRow("Invoice Number", opts.invoiceNumber)}
      ${infoRow("Service", opts.service)}
      ${infoRow("Amount Due", opts.amount, brand.accent)}
      ${infoRow("Due Date", opts.dueDate, brand.orange)}
    `)}
    ${alertBox(`
      <p style="margin:0 0 6px; font-size:13px; color:${brand.orange}; font-weight:bold; font-family: Georgia, serif; text-transform:uppercase; letter-spacing:0.08em;">&#9888;&nbsp; Payment Due in 3 Days</p>
      <p style="margin:0; font-size:13px; color:${brand.foreground}; font-family: Georgia, serif; line-height:1.6;">To avoid any disruption to your services, please complete payment before <strong>${opts.dueDate}</strong>. Click the button below to pay securely — no login required.</p>
    `, brand.orangeLight, brand.orange)}
    ${ctaButton(ctaUrl, `Pay Now — ${opts.amount}`)}
    <p style="margin:0 0 8px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif;">Or copy this link: <a href="${ctaUrl}" style="color:${brand.accent}; word-break:break-all;">${ctaUrl}</a></p>
    ${bodyText(`If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to reach out directly.`)}
    ${signature()}
  `;
  return {
    subject: `Invoice ${opts.invoiceNumber} — Payment due ${opts.dueDate}`,
    html: emailWrapper(content, `Your invoice for ${opts.service} is due in 3 days — ${opts.amount} due ${opts.dueDate}.`),
  };
}

/**
 * Template B: Invoice overdue — urgent reminder (1 day past due)
 */
function invoiceOverdueReminder(opts: {
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  service: string;
  daysOverdue: number;
  paymentLink?: string;
}): { subject: string; html: string } {
  const firstName = opts.clientName.split(" ")[0];
  const ctaUrl = opts.paymentLink || PORTAL_URL;
  const content = `
    ${badge("Overdue Notice", brand.red)}
    ${sectionTitle(`Invoice ${opts.invoiceNumber} — Payment Overdue`)}
    ${bodyText(`Hi ${firstName}, your invoice for <strong>${opts.service}</strong> was due on <strong>${opts.dueDate}</strong> and remains unpaid. Please arrange payment as soon as possible to keep your account in good standing.`)}
    ${detailsTable(`
      ${infoRow("Invoice Number", opts.invoiceNumber)}
      ${infoRow("Service", opts.service)}
      ${infoRow("Amount Due", opts.amount, brand.red)}
      ${infoRow("Original Due Date", opts.dueDate)}
      ${infoRow("Days Overdue", `${opts.daysOverdue} day${opts.daysOverdue !== 1 ? "s" : ""}`, brand.red)}
    `)}
    ${alertBox(`
      <p style="margin:0 0 6px; font-size:13px; color:${brand.red}; font-weight:bold; font-family: Georgia, serif; text-transform:uppercase; letter-spacing:0.08em;">&#9888;&nbsp; Immediate Action Required</p>
      <p style="margin:0; font-size:13px; color:${brand.foreground}; font-family: Georgia, serif; line-height:1.6;">This invoice is now <strong>${opts.daysOverdue} day${opts.daysOverdue !== 1 ? "s" : ""} overdue</strong>. Click the button below to pay immediately — no login required. If you are experiencing difficulties, please contact us to discuss arrangements.</p>
    `, brand.redLight, brand.red)}
    ${ctaButton(ctaUrl, `Pay ${opts.amount} Now`, brand.red)}
    <p style="margin:0 0 8px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif;">Or copy this link: <a href="${ctaUrl}" style="color:${brand.red}; word-break:break-all;">${ctaUrl}</a></p>
    ${bodyText(`If you believe this notice was sent in error or have already submitted payment, please reply to this email and we will confirm receipt promptly.`)}
    ${signature()}
  `;
  return {
    subject: `OVERDUE: Invoice ${opts.invoiceNumber} — ${opts.amount} past due`,
    html: emailWrapper(content, `Invoice ${opts.invoiceNumber} for ${opts.service} is ${opts.daysOverdue} days overdue — ${opts.amount} outstanding.`),
  };
}

/**
 * Template C: Retainer deadline approaching (7 days before renewal/deadline)
 */
function retainerDeadlineReminder(opts: {
  clientName: string;
  retainerAmount: string;
  deadlineDate: string;
  service: string;
  depositPaid: boolean;
  depositAmount?: string;
}): { subject: string; html: string } {
  const firstName = opts.clientName.split(" ")[0];
  const balanceDue = opts.depositPaid && opts.depositAmount
    ? `$${(parseFloat(opts.retainerAmount.replace(/[^0-9.]/g, "")) - parseFloat(opts.depositAmount.replace(/[^0-9.]/g, ""))).toFixed(2)}`
    : opts.retainerAmount;

  const content = `
    ${badge("Retainer Reminder", brand.primary)}
    ${sectionTitle(`Retainer Agreement — Action Required by ${opts.deadlineDate}`)}
    ${bodyText(`Hi ${firstName}, your retainer agreement for <strong>${opts.service}</strong> requires attention before <strong>${opts.deadlineDate}</strong>. Please review the details below and complete your retainer payment to secure continued services.`)}
    ${detailsTable(`
      ${infoRow("Service", opts.service)}
      ${infoRow("Retainer Amount", opts.retainerAmount, brand.accent)}
      ${opts.depositPaid && opts.depositAmount ? infoRow("Deposit Applied", `− ${opts.depositAmount}`, brand.green) : ""}
      ${opts.depositPaid && opts.depositAmount ? infoRow("Balance Due", balanceDue, brand.orange) : ""}
      ${infoRow("Deadline", opts.deadlineDate, brand.orange)}
    `)}
    ${alertBox(`
      <p style="margin:0 0 8px; font-size:13px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif; text-transform:uppercase; letter-spacing:0.08em;">&#128197;&nbsp; 7 Days Until Retainer Deadline</p>
      <p style="margin:0 0 8px; font-size:13px; color:${brand.foreground}; font-family: Georgia, serif; line-height:1.6;">Completing your retainer secures your priority access to my services and ensures uninterrupted support for your case.</p>
      ${opts.depositPaid ? `<p style="margin:0; font-size:13px; color:${brand.green}; font-family: Georgia, serif; font-weight:bold;">&#10003; Your $150 consultation deposit has been applied toward your retainer balance.</p>` : ""}
    `, brand.accentLight, brand.accent)}
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%; margin:20px 0; background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:8px; overflow:hidden;">
      <tr>
        <td style="padding:18px 22px; border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 4px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#10003;&nbsp; Priority Case Handling</p>
          <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">Retainer clients receive first-priority scheduling and dedicated support</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 22px; border-bottom:1px solid ${brand.border};">
          <p style="margin:0 0 4px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#10003;&nbsp; Locked-In Rates</p>
          <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">Your retainer locks in current pricing for the duration of your engagement</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 22px;">
          <p style="margin:0 0 4px; font-size:14px; color:${brand.primary}; font-weight:bold; font-family: Georgia, serif;">&#10003;&nbsp; Seamless Continuity</p>
          <p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">No interruption to ongoing work — your case stays on track</p>
        </td>
      </tr>
    </table>
    ${ctaButton(PORTAL_URL, "Complete Retainer Payment")}
    ${bodyText(`Questions about the retainer agreement or payment options? Reply to this email or contact me directly — I'm happy to walk you through everything.`)}
    ${signature()}
  `;
  return {
    subject: `Retainer reminder — action required by ${opts.deadlineDate}`,
    html: emailWrapper(content, `Your retainer for ${opts.service} requires payment by ${opts.deadlineDate}. ${opts.depositPaid ? "Your deposit has been applied." : ""}`),
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const body = await req.json();
    const {
      sequenceId,
      reminderType,       // "invoice_upcoming" | "invoice_overdue" | "retainer_deadline"
      recipientEmail,
      recipientName,
      invoiceNumber,
      amount,
      dueDate,
      service,
      daysOverdue,
      retainerAmount,
      deadlineDate,
      depositPaid,
      depositAmount,
      paymentLink,        // optional: direct /pay/<token> URL
    } = body;

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build email based on reminder type
    let emailPayload: { subject: string; html: string };

    if (reminderType === "invoice_upcoming") {
      emailPayload = invoiceFirstReminder({
        clientName: recipientName,
        invoiceNumber,
        amount,
        dueDate,
        service,
        paymentLink,
      });
    } else if (reminderType === "invoice_overdue") {
      emailPayload = invoiceOverdueReminder({
        clientName: recipientName,
        invoiceNumber,
        amount,
        dueDate,
        service,
        daysOverdue: daysOverdue ?? 1,
        paymentLink,
      });
    } else if (reminderType === "retainer_deadline") {
      emailPayload = retainerDeadlineReminder({
        clientName: recipientName,
        retainerAmount: retainerAmount ?? amount,
        deadlineDate: deadlineDate ?? dueDate,
        service,
        depositPaid: depositPaid ?? false,
        depositAmount,
      });
    } else {
      throw new Error(`Unknown reminderType: ${reminderType}`);
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Maggi May Broussard <noreply@broussardlegalservices.com>",
        to: [recipientEmail],
        subject: emailPayload.subject,
        html: emailPayload.html,
      }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) throw new Error(resendData.message || "Resend API error");

    // ── SMS via Twilio (non-blocking, best-effort) ──────────────────────────
    const recipientPhone: string | undefined = body.recipientPhone;
    if (recipientPhone) {
      const TWILIO_ACCOUNT_SID = (globalThis as any)?.Deno?.env?.get("TWILIO_ACCOUNT_SID");
      const TWILIO_AUTH_TOKEN = (globalThis as any)?.Deno?.env?.get("TWILIO_AUTH_TOKEN");
      const TWILIO_PHONE_NUMBER = (globalThis as any)?.Deno?.env?.get("TWILIO_PHONE_NUMBER");

      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
        try {
          const firstName = recipientName?.split(" ")[0] ?? recipientName;
          const portalUrl = paymentLink ?? "https://broussardlegalservices.com/portal/invoices";
          let smsBody = "";

          if (reminderType === "invoice_upcoming") {
            smsBody = `Maggi May Broussard Legal Services\n\nHi ${firstName}, invoice #${invoiceNumber} for ${amount} is due on ${dueDate}. Pay securely: ${portalUrl}\n\nReply STOP to opt out.`;
          } else if (reminderType === "invoice_overdue") {
            smsBody = `Maggi May Broussard Legal Services\n\nHi ${firstName}, invoice #${invoiceNumber} for ${amount} is OVERDUE (was due ${dueDate}). Please pay now: ${portalUrl}\n\nReply STOP to opt out.`;
          } else if (reminderType === "retainer_deadline") {
            smsBody = `Maggi May Broussard Legal Services\n\nHi ${firstName}, your retainer for ${service} requires payment by ${deadlineDate ?? dueDate}. Complete it here: ${portalUrl}\n\nReply STOP to opt out.`;
          }

          if (smsBody) {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
            const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
            const formData = new URLSearchParams({ To: recipientPhone, From: TWILIO_PHONE_NUMBER, Body: smsBody });
            await fetch(twilioUrl, {
              method: "POST",
              headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
              body: formData.toString(),
            });
          }
        } catch (smsErr) {
          console.error("[send-payment-reminder] SMS send failed (non-blocking):", smsErr);
        }
      }
    }

    // Update sequence record if sequenceId provided
    if (sequenceId) {
      await supabase
        .from("email_sequences")
        .update({
          send_status: "sent",
          sent_at: new Date().toISOString(),
          resend_email_id: resendData.id,
        })
        .eq("id", sequenceId);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id, reminderType }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
