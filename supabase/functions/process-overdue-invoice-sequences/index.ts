/**
 * process-overdue-invoice-sequences
 *
 * Automated overdue invoice sequence:
 *   - 7 days past due  → email + SMS reminder
 *   - 14 days past due → email + SMS reminder (escalated)
 *   - 30 days past due → email + SMS final warning
 *   - 37+ days past due → final notice email + SMS
 *   - 45+ days past due → suspend client portal access
 *
 * Safe to run on a cron schedule (idempotent per stage flags).
 */

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const SITE_URL = "https://broussardlegalservices.com";
const PORTAL_URL = `${SITE_URL}/portal/invoices`;

// ─── Brand ────────────────────────────────────────────────────────────────────
const brand = {
  bg: "#FAF7F2",
  primary: "#4A3728",
  accent: "#C8965A",
  foreground: "#2C1F14",
  muted: "#7A6B5D",
  border: "#D9D0C5",
  secondary: "#EDE8E0",
  white: "#FFFFFF",
  red: "#B91C1C",
  redLight: "#FEF2F2",
  orange: "#C2410C",
};

// ─── Sequence Stage Config ────────────────────────────────────────────────────
interface StageConfig {
  minDays: number;
  maxDays: number | null;
  stage: string;
  sentFlag: "email_sent_7d" | "email_sent_14d" | "email_sent_30d" | "final_notice_sent";
  smsSentFlag: "sms_sent_7d" | "sms_sent_14d" | "sms_sent_30d" | "final_notice_sent";
  emailSubject: (inv: string, amount: string) => string;
  emailHeadline: string;
  badgeLabel: string;
  badgeColor: string;
  urgencyNote: string;
  smsBody: (firstName: string, inv: string, amount: string, url: string) => string;
  isFinalNotice: boolean;
}

const STAGES: StageConfig[] = [
  {
    minDays: 7,
    maxDays: 13,
    stage: "7d_reminder",
    sentFlag: "email_sent_7d",
    smsSentFlag: "sms_sent_7d",
    emailSubject: (inv, amount) => `Friendly Reminder: Invoice ${inv} — ${amount} past due`,
    emailHeadline: "Invoice Payment Reminder",
    badgeLabel: "7-Day Reminder",
    badgeColor: "#D97706",
    urgencyNote: "This is a friendly reminder that your invoice is now 7 days past due. Please arrange payment at your earliest convenience.",
    smsBody: (fn, inv, amt, url) =>
      `Broussard Legal Services\n\nHi ${fn}, friendly reminder: Invoice #${inv} for ${amt} is 7 days past due. Pay now: ${url}\n\nReply STOP to opt out.`,
    isFinalNotice: false,
  },
  {
    minDays: 14,
    maxDays: 29,
    stage: "14d_reminder",
    sentFlag: "email_sent_14d",
    smsSentFlag: "sms_sent_14d",
    emailSubject: (inv, amount) => `OVERDUE: Invoice ${inv} — ${amount} now 14 days past due`,
    emailHeadline: "Invoice Overdue — Action Required",
    badgeLabel: "14-Day Notice",
    badgeColor: "#C2410C",
    urgencyNote: "Your invoice is now 14 days overdue. Please remit payment immediately to avoid service interruption.",
    smsBody: (fn, inv, amt, url) =>
      `Broussard Legal Services\n\nHi ${fn}, Invoice #${inv} for ${amt} is now 14 DAYS OVERDUE. Immediate payment required to avoid service interruption: ${url}\n\nReply STOP to opt out.`,
    isFinalNotice: false,
  },
  {
    minDays: 30,
    maxDays: 36,
    stage: "30d_reminder",
    sentFlag: "email_sent_30d",
    smsSentFlag: "sms_sent_30d",
    emailSubject: (inv, amount) => `URGENT: Invoice ${inv} — ${amount} 30 days overdue`,
    emailHeadline: "Invoice 30 Days Overdue — Urgent Action Required",
    badgeLabel: "30-Day Warning",
    badgeColor: "#DC2626",
    urgencyNote: "Your invoice is now 30 days overdue. This is a formal notice — failure to pay may result in suspension of your client portal access and escalation to collections.",
    smsBody: (fn, inv, amt, url) =>
      `Broussard Legal Services\n\nURGENT: Hi ${fn}, Invoice #${inv} for ${amt} is 30 DAYS OVERDUE. Pay now to avoid portal suspension: ${url}\n\nReply STOP to opt out.`,
    isFinalNotice: false,
  },
  {
    minDays: 37,
    maxDays: 44,
    stage: "final_notice",
    sentFlag: "final_notice_sent",
    smsSentFlag: "final_notice_sent",
    emailSubject: (inv, amount) => `FINAL NOTICE: Invoice ${inv} — ${amount} — Immediate Payment Required`,
    emailHeadline: "Final Notice — Immediate Payment Required",
    badgeLabel: "Final Notice",
    badgeColor: "#7F1D1D",
    urgencyNote: "This is your FINAL NOTICE. Your invoice remains unpaid. Your client portal access will be suspended within 7 days if payment is not received. Please contact us immediately if you need to discuss payment arrangements.",
    smsBody: (fn, inv, amt, url) =>
      `Broussard Legal Services\n\nFINAL NOTICE: Hi ${fn}, Invoice #${inv} for ${amt} is critically overdue. Portal access will be suspended in 7 days. Pay now: ${url}\n\nReply STOP to opt out.`,
    isFinalNotice: true,
  },
];

