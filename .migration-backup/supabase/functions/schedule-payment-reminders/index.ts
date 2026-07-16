import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

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
  const results: { type: string; target: string; status: string; error?: string }[] = [];

  // ─── Helper: record sequence row using raw SQL to avoid enum cast issues ────
  async function recordSequence(inquiryId: string): Promise<string | null> {
    try {
      // Use raw SQL via rpc to insert with text cast — avoids enum not-yet-committed issue
      const { data, error } = await supabase.rpc("insert_payment_reminder_sequence", {
        p_inquiry_id: inquiryId,
        p_scheduled_at: now.toISOString(),
      });
      if (error) {
        // Fallback: try direct insert (works once enum value is committed)
        const { data: seqRow, error: insertErr } = await supabase
          .from("email_sequences")
          .insert({
            inquiry_id: inquiryId,
            sequence_type: "payment_reminder",
            step_number: 1,
            scheduled_at: now.toISOString(),
            send_status: "pending",
          })
          .select("id")
          .single();
        if (insertErr) {
          console.error("Sequence insert fallback failed:", insertErr.message);
          return null;
        }
        return seqRow?.id ?? null;
      }
      return data as string | null;
    } catch (err) {
      console.error("recordSequence error:", err);
      return null;
    }
  }

  // ─── Helper: check if reminder already sent today ────────────────────────────
  async function alreadySentToday(inquiryId: string): Promise<boolean> {
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    try {
      const { data } = await supabase
        .from("email_sequences")
        .select("id")
        .eq("inquiry_id", inquiryId)
        .eq("sequence_type", "payment_reminder")
        .gte("created_at", todayStart.toISOString())
        .limit(1);
      return (data?.length ?? 0) > 0;
    } catch {
      return false;
    }
  }

  // ─── Helper: send email via Resend directly ───────────────────────────────────
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

  // ─── Brand styles ─────────────────────────────────────────────────────────────
  const brand = {
    bg: "#FAF7F2", primary: "#4A3728", accent: "#C8965A", foreground: "#2C1F14",
    muted: "#7A6B5D", border: "#D9D0C5", secondary: "#EDE8E0", white: "#FFFFFF",
    red: "#B91C1C", redLight: "#FEF2F2", orange: "#C2410C", orangeLight: "#FFF7ED",
  };

  const PORTAL_URL = "https://broussardlegalservices.com/portal/invoices";

  function emailWrapper(content: string, preheader = ""): string {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Maggi May Broussard</title>${preheader ? `<div style="display:none;font-size:1px;max-height:0;overflow:hidden;">${preheader}</div>` : ""}</head><body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#EDE8E0;padding:40px 16px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};"><tr><td style="background-color:${brand.primary};padding:0;"><div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div><table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 36px 24px;"><tr><td><h1 style="margin:0;font-size:24px;color:${brand.white};font-family:Georgia,serif;font-weight:normal;">Maggi May Broussard</h1><p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.65);font-family:Georgia,serif;">Licensed Paralegal · Louisiana &amp; Nationwide</p></td></tr></table></td></tr><tr><td style="padding:36px 36px 32px;">${content}</td></tr><tr><td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};"><p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">This is an automated billing reminder. Questions? <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};text-decoration:none;">Contact us</a> &nbsp;·&nbsp; <a href="${PORTAL_URL}" style="color:${brand.accent};text-decoration:none;">View portal</a></p></td></tr></table></td></tr></table></body></html>`;
  }

  function buildUpcomingEmail(opts: { clientName: string; invoiceNumber: string; amount: string; dueDate: string; service: string }): { subject: string; html: string } {
    const firstName = opts.clientName.split(" ")[0];
    const content = `
      <span style="display:inline-block;background-color:${brand.accent};color:#fff;font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;">Payment Reminder</span>
      <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Invoice ${opts.invoiceNumber} — Payment Due Soon</h2>
      <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Hi ${firstName}, your invoice for <strong>${opts.service}</strong> is due in <strong>3 days</strong>. Please complete payment at your earliest convenience.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;background-color:#fff;border:1px solid ${brand.border};border-radius:8px;overflow:hidden;"><tbody>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;width:42%;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">Invoice Number</td><td style="padding:10px 16px;color:${brand.foreground};font-size:14px;font-weight:bold;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.invoiceNumber}</td></tr>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">Service</td><td style="padding:10px 16px;color:${brand.foreground};font-size:14px;font-weight:bold;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.service}</td></tr>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">Amount Due</td><td style="padding:10px 16px;color:${brand.accent};font-size:14px;font-weight:bold;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.amount}</td></tr>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;font-family:Georgia,serif;">Due Date</td><td style="padding:10px 16px;color:${brand.orange};font-size:14px;font-weight:bold;font-family:Georgia,serif;">${opts.dueDate}</td></tr>
      </tbody></table>
      <div style="background-color:${brand.orangeLight};border-left:4px solid ${brand.orange};padding:18px 22px;border-radius:0 8px 8px 0;margin:22px 0;">
        <p style="margin:0 0 6px;font-size:13px;color:${brand.orange};font-weight:bold;font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">⚠ Payment Due in 3 Days</p>
        <p style="margin:0;font-size:13px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;">Please complete payment before <strong>${opts.dueDate}</strong> to avoid any disruption to your services.</p>
      </div>
      <table cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td style="background-color:${brand.accent};border-radius:7px;"><a href="${PORTAL_URL}" style="display:inline-block;padding:14px 36px;color:#fff;text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Pay Now — Secure Portal &rarr;</a></td></tr></table>
      <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">If you have questions about this invoice, please don't hesitate to reach out directly.</p>
      <table cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;"><tr><td><p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p><p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p><p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;">Licensed Paralegal · Louisiana &amp; Nationwide</p></td></tr></table>
    `;
    return {
      subject: `Invoice ${opts.invoiceNumber} — Payment due ${opts.dueDate}`,
      html: emailWrapper(content, `Your invoice for ${opts.service} is due in 3 days — ${opts.amount} due ${opts.dueDate}.`),
    };
  }

  function buildOverdueEmail(opts: { clientName: string; invoiceNumber: string; amount: string; dueDate: string; service: string; daysOverdue: number }): { subject: string; html: string } {
    const firstName = opts.clientName.split(" ")[0];
    const content = `
      <span style="display:inline-block;background-color:${brand.red};color:#fff;font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;">Overdue Notice</span>
      <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Invoice ${opts.invoiceNumber} — Payment Overdue</h2>
      <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Hi ${firstName}, your invoice for <strong>${opts.service}</strong> was due on <strong>${opts.dueDate}</strong> and remains unpaid. Please arrange payment as soon as possible.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;background-color:#fff;border:1px solid ${brand.border};border-radius:8px;overflow:hidden;"><tbody>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;width:42%;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">Invoice Number</td><td style="padding:10px 16px;color:${brand.foreground};font-size:14px;font-weight:bold;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.invoiceNumber}</td></tr>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">Amount Due</td><td style="padding:10px 16px;color:${brand.red};font-size:14px;font-weight:bold;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.amount}</td></tr>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">Original Due Date</td><td style="padding:10px 16px;color:${brand.foreground};font-size:14px;font-weight:bold;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.dueDate}</td></tr>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;font-family:Georgia,serif;">Days Overdue</td><td style="padding:10px 16px;color:${brand.red};font-size:14px;font-weight:bold;font-family:Georgia,serif;">${opts.daysOverdue} day${opts.daysOverdue !== 1 ? "s" : ""}</td></tr>
      </tbody></table>
      <div style="background-color:${brand.redLight};border-left:4px solid ${brand.red};padding:18px 22px;border-radius:0 8px 8px 0;margin:22px 0;">
        <p style="margin:0 0 6px;font-size:13px;color:${brand.red};font-weight:bold;font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">⚠ Immediate Action Required</p>
        <p style="margin:0;font-size:13px;color:${brand.foreground};font-family:Georgia,serif;line-height:1.6;">This invoice is now <strong>${opts.daysOverdue} day${opts.daysOverdue !== 1 ? "s" : ""} overdue</strong>. Please log in to your client portal to complete payment immediately.</p>
      </div>
      <table cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td style="background-color:${brand.red};border-radius:7px;"><a href="${PORTAL_URL}" style="display:inline-block;padding:14px 36px;color:#fff;text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Pay Overdue Invoice Now &rarr;</a></td></tr></table>
      <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">If you believe this notice was sent in error or have already submitted payment, please reply to this email and we will confirm receipt promptly.</p>
      <table cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;"><tr><td><p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p><p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p></td></tr></table>
    `;
    return {
      subject: `OVERDUE: Invoice ${opts.invoiceNumber} — ${opts.amount} past due`,
      html: emailWrapper(content, `Invoice ${opts.invoiceNumber} for ${opts.service} is ${opts.daysOverdue} days overdue — ${opts.amount} outstanding.`),
    };
  }

  function buildRetainerEmail(opts: { clientName: string; service: string; retainerAmount: string; deadlineDate: string; depositPaid: boolean; depositAmount?: string }): { subject: string; html: string } {
    const firstName = opts.clientName.split(" ")[0];
    const content = `
      <span style="display:inline-block;background-color:${brand.primary};color:#fff;font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;">Retainer Reminder</span>
      <h2 style="margin:0 0 20px;font-size:21px;color:${brand.foreground};font-family:Georgia,serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">Retainer Agreement — Action Required</h2>
      <p style="margin:0 0 16px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">Hi ${firstName}, your consultation for <strong>${opts.service}</strong> is scheduled for <strong>${opts.deadlineDate}</strong>. To proceed, your retainer agreement must be signed and payment completed before that date.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;background-color:#fff;border:1px solid ${brand.border};border-radius:8px;overflow:hidden;"><tbody>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;width:42%;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">Service</td><td style="padding:10px 16px;color:${brand.foreground};font-size:14px;font-weight:bold;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.service}</td></tr>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">Retainer Amount</td><td style="padding:10px 16px;color:${brand.accent};font-size:14px;font-weight:bold;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.retainerAmount}</td></tr>
        <tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">Consultation Date</td><td style="padding:10px 16px;color:${brand.orange};font-size:14px;font-weight:bold;font-family:Georgia,serif;border-bottom:1px solid rgba(217,208,197,0.5);">${opts.deadlineDate}</td></tr>
        ${opts.depositPaid ? `<tr><td style="padding:10px 16px;color:${brand.muted};font-size:13px;font-family:Georgia,serif;">Deposit Paid</td><td style="padding:10px 16px;color:#355E3B;font-size:14px;font-weight:bold;font-family:Georgia,serif;">${opts.depositAmount ?? "Yes"} ✓</td></tr>` : ""}
      </tbody></table>
      <table cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td style="background-color:${brand.accent};border-radius:7px;"><a href="${PORTAL_URL}" style="display:inline-block;padding:14px 36px;color:#fff;text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">Complete Retainer Agreement &rarr;</a></td></tr></table>
      <table cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;"><tr><td><p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p><p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p></td></tr></table>
    `;
    return {
      subject: `Action Required: Retainer Agreement for ${opts.service} — Due ${opts.deadlineDate}`,
      html: emailWrapper(content, `Your retainer agreement for ${opts.service} must be completed before ${opts.deadlineDate}.`),
    };
  }

  // ─── 1. Upcoming invoice reminders (due in 1–3 days, still pending) ──────────
  try {
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    const { data: upcomingInvoices, error: upcomingErr } = await supabase
      .from("client_invoices")
      .select(`id, invoice_number, amount, due_date, status, inquiry_id, contact_inquiries ( name, email, service )`)
      .eq("status", "pending")
      .gte("due_date", tomorrow.toISOString().split("T")[0])
      .lte("due_date", in3Days.toISOString().split("T")[0]);

    if (upcomingErr) throw upcomingErr;

    for (const inv of upcomingInvoices ?? []) {
      const inquiry = (inv as any).contact_inquiries;
      if (!inquiry?.email || !inquiry?.name) continue;

      const isDuplicate = inv.inquiry_id ? await alreadySentToday(inv.inquiry_id) : false;
      if (isDuplicate) {
        results.push({ type: "invoice_upcoming", target: inquiry.email, status: "skipped_duplicate" });
        continue;
      }

      try {
        const dueDate = new Date(inv.due_date + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const { subject, html } = buildUpcomingEmail({
          clientName: inquiry.name,
          invoiceNumber: inv.invoice_number,
          amount: `$${parseFloat(String(inv.amount)).toFixed(2)}`,
          dueDate,
          service: inquiry.service,
        });
        await sendEmail(inquiry.email, subject, html);
        if (inv.inquiry_id) await recordSequence(inv.inquiry_id);
        results.push({ type: "invoice_upcoming", target: inquiry.email, status: "sent" });
      } catch (err: any) {
        results.push({ type: "invoice_upcoming", target: inquiry.email, status: "failed", error: err.message });
      }
    }
  } catch (err: any) {
    results.push({ type: "invoice_upcoming", target: "batch", status: "failed", error: err.message });
  }

  // ─── 2. Overdue invoice reminders ─────────────────────────────────────────────
  try {
    const { data: overdueInvoices, error: overdueErr } = await supabase
      .from("client_invoices")
      .select(`id, invoice_number, amount, due_date, status, inquiry_id, contact_inquiries ( name, email, service )`)
      .in("status", ["pending", "overdue"])
      .lt("due_date", now.toISOString().split("T")[0]);

    if (overdueErr) throw overdueErr;

    for (const inv of overdueInvoices ?? []) {
      const inquiry = (inv as any).contact_inquiries;
      if (!inquiry?.email || !inquiry?.name) continue;

      const isDuplicate = inv.inquiry_id ? await alreadySentToday(inv.inquiry_id) : false;
      if (isDuplicate) {
        results.push({ type: "invoice_overdue", target: inquiry.email, status: "skipped_duplicate" });
        continue;
      }

      if (inv.status === "pending") {
        await supabase.from("client_invoices").update({ status: "overdue" }).eq("id", inv.id);
      }

      try {
        const dueDate = new Date(inv.due_date + "T12:00:00Z");
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const dueDateStr = dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const { subject, html } = buildOverdueEmail({
          clientName: inquiry.name,
          invoiceNumber: inv.invoice_number,
          amount: `$${parseFloat(String(inv.amount)).toFixed(2)}`,
          dueDate: dueDateStr,
          service: inquiry.service,
          daysOverdue,
        });
        await sendEmail(inquiry.email, subject, html);
        if (inv.inquiry_id) await recordSequence(inv.inquiry_id);
        results.push({ type: "invoice_overdue", target: inquiry.email, status: "sent" });
      } catch (err: any) {
        results.push({ type: "invoice_overdue", target: inquiry.email, status: "failed", error: err.message });
      }
    }
  } catch (err: any) {
    results.push({ type: "invoice_overdue", target: "batch", status: "failed", error: err.message });
  }

  // ─── 3. Retainer deadline reminders ───────────────────────────────────────────
  try {
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { data: retainerCandidates, error: retainerErr } = await supabase
      .from("contact_inquiries")
      .select(`id, name, email, service, booking_stage, calendly_start_time, payments ( id, payment_type, payment_status, amount )`)
      .eq("booking_stage", "consultation_booked")
      .not("calendly_start_time", "is", null)
      .gte("calendly_start_time", now.toISOString())
      .lte("calendly_start_time", in7Days.toISOString());

    if (retainerErr) throw retainerErr;

    for (const inquiry of retainerCandidates ?? []) {
      const payments = (inquiry as any).payments ?? [];
      const hasRetainerPayment = payments.some(
        (p: any) => p.payment_type === "retainer_agreement" && p.payment_status === "succeeded"
      );
      if (hasRetainerPayment) continue;

      const isDuplicate = await alreadySentToday(inquiry.id);
      if (isDuplicate) {
        results.push({ type: "retainer_deadline", target: inquiry.email, status: "skipped_duplicate" });
        continue;
      }

      try {
        const depositPayment = payments.find(
          (p: any) => p.payment_type === "consultation_deposit" && p.payment_status === "succeeded"
        );
        const deadlineDate = new Date(inquiry.calendly_start_time);
        const deadlineDateStr = deadlineDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        const { subject, html } = buildRetainerEmail({
          clientName: inquiry.name,
          service: inquiry.service,
          retainerAmount: "$1,500.00",
          deadlineDate: deadlineDateStr,
          depositPaid: !!depositPayment,
          depositAmount: depositPayment ? `$${parseFloat(String(depositPayment.amount)).toFixed(2)}` : undefined,
        });
        await sendEmail(inquiry.email, subject, html);
        await recordSequence(inquiry.id);
        results.push({ type: "retainer_deadline", target: inquiry.email, status: "sent" });
      } catch (err: any) {
        results.push({ type: "retainer_deadline", target: inquiry.email, status: "failed", error: err.message });
      }
    }
  } catch (err: any) {
    results.push({ type: "retainer_deadline", target: "batch", status: "failed", error: err.message });
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped_duplicate").length;

  return new Response(
    JSON.stringify({ success: true, processed: results.length, sent, failed, skipped, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
