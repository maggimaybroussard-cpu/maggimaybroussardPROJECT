import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// ─── Tier configuration ────────────────────────────────────────────────────────
// Each tier defines the minimum days overdue, a label, and email/SMS copy.
const OVERDUE_TIERS = [
  {
    minDays: 45,
    label: "critical",
    emailSubjectPrefix: "URGENT — Final Notice",
    emailHeadline: "Final Payment Notice — Immediate Action Required",
    emailIntro: (clientName: string, daysOverdue: number) =>
      `Dear ${clientName},\n\nDespite previous reminders, invoice payment remains outstanding at <strong>${daysOverdue} days overdue</strong>. This is our final notice before the matter is escalated for collections. Please remit payment immediately to avoid further action.`,
    smsBody: (firstName: string, invoiceNumber: string, amount: string, portalUrl: string) =>
      `Broussard Legal Services\n\nFINAL NOTICE: Hi ${firstName}, invoice #${invoiceNumber} for ${amount} is critically overdue. Immediate payment required to avoid collections: ${portalUrl}\n\nReply STOP to opt out.`,
    headerColor: "#7f1d1d",
    badgeColor: "#dc2626",
  },
  {
    minDays: 30,
    label: "overdue",
    emailSubjectPrefix: "Payment Reminder",
    emailHeadline: "Invoice Overdue — Action Required",
    emailIntro: (clientName: string, daysOverdue: number) =>
      `Dear ${clientName},\n\nThis is a reminder that the following invoice is now <strong>${daysOverdue} days overdue</strong>. Please arrange payment at your earliest convenience to avoid any service interruption.`,
    smsBody: (firstName: string, invoiceNumber: string, amount: string, portalUrl: string) =>
      `Broussard Legal Services\n\nHi ${firstName}, invoice #${invoiceNumber} for ${amount} is OVERDUE. Please pay now to avoid service interruption: ${portalUrl}\n\nReply STOP to opt out.`,
    headerColor: "#dc2626",
    badgeColor: "#dc2626",
  },
  {
    minDays: 15,
    label: "early",
    emailSubjectPrefix: "Friendly Reminder",
    emailHeadline: "Invoice Payment Reminder",
    emailIntro: (clientName: string, daysOverdue: number) =>
      `Dear ${clientName},\n\nWe wanted to send a friendly reminder that the following invoice is now <strong>${daysOverdue} days past due</strong>. If you have already submitted payment, please disregard this notice. Otherwise, we kindly ask that you arrange payment at your earliest convenience.`,
    smsBody: (firstName: string, invoiceNumber: string, amount: string, portalUrl: string) =>
      `Broussard Legal Services\n\nHi ${firstName}, a friendly reminder that invoice #${invoiceNumber} for ${amount} is past due. Please pay at your convenience: ${portalUrl}\n\nReply STOP to opt out.`,
    headerColor: "#b45309",
    badgeColor: "#d97706",
  },
];

function getTier(daysOverdue: number) {
  for (const tier of OVERDUE_TIERS) {
    if (daysOverdue >= tier.minDays) return tier;
  }
  return null;
}