// ─── Email Builder ────────────────────────────────────────────────────────────
function buildSequenceEmail(opts: {
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  daysOverdue: number;
  stage: StageConfig;
  paymentUrl: string;
}): { subject: string; html: string } {
  const firstName = opts.clientName.split(" ")[0];
  const isFinal = opts.stage.isFinalNotice;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Invoice Notice</title></head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#EDE8E0;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">
  <tr><td style="background-color:${brand.primary};padding:0;">
    <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 36px 24px;">
      <tr><td>
        <h1 style="margin:0;font-size:22px;color:${brand.white};font-family:Georgia,serif;font-weight:normal;">Maggi May Broussard Legal Services</h1>
        <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;">Louisiana &amp; Nationwide</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:36px 36px 32px;">
    <span style="display:inline-block;background-color:${opts.stage.badgeColor};color:#fff;font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;">${opts.stage.badgeLabel}</span>
    <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">${opts.stage.emailHeadline}</h2>
    <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Dear ${firstName},</p>
    <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">${opts.stage.urgencyNote}</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;background-color:#fff;border:1px solid ${brand.border};border-radius:8px;overflow:hidden;">
      <tbody>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;width:42%;border-bottom:1px solid rgba(217,208,197,0.5);">Invoice Number</td><td style="padding:10px 16px;color:${brand.foreground};font-size:14px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.invoiceNumber}</td></tr>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Amount Due</td><td style="padding:10px 16px;color:${isFinal ? brand.red : brand.orange};font-size:14px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.amount}</td></tr>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;border-bottom:1px solid rgba(217,208,197,0.5);">Original Due Date</td><td style="padding:10px 16px;color:${brand.foreground};font-size:14px;font-weight:bold;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.dueDate}</td></tr>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;">Days Overdue</td><td style="padding:10px 16px;color:${brand.red};font-size:14px;font-weight:bold;">${opts.daysOverdue} days</td></tr>
      </tbody>
    </table>
    ${isFinal ? `<div style="background-color:${brand.redLight};border-left:4px solid ${brand.red};padding:18px 22px;border-radius:0 8px 8px 0;margin:22px 0;"><p style="margin:0 0 6px;font-size:13px;color:${brand.red};font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;">⚠ Final Notice — Portal Suspension Pending</p><p style="margin:0;font-size:13px;color:${brand.foreground};line-height:1.6;">Your client portal access will be suspended within 7 days if payment is not received. Please pay immediately or contact us to arrange a payment plan.</p></div>` : ""}
    <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
      <tr><td style="background-color:${isFinal ? brand.red : brand.accent};border-radius:7px;">
        <a href="${opts.paymentUrl}" style="display:inline-block;padding:14px 36px;color:#fff;text-decoration:none;font-size:14px;font-family:Georgia,serif;font-weight:bold;">Pay ${opts.amount} Now &rarr;</a>
      </td></tr>
    </table>
    <p style="margin:0 0 8px;font-size:12px;color:${brand.muted};">Or copy: <a href="${opts.paymentUrl}" style="color:${brand.accent};word-break:break-all;">${opts.paymentUrl}</a></p>
    <p style="margin:24px 0 0;font-size:15px;color:${brand.foreground};line-height:1.8;">Warm regards,<br><strong>Maggi May Broussard</strong><br><span style="font-size:12px;color:${brand.muted};">Licensed Paralegal · Louisiana &amp; Nationwide</span></p>
    <p style="margin:8px 0 0;font-size:11px;color:${brand.muted};border-top:1px solid ${brand.border};padding-top:16px;margin-top:20px;">This is an automated billing notice. Questions? <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};">Contact us directly</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject: opts.stage.emailSubject(opts.invoiceNumber, opts.amount), html };
}

