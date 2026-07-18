/**
 * schedule-invoice-reminders
 * 
 * Scans client_invoices and schedules/sends automated reminders:
 *   - 7 days BEFORE due date  (type: before_due,  trigger_days: 7)
 *   - 3 days AFTER due date   (type: after_due,   trigger_days: 3)
 *   - 7 days AFTER due date   (type: after_due,   trigger_days: 7)
 * 
 * Sends email via Resend and records portal alerts in invoice_reminders table.
 * Safe to call on a cron schedule (idempotent via unique index on
 * invoice_id + reminder_type + trigger_days).
 */

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// ─── Brand ───────────────────────────────────────────────────────────────────
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
};

const SITE_URL = "https://broussardlegalservices.com";
const PORTAL_URL = `${SITE_URL}/portal/invoices`;

function payLink(paymentToken: string | null | undefined): string {
  if (paymentToken) return `${SITE_URL}/pay/${paymentToken}`;
  return PORTAL_URL;
}

// ─── Email Helpers ────────────────────────────────────────────────────────────
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
          <a href="https://broussardlegalservices.com" style="color:${brand.accent}; font-size:13px; text-decoration:none; font-family: Georgia, serif;">maggimay.com</a>
        </td>
      </tr>
    </table>
  `;
}

function buildBeforeDueEmail(opts: {
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  service: string;
  daysUntilDue: number;
  paymentLink?: string;
}): { subject: string; html: string } {
  const firstName = opts.clientName.split(" ")[0];
  const ctaUrl = opts.paymentLink || PORTAL_URL;
  const content = `
    <span style="display:inline-block; background-color:${brand.accent}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">Payment Reminder</span>
    <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:-0.01em; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">Invoice ${opts.invoiceNumber} — Payment Due in ${opts.daysUntilDue} Days</h2>
    <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">Hi ${firstName}, this is a friendly reminder that your invoice for <strong>${opts.service}</strong> is due in <strong>${opts.daysUntilDue} day${opts.daysUntilDue !== 1 ? "s" : ""}</strong>. Please review the details below and complete your payment at your earliest convenience.</p>
    <table style="width:100%; border-collapse:collapse; margin:20px 0; background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:8px; overflow:hidden;">
      <tbody>
        <tr><td style="padding:10px 16px; color:${brand.muted}; font-size:13px; width:42%; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">Invoice Number</td><td style="padding:10px 16px; color:${brand.foreground}; font-size:14px; font-weight:bold; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${opts.invoiceNumber}</td></tr>
        <tr><td style="padding:10px 16px; color:${brand.muted}; font-size:13px; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">Service</td><td style="padding:10px 16px; color:${brand.foreground}; font-size:14px; font-weight:bold; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${opts.service}</td></tr>
        <tr><td style="padding:10px 16px; color:${brand.muted}; font-size:13px; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">Amount Due</td><td style="padding:10px 16px; color:${brand.accent}; font-size:14px; font-weight:bold; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${opts.amount}</td></tr>
        <tr><td style="padding:10px 16px; color:${brand.muted}; font-size:13px; font-family: Georgia, serif;">Due Date</td><td style="padding:10px 16px; color:${brand.orange}; font-size:14px; font-weight:bold; font-family: Georgia, serif;">${opts.dueDate}</td></tr>
      </tbody>
    </table>
    <div style="background-color:${brand.orangeLight}; border-left:4px solid ${brand.orange}; padding:18px 22px; border-radius:0 8px 8px 0; margin:22px 0;">
      <p style="margin:0 0 6px; font-size:13px; color:${brand.orange}; font-weight:bold; font-family: Georgia, serif; text-transform:uppercase; letter-spacing:0.08em;">&#9888;&nbsp; Payment Due in ${opts.daysUntilDue} Day${opts.daysUntilDue !== 1 ? "s" : ""}</p>
      <p style="margin:0; font-size:13px; color:${brand.foreground}; font-family: Georgia, serif; line-height:1.6;">To avoid any disruption to your services, please complete payment before <strong>${opts.dueDate}</strong>. Click the button below to pay securely — no login required.</p>
    </div>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0;">
      <tr>
        <td style="background-color:${brand.accent}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.30);">
          <a href="${ctaUrl}" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">Pay Now — ${opts.amount} &rarr;</a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif;">Or copy this link: <a href="${ctaUrl}" style="color:${brand.accent}; word-break:break-all;">${ctaUrl}</a></p>
    <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">If you have any questions about this invoice or need to discuss payment arrangements, please do not hesitate to reach out directly.</p>
    ${signature()}
  `;
  return {
    subject: `Invoice ${opts.invoiceNumber} — Payment due in ${opts.daysUntilDue} day${opts.daysUntilDue !== 1 ? "s" : ""} (${opts.dueDate})`,
    html: emailWrapper(content, `Your invoice for ${opts.service} is due in ${opts.daysUntilDue} days — ${opts.amount} due ${opts.dueDate}.`),
  };
}

function buildAfterDueEmail(opts: {
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  service: string;
  daysOverdue: number;
  paymentLink?: string;
}): { subject: string; html: string } {
  const firstName = opts.clientName.split(" ")[0];
  const isSecondNotice = opts.daysOverdue >= 7;
  const badgeLabel = isSecondNotice ? "Final Overdue Notice" : "Overdue Notice";
  const ctaUrl = opts.paymentLink || PORTAL_URL;
  const content = `
    <span style="display:inline-block; background-color:${brand.red}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">${badgeLabel}</span>
    <h2 style="margin:0 0 20px; font-size:21px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; letter-spacing:-0.01em; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">Invoice ${opts.invoiceNumber} — Payment Overdue${isSecondNotice ? " (Final Notice)" : ""}</h2>
    <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">Hi ${firstName}, your invoice for <strong>${opts.service}</strong> was due on <strong>${opts.dueDate}</strong> and remains unpaid. ${isSecondNotice ? "This is your <strong>final notice</strong> — please arrange payment immediately to avoid further action." : "This is a formal overdue notice — please arrange payment as soon as possible to keep your account in good standing."}</p>
    <table style="width:100%; border-collapse:collapse; margin:20px 0; background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:8px; overflow:hidden;">
      <tbody>
        <tr><td style="padding:10px 16px; color:${brand.muted}; font-size:13px; width:42%; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">Invoice Number</td><td style="padding:10px 16px; color:${brand.foreground}; font-size:14px; font-weight:bold; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${opts.invoiceNumber}</td></tr>
        <tr><td style="padding:10px 16px; color:${brand.muted}; font-size:13px; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">Service</td><td style="padding:10px 16px; color:${brand.foreground}; font-size:14px; font-weight:bold; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${opts.service}</td></tr>
        <tr><td style="padding:10px 16px; color:${brand.muted}; font-size:13px; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">Amount Due</td><td style="padding:10px 16px; color:${brand.red}; font-size:14px; font-weight:bold; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${opts.amount}</td></tr>
        <tr><td style="padding:10px 16px; color:${brand.muted}; font-size:13px; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">Original Due Date</td><td style="padding:10px 16px; color:${brand.foreground}; font-size:14px; font-weight:bold; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${opts.dueDate}</td></tr>
        <tr><td style="padding:10px 16px; color:${brand.muted}; font-size:13px; font-family: Georgia, serif;">Days Overdue</td><td style="padding:10px 16px; color:${brand.red}; font-size:14px; font-weight:bold; font-family: Georgia, serif;">${opts.daysOverdue} day${opts.daysOverdue !== 1 ? "s" : ""}</td></tr>
      </tbody>
    </table>
    <div style="background-color:${brand.redLight}; border-left:4px solid ${brand.red}; padding:18px 22px; border-radius:0 8px 8px 0; margin:22px 0;">
      <p style="margin:0 0 6px; font-size:13px; color:${brand.red}; font-weight:bold; font-family: Georgia, serif; text-transform:uppercase; letter-spacing:0.08em;">&#9888;&nbsp; ${isSecondNotice ? "Urgent: Final Notice" : "Immediate Action Required"}</p>
      <p style="margin:0; font-size:13px; color:${brand.foreground}; font-family: Georgia, serif; line-height:1.6;">This invoice is now <strong>${opts.daysOverdue} day${opts.daysOverdue !== 1 ? "s" : ""} overdue</strong>. Click the button below to pay immediately — no login required. If you are experiencing difficulties, please contact us to discuss payment arrangements.</p>
    </div>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0;">
      <tr>
        <td style="background-color:${brand.red}; border-radius:7px; box-shadow: 0 2px 8px rgba(185,28,28,0.25);">
          <a href="${ctaUrl}" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">Pay ${opts.amount} Now &rarr;</a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px; font-size:12px; color:${brand.muted}; font-family: Georgia, serif;">Or copy this link: <a href="${ctaUrl}" style="color:${brand.red}; word-break:break-all;">${ctaUrl}</a></p>
    <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">If you believe this notice was sent in error or have already submitted payment, please reply to this email and we will confirm receipt promptly.</p>
    ${signature()}
  `;
  return {
    subject: isSecondNotice
      ? `FINAL NOTICE: Invoice ${opts.invoiceNumber} — ${opts.amount} now ${opts.daysOverdue} days overdue`
      : `OVERDUE: Invoice ${opts.invoiceNumber} — ${opts.amount} past due (${opts.daysOverdue} day${opts.daysOverdue !== 1 ? "s" : ""})`,
    html: emailWrapper(content, `Invoice ${opts.invoiceNumber} for ${opts.service} is ${opts.daysOverdue} days overdue — ${opts.amount} outstanding.`),
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Supabase credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const results: { type: string; triggerDays: number; invoiceNumber: string; target: string; status: string; error?: string }[] = [];

  async function sendEmail(to: string, subject: string, html: string): Promise<string> {
    if (!RESEND_API_KEY || RESEND_API_KEY === "your-resend-api-key-here") {
      throw new Error("RESEND_API_KEY not configured");
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Maggi May Broussard <noreply@broussardlegalservices.com>",
        to: [to],
        subject,
        html,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Resend API error");
    return data.id;
  }

  function fmtDate(d: string): string {
    return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function fmtAmount(amount: number): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(amount);
  }

  function daysDiff(dateStr: string): number {
    const target = new Date(dateStr + "T00:00:00Z");
    const today = new Date(todayStr + "T00:00:00Z");
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  // ─── Helper: process a single after-due batch ─────────────────────────────
  async function processAfterDueBatch(triggerDays: number) {
    try {
      // Target date = today - triggerDays (invoices that became overdue N days ago)
      const targetDate = new Date(now.getTime() - triggerDays * 24 * 60 * 60 * 1000);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      const { data: invoices, error: fetchErr } = await supabase
        .from("client_invoices")
        .select(`id, invoice_number, amount, amount_paid, due_date, status, inquiry_id, payment_token, contact_inquiries ( name, email, service )`)
        .in("status", ["pending", "overdue"])
        .eq("due_date", targetDateStr);

      if (fetchErr) throw fetchErr;

      for (const inv of invoices ?? []) {
        const inquiry = (inv as any).contact_inquiries;
        if (!inquiry?.email || !inquiry?.name) continue;

        const balance = Number(inv.amount) - Number(inv.amount_paid);
        if (balance <= 0) continue;

        // Auto-mark as overdue if still pending
        if (inv.status === "pending") {
          await supabase
            .from("client_invoices")
            .update({ status: "overdue" })
            .eq("id", inv.id);
        }

        // Upsert with (invoice_id, reminder_type, trigger_days) uniqueness
        const { data: reminder, error: upsertErr } = await supabase
          .from("invoice_reminders")
          .upsert({
            invoice_id: inv.id,
            inquiry_id: inv.inquiry_id,
            reminder_type: "after_due",
            trigger_days: triggerDays,
            scheduled_date: todayStr,
          }, { onConflict: "invoice_id,reminder_type,trigger_days", ignoreDuplicates: false })
          .select()
          .single();

        if (upsertErr) {
          results.push({ type: "after_due", triggerDays, invoiceNumber: inv.invoice_number, target: inquiry.email, status: "failed", error: upsertErr.message });
          continue;
        }

        if (reminder?.send_status === "sent") {
          results.push({ type: "after_due", triggerDays, invoiceNumber: inv.invoice_number, target: inquiry.email, status: "skipped_already_sent" });
          continue;
        }

        try {
          const daysOverdue = Math.abs(daysDiff(inv.due_date));
          const { subject, html } = buildAfterDueEmail({
            clientName: inquiry.name,
            invoiceNumber: inv.invoice_number,
            amount: fmtAmount(balance),
            dueDate: fmtDate(inv.due_date),
            service: inquiry.service,
            daysOverdue: Math.max(daysOverdue, triggerDays),
            paymentLink: payLink((inv as any).payment_token),
          });

          const emailId = await sendEmail(inquiry.email, subject, html);

          await supabase
            .from("invoice_reminders")
            .update({ send_status: "sent", sent_at: new Date().toISOString(), resend_email_id: emailId })
            .eq("id", reminder.id);

          results.push({ type: "after_due", triggerDays, invoiceNumber: inv.invoice_number, target: inquiry.email, status: "sent" });
        } catch (err: any) {
          await supabase
            .from("invoice_reminders")
            .update({ send_status: "failed", error_message: err.message })
            .eq("id", reminder.id);
          results.push({ type: "after_due", triggerDays, invoiceNumber: inv.invoice_number, target: inquiry.email, status: "failed", error: err.message });
        }
      }
    } catch (err: any) {
      results.push({ type: "after_due", triggerDays, invoiceNumber: "batch", target: "batch", status: "failed", error: err.message });
    }
  }

  // ─── 1. Before-due reminders: 7 days before due date ─────────────────────────
  try {
    const targetDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    const { data: invoices, error: fetchErr } = await supabase
      .from("client_invoices")
      .select(`id, invoice_number, amount, amount_paid, due_date, status, inquiry_id, payment_token, contact_inquiries ( name, email, service )`)
      .in("status", ["pending"])
      .eq("due_date", targetDateStr);

    if (fetchErr) throw fetchErr;

    for (const inv of invoices ?? []) {
      const inquiry = (inv as any).contact_inquiries;
      if (!inquiry?.email || !inquiry?.name) continue;

      const balance = Number(inv.amount) - Number(inv.amount_paid);
      if (balance <= 0) continue;

      // Upsert with (invoice_id, reminder_type, trigger_days) uniqueness
      const { data: reminder, error: upsertErr } = await supabase
        .from("invoice_reminders")
        .upsert({
          invoice_id: inv.id,
          inquiry_id: inv.inquiry_id,
          reminder_type: "before_due",
          trigger_days: 7,
          scheduled_date: todayStr,
        }, { onConflict: "invoice_id,reminder_type,trigger_days", ignoreDuplicates: false })
        .select()
        .single();

      if (upsertErr) {
        results.push({ type: "before_due", triggerDays: 7, invoiceNumber: inv.invoice_number, target: inquiry.email, status: "failed", error: upsertErr.message });
        continue;
      }

      if (reminder?.send_status === "sent") {
        results.push({ type: "before_due", triggerDays: 7, invoiceNumber: inv.invoice_number, target: inquiry.email, status: "skipped_already_sent" });
        continue;
      }

      try {
        const daysUntilDue = daysDiff(inv.due_date);
        const { subject, html } = buildBeforeDueEmail({
          clientName: inquiry.name,
          invoiceNumber: inv.invoice_number,
          amount: fmtAmount(balance),
          dueDate: fmtDate(inv.due_date),
          service: inquiry.service,
          daysUntilDue: Math.max(daysUntilDue, 7),
          paymentLink: payLink((inv as any).payment_token),
        });

        const emailId = await sendEmail(inquiry.email, subject, html);

        await supabase
          .from("invoice_reminders")
          .update({ send_status: "sent", sent_at: new Date().toISOString(), resend_email_id: emailId })
          .eq("id", reminder.id);

        results.push({ type: "before_due", triggerDays: 7, invoiceNumber: inv.invoice_number, target: inquiry.email, status: "sent" });
      } catch (err: any) {
        await supabase
          .from("invoice_reminders")
          .update({ send_status: "failed", error_message: err.message })
          .eq("id", reminder.id);
        results.push({ type: "before_due", triggerDays: 7, invoiceNumber: inv.invoice_number, target: inquiry.email, status: "failed", error: err.message });
      }
    }
  } catch (err: any) {
    results.push({ type: "before_due", triggerDays: 7, invoiceNumber: "batch", target: "batch", status: "failed", error: err.message });
  }

  // ─── 2. After-due reminders: 3 days overdue ──────────────────────────────────
  await processAfterDueBatch(3);

  // ─── 3. After-due reminders: 7 days overdue ──────────────────────────────────
  await processAfterDueBatch(7);

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status.startsWith("skipped")).length;

  return new Response(
    JSON.stringify({ success: true, summary: { sent, failed, skipped, total: results.length }, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