// ─── Twilio SMS sender (Deno-compatible) ──────────────────────────────────────
async function sendTwilioSMS(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = btoa(`${accountSid}:${authToken}`);

  const formData = new URLSearchParams({ To: to, From: fromNumber, Body: body });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data?.message ?? "Twilio error" };
    return { success: true, sid: data.sid };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "SMS error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const sendEmails = body.send_emails !== false; // default true
    const sendSMS = body.send_sms !== false; // default true

    // Fetch invoices overdue by at least 15 days (lowest tier threshold)
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const fifteenDaysAgoStr = fifteenDaysAgo.toISOString().split("T")[0];

    const { data: overdueInvoices, error: fetchError } = await supabase
      .from("client_invoices")
      .select(`
        id,
        invoice_number,
        due_date,
        amount,
        amount_paid,
        status,
        inquiry_id,
        contact_inquiries (
          name,
          email,
          phone,
          service
        )
      `)
      .in("status", ["pending", "overdue"])
      .lte("due_date", fifteenDaysAgoStr)
      .order("due_date", { ascending: true });

    if (fetchError) throw fetchError;

    const invoices = overdueInvoices ?? [];
    const results: Array<{
      invoiceId: string;
      invoiceNumber: string;
      clientName: string;
      daysOverdue: number;
      tier: string;
      emailSent: boolean;
      emailId?: string;
      smsSent: boolean;
      smsSid?: string;
      alertId?: string;
      error?: string;
    }> = [];

    for (const inv of invoices) {
      const client = (inv as any).contact_inquiries;
      const clientName = client?.name ?? "Client";
      const clientEmail = client?.email ?? null;
      const clientPhone = client?.phone ?? null;
      const dueDate = new Date(inv.due_date);
      const today = new Date();
      const daysOverdue = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const amountDue = Number(inv.amount) - Number(inv.amount_paid ?? 0);

      // Determine tier
      const tier = getTier(daysOverdue);
      if (!tier) continue; // skip if below 15-day threshold

      // Check if alert already exists (not dismissed)
      const { data: existingAlert } = await supabase
        .from("overdue_invoice_alerts")
        .select("id, reminder_sent_at, tier_label")
        .eq("invoice_id", inv.id)
        .eq("dismissed", false)
        .maybeSingle();

      let alertId = existingAlert?.id;
      let emailSent = false;
      let emailId: string | undefined;
      let smsSent = false;
      let smsSid: string | undefined;
      let notifyError: string | undefined;

      // Upsert alert record
      if (!existingAlert) {
        const { data: newAlert, error: alertErr } = await supabase
          .from("overdue_invoice_alerts")
          .insert({
            invoice_id: inv.id,
            inquiry_id: inv.inquiry_id,
            client_name: clientName,
            client_email: clientEmail,
            invoice_number: inv.invoice_number,
            amount_due: amountDue,
            due_date: inv.due_date,
            days_overdue: daysOverdue,
            reminder_status: "pending",
            tier_label: tier.label,
          })
          .select("id")
          .single();

        if (!alertErr && newAlert) {
          alertId = newAlert.id;
        }
      } else {
        // Update days_overdue and tier on existing alert
        await supabase
          .from("overdue_invoice_alerts")
          .update({
            days_overdue: daysOverdue,
            tier_label: tier.label,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAlert.id);
      }

      // Mark invoice as overdue in client_invoices if still pending
      if (inv.status === "pending") {
        await supabase
          .from("client_invoices")
          .update({ status: "overdue" })
          .eq("id", inv.id);
      }

      // Only send reminders if not already sent for this alert cycle
      const shouldSendReminders = sendEmails && !existingAlert?.reminder_sent_at;

      if (shouldSendReminders) {
        const formattedAmount = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amountDue);

        const formattedDueDate = new Date(inv.due_date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const portalUrl = "https://broussardlegalservices.com/portal/invoices";
        const firstName = clientName.split(" ")[0];

        // ── Send email ──────────────────────────────────────────────────────
        if (clientEmail) {
          try {
            const introHtml = tier
              .emailIntro(clientName, daysOverdue)
              .replace(/\n/g, "<br>")
              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

            const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: ${tier.headerColor}; padding: 28px 32px;">
      <p style="color: rgba(255,255,255,0.7); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 6px;">${tier.emailSubjectPrefix}</p>
      <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0;">${tier.emailHeadline}</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">${introHtml}</p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6b7280; font-size: 13px; padding: 4px 0;">Invoice Number</td>
            <td style="color: #111827; font-size: 13px; font-weight: 600; text-align: right;">${inv.invoice_number}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; font-size: 13px; padding: 4px 0;">Original Due Date</td>
            <td style="color: #111827; font-size: 13px; font-weight: 600; text-align: right;">${formattedDueDate}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; font-size: 13px; padding: 4px 0;">Days Overdue</td>
            <td style="color: ${tier.badgeColor}; font-size: 13px; font-weight: 700; text-align: right;">${daysOverdue} days</td>
          </tr>
          <tr style="border-top: 1px solid #fecaca;">
            <td style="color: #111827; font-size: 15px; font-weight: 700; padding: 12px 0 4px;">Amount Due</td>
            <td style="color: ${tier.badgeColor}; font-size: 18px; font-weight: 800; text-align: right; padding: 12px 0 4px;">${formattedAmount}</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${portalUrl}" style="display: inline-block; background: ${tier.headerColor}; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none;">Pay Now →</a>
      </div>
      <p style="color: #374151; font-size: 14px; margin: 0 0 12px;">
        If you have already submitted payment, please disregard this notice.
        If you have any questions or need to discuss payment arrangements, please contact us immediately.
      </p>
      <p style="color: #6b7280; font-size: 13px; margin: 0;">
        Thank you for your prompt attention to this matter.
      </p>
    </div>
    <div style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 32px;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">Broussard Legal Services · This is an automated payment reminder.</p>
    </div>
  </div>
</body>
</html>`;

            const emailRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: "onboarding@resend.dev",
                to: [clientEmail],
                subject: `${tier.emailSubjectPrefix}: Invoice ${inv.invoice_number} is ${daysOverdue} Days Overdue`,
                html: emailHtml,
              }),
            });

            const emailData = await emailRes.json();
            if (emailRes.ok && emailData.id) {
              emailId = emailData.id;
              emailSent = true;
            } else {
              notifyError = emailData.message ?? "Email send failed";
            }
          } catch (err: unknown) {
            notifyError = err instanceof Error ? err.message : "Email error";
          }
        }

        // ── Send SMS ────────────────────────────────────────────────────────
        if (sendSMS && clientPhone) {
          const smsBody = tier.smsBody(firstName, inv.invoice_number, formattedAmount, portalUrl);
          const smsResult = await sendTwilioSMS(clientPhone, smsBody);
          smsSent = smsResult.success;
          smsSid = smsResult.sid;
          if (!smsResult.success && !notifyError) {
            notifyError = smsResult.error;
          }
        }

        // ── Update alert record ─────────────────────────────────────────────
        if (alertId && (emailSent || smsSent)) {
          await supabase
            .from("overdue_invoice_alerts")
            .update({
              reminder_sent_at: new Date().toISOString(),
              reminder_email_id: emailId ?? null,
              reminder_status: emailSent || smsSent ? "sent" : "failed",
              sms_sent: smsSent,
              sms_sid: smsSid ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", alertId);
        } else if (alertId && notifyError) {
          await supabase
            .from("overdue_invoice_alerts")
            .update({ reminder_status: "failed", updated_at: new Date().toISOString() })
            .eq("id", alertId);
        }
      }

      results.push({
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        clientName,
        daysOverdue,
        tier: tier.label,
        emailSent,
        emailId,
        smsSent,
        smsSid,
        alertId,
        error: notifyError,
      });
    }

    const flagged = results.length;
    const emailsSent = results.filter((r) => r.emailSent).length;
    const smsSentCount = results.filter((r) => r.smsSent).length;

    return new Response(
      JSON.stringify({
        success: true,
        flagged,
        emailsSent,
        smsSent: smsSentCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