// ─── Twilio SMS ───────────────────────────────────────────────────────────────
async function sendSMS(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!accountSid || !authToken || !fromNumber) return { success: false, error: "Twilio not configured" };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }).toString(),
    });
    const data = await res.json();
    return res.ok ? { success: true, sid: data.sid } : { success: false, error: data?.message ?? "Twilio error" };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "SMS error" };
  }
}

// ─── Resend Email ─────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string, resendKey: string): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Maggi May Broussard Legal Services <billing@broussardlegalservices.com>", to: [to], subject, html }),
    });
    const data = await res.json();
    return res.ok ? { success: true, id: data.id } : { success: false, error: data?.message ?? "Email error" };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "Email error" };
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";

  const supabase = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({}));
  const sendEmails = body.send_emails !== false;
  const sendSmsEnabled = body.send_sms !== false;
  const dryRun = body.dry_run === true;

  const results: Array<{
    invoiceId: string;
    clientName: string;
    daysOverdue: number;
    stage: string;
    emailSent: boolean;
    smsSent: boolean;
    portalSuspended: boolean;
    error?: string;
  }> = [];

  let emailsSent = 0;
  let smsSent = 0;
  let portalSuspensions = 0;
  let sequencesProcessed = 0;

  try {
    // Fetch all overdue invoices (7+ days past due, not resolved)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: overdueInvoices, error: fetchErr } = await supabase
      .from("client_invoices")
      .select(`
        id, invoice_number, due_date, amount, amount_paid, status, inquiry_id,
        payment_token,
        contact_inquiries ( name, email, phone, service )
      `)
      .in("status", ["pending", "overdue"])
      .lte("due_date", sevenDaysAgo.toISOString().split("T")[0])
      .order("due_date", { ascending: true });

    if (fetchErr) throw fetchErr;

    for (const inv of overdueInvoices ?? []) {
      const client = (inv as any).contact_inquiries;
      const clientName = client?.name ?? "Client";
      const clientEmail = client?.email ?? null;
      const clientPhone = client?.phone ?? null;
      const dueDate = new Date(inv.due_date);
      const today = new Date();
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const amountDue = Number(inv.amount) - Number(inv.amount_paid ?? 0);
      if (amountDue <= 0) continue;

      const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountDue);
      const formattedDueDate = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const paymentUrl = inv.payment_token ? `${SITE_URL}/pay/${inv.payment_token}` : PORTAL_URL;
      const firstName = clientName.split(" ")[0];

      // Upsert sequence record
      const { data: existingSeq } = await supabase
        .from("overdue_invoice_sequences")
        .select("*")
        .eq("invoice_id", inv.id)
        .eq("resolved", false)
        .maybeSingle();

      let seqId: string | null = existingSeq?.id ?? null;

      if (!existingSeq) {
        const { data: newSeq } = await supabase
          .from("overdue_invoice_sequences")
          .insert({
            invoice_id: inv.id,
            inquiry_id: inv.inquiry_id,
            client_name: clientName,
            client_email: clientEmail,
            client_phone: clientPhone,
            invoice_number: inv.invoice_number,
            amount_due: amountDue,
            due_date: inv.due_date,
            days_overdue: daysOverdue,
            tier: daysOverdue >= 37 ? 4 : daysOverdue >= 30 ? 3 : daysOverdue >= 14 ? 2 : 1,
            sequence_stage: "active",
          })
          .select("id")
          .single();
        seqId = newSeq?.id ?? null;
      } else {
        // Update days_overdue and tier
        await supabase
          .from("overdue_invoice_sequences")
          .update({
            days_overdue: daysOverdue,
            tier: daysOverdue >= 37 ? 4 : daysOverdue >= 30 ? 3 : daysOverdue >= 14 ? 2 : 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSeq.id);
      }

      const seq = existingSeq ?? { email_sent_7d: false, email_sent_14d: false, email_sent_30d: false, final_notice_sent: false, portal_suspended: false, sms_sent_7d: false, sms_sent_14d: false, sms_sent_30d: false };

      // Mark invoice as overdue
      if (inv.status === "pending") {
        await supabase.from("client_invoices").update({ status: "overdue" }).eq("id", inv.id);
      }

      // ── Portal Suspension (45+ days) ──────────────────────────────────────
      if (daysOverdue >= 45 && !seq.portal_suspended) {
        if (!dryRun && seqId) {
          await supabase
            .from("overdue_invoice_sequences")
            .update({ portal_suspended: true, portal_suspended_at: new Date().toISOString(), sequence_stage: "suspended", last_action_at: new Date().toISOString() })
            .eq("id", seqId);

          // Suspend client portal access
          if (inv.inquiry_id) {
            await supabase
              .from("client_portal_access")
              .update({ is_active: false, suspended_reason: "overdue_invoice", suspended_at: new Date().toISOString() })
              .eq("inquiry_id", inv.inquiry_id);
          }
        }
        portalSuspensions++;
        results.push({ invoiceId: inv.id, clientName, daysOverdue, stage: "portal_suspended", emailSent: false, smsSent: false, portalSuspended: true });
        sequencesProcessed++;
        continue;
      }

      // ── Determine which stage to process ─────────────────────────────────
      const stageToProcess = STAGES.find((s) => {
        if (daysOverdue < s.minDays) return false;
        if (s.maxDays !== null && daysOverdue > s.maxDays) return false;
        return !seq[s.sentFlag as keyof typeof seq];
      });

      if (!stageToProcess) {
        sequencesProcessed++;
        continue; // Already processed this stage
      }

      let emailSentOk = false;
      let smsSentOk = false;
      let stageError: string | undefined;

      if (sendEmails && clientEmail) {
        const { subject, html } = buildSequenceEmail({
          clientName,
          invoiceNumber: inv.invoice_number ?? "N/A",
          amount: formattedAmount,
          dueDate: formattedDueDate,
          daysOverdue,
          stage: stageToProcess,
          paymentUrl,
        });

        if (!dryRun) {
          const emailResult = await sendEmail(clientEmail, subject, html, resendKey);
          emailSentOk = emailResult.success;
          if (!emailResult.success) stageError = emailResult.error;
        } else {
          emailSentOk = true; // dry run
        }
        if (emailSentOk) emailsSent++;
      }

      if (sendSmsEnabled && clientPhone) {
        const smsBody = stageToProcess.smsBody(firstName, inv.invoice_number ?? "N/A", formattedAmount, paymentUrl);
        if (!dryRun) {
          const smsResult = await sendSMS(clientPhone, smsBody);
          smsSentOk = smsResult.success;
        } else {
          smsSentOk = true;
        }
        if (smsSentOk) smsSent++;
      }

      // Update sequence record
      if (!dryRun && seqId) {
        const updatePayload: Record<string, unknown> = {
          last_action_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        updatePayload[stageToProcess.sentFlag] = true;
        if (smsSentOk) updatePayload[stageToProcess.smsSentFlag] = true;
        if (stageToProcess.isFinalNotice) {
          updatePayload.sequence_stage = "final_notice";
          updatePayload.final_notice_sent_at = new Date().toISOString();
        }
        await supabase.from("overdue_invoice_sequences").update(updatePayload).eq("id", seqId);
      }

      results.push({ invoiceId: inv.id, clientName, daysOverdue, stage: stageToProcess.stage, emailSent: emailSentOk, smsSent: smsSentOk, portalSuspended: false, error: stageError });
      sequencesProcessed++;
    }

    return new Response(
      JSON.stringify({ success: true, sequencesProcessed, emailsSent, smsSent, portalSuspensions, dryRun, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
