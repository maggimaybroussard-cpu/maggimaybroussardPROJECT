import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://broussardlegalservices.com";

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
  green: "#355E3B",
  greenLight: "#EAF2EB",
  red: "#B91C1C",
  redLight: "#FEF2F2",
  blue: "#1D4ED8",
  blueLight: "#EFF6FF",
  amber: "#B45309",
  amberLight: "#FFFBEB",
};

// ─── Shared Layout ────────────────────────────────────────────────────────────

function emailWrapper(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maggi May Broussard Legal Services</title>
  ${preheader ? `<div style="display:none;font-size:1px;color:#fefefe;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
</head>
<body style="margin:0;padding:0;background-color:#EDE8E0;font-family:Georgia,'Times New Roman',serif;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#EDE8E0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background-color:${brand.bg};border-radius:14px;overflow:hidden;border:1px solid ${brand.border};box-shadow:0 4px 24px rgba(74,55,40,0.10);">

        <!-- HEADER -->
        <tr>
          <td style="background-color:${brand.primary};padding:0;">
            <div style="height:4px;background:linear-gradient(to right,${brand.accent},#E8B87A,${brand.accent});"></div>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:28px 36px 24px;">
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
            <div style="height:1px;background:linear-gradient(to right,${brand.accent},rgba(200,150,90,0.2),transparent);margin:0 36px;"></div>
            <div style="height:20px;"></div>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:36px 36px 32px;">
            ${content}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color:${brand.secondary};padding:20px 36px;border-top:1px solid ${brand.border};">
            <p style="margin:0 0 6px;font-size:12px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;letter-spacing:0.04em;">Maggi May Broussard Legal Services</p>
            <p style="margin:0;font-size:11px;color:${brand.muted};line-height:1.7;">
              You are receiving this because you have an active case with Maggi May Broussard Legal Services.
              &nbsp;·&nbsp;
              <a href="${SITE_URL}/portal/login" style="color:${brand.accent};text-decoration:none;">Access your portal</a>
              &nbsp;·&nbsp;
              <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};text-decoration:none;">Contact us</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function sig(): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;border-top:1px solid ${brand.border};padding-top:20px;width:100%;">
      <tr>
        <td>
          <p style="margin:0 0 4px;font-size:15px;color:${brand.foreground};font-family:Georgia,serif;">Warm regards,</p>
          <p style="margin:0 0 2px;font-size:16px;color:${brand.primary};font-weight:bold;font-family:Georgia,serif;">Maggi May Broussard</p>
          <p style="margin:0 0 6px;font-size:12px;color:${brand.muted};font-family:Georgia,serif;letter-spacing:0.04em;">Licensed Paralegal · Louisiana &amp; Nationwide</p>
          <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">maggimaybroussard@gmail.com</a>
          &nbsp;<span style="color:${brand.border};">|</span>&nbsp;
          <a href="${SITE_URL}" style="color:${brand.accent};font-size:13px;text-decoration:none;font-family:Georgia,serif;">broussardlegalservices.com</a>
        </td>
      </tr>
    </table>`;
}

function ctaButton(href: string, label: string, color = brand.accent): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;">
      <tr>
        <td style="background-color:${color};border-radius:7px;box-shadow:0 2px 8px rgba(200,150,90,0.25);">
          <a href="${href}" style="display:inline-block;padding:14px 36px;color:${brand.white};text-decoration:none;font-size:14px;font-family:Georgia,serif;letter-spacing:0.05em;font-weight:bold;">${label} &rarr;</a>
        </td>
      </tr>
    </table>`;
}

function detailRow(label: string, value: string, last = false): string {
  const border = last ? "" : `border-bottom:1px solid rgba(217,208,197,0.5);`;
  return `
    <tr>
      <td style="padding:8px 0;color:${brand.muted};font-size:13px;width:40%;${border}">${label}</td>
      <td style="padding:8px 0;color:${brand.foreground};font-size:14px;font-weight:bold;${border}">${value}</td>
    </tr>`;
}

// ─── Email Builders ───────────────────────────────────────────────────────────

function buildDeliverableApprovedEmail(d: {
  clientName: string;
  fileName: string;
  deliverableType: string;
  caseName: string;
  statusNotes: string | null;
  approvedDate: string;
}): { subject: string; html: string } {
  const firstName = d.clientName.split(" ")[0] || d.clientName;
  let subject = `✅ Deliverable Approved — ${d.fileName}`;
  const typeLabel = d.deliverableType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const content = `
    <span style="display:inline-block;background-color:${brand.green};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#10003; Deliverable Approved</span>

    <h2 style="margin:0 0 16px;font-size:22px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">
      Your deliverable has been approved, ${firstName}
    </h2>

    <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
      We are pleased to inform you that the following deliverable for your case has been reviewed and approved. You may now access it through your client portal.
    </p>

    <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
      <div style="background-color:${brand.primary};padding:12px 22px;">
        <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128196; Deliverable Details</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
          ${detailRow("Document", d.fileName)}
          ${detailRow("Type", typeLabel)}
          ${detailRow("Case", d.caseName)}
          ${detailRow("Approved On", d.approvedDate, !d.statusNotes)}
          ${d.statusNotes ? detailRow("Notes", d.statusNotes, true) : ""}
        </table>
      </div>
    </div>

    <div style="background-color:${brand.greenLight};border-left:3px solid ${brand.green};padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:${brand.green};line-height:1.7;font-family:Georgia,serif;">
        This deliverable is now available in your client portal. Please log in to review, download, or sign the document as needed.
      </p>
    </div>

    ${ctaButton(`${SITE_URL}/portal/documents`, "View in Portal", brand.green)}
    ${sig()}`;

  return { subject, html: emailWrapper(content, `Your deliverable "${d.fileName}" has been approved and is ready to view.`) };
}

function buildCaseStageChangedEmail(d: {
  clientName: string;
  caseName: string;
  caseId: string;
  service: string;
  previousStage: string;
  newStage: string;
  stageLabel: string;
  message: string | null;
}): { subject: string; html: string } {
  const firstName = d.clientName.split(" ")[0] || d.clientName;
  let subject = `Case Update — ${d.caseName} is now ${d.stageLabel}`;

  const STAGE_DESCRIPTIONS: Record<string, string> = {
    inquiry: "We have received your inquiry and will be in touch shortly.",
    consultation_booked: "Your consultation has been scheduled. We look forward to speaking with you.",
    proposal_sent: "We have sent a proposal for your review. Please check your portal for details.",
    active_client: "Your case is now active. Our team is working on your matter.",
    completed: "Your case has been successfully completed. Thank you for trusting us with your legal needs.",
  };

  const stageDesc = STAGE_DESCRIPTIONS[d.newStage] ?? "Your case status has been updated.";

  const STAGE_COLORS: Record<string, { badge: string; text: string }> = {
    inquiry:             { badge: brand.blue,  text: brand.white },
    consultation_booked: { badge: "#6D28D9",   text: brand.white },
    proposal_sent:       { badge: brand.amber, text: brand.white },
    active_client:       { badge: brand.green, text: brand.white },
    completed:           { badge: brand.primary, text: brand.white },
  };
  const colors = STAGE_COLORS[d.newStage] ?? { badge: brand.accent, text: brand.white };

  const content = `
    <span style="display:inline-block;background-color:${colors.badge};color:${colors.text};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#8635; Stage Updated</span>

    <h2 style="margin:0 0 16px;font-size:22px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">
      Case update for ${firstName}
    </h2>

    <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
      ${stageDesc}
    </p>

    <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
      <div style="background-color:${brand.primary};padding:12px 22px;">
        <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128203; Case Status</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
          ${detailRow("Case", d.caseName)}
          ${detailRow("Service", d.service)}
          ${detailRow("Reference", `#${d.caseId.slice(0, 8).toUpperCase()}`)}
          ${detailRow("New Stage", `<span style="display:inline-block;background-color:${colors.badge};color:${colors.text};font-size:11px;font-weight:bold;padding:2px 10px;border-radius:10px;">${d.stageLabel}</span>`, !d.message)}
          ${d.message ? detailRow("Message", d.message, true) : ""}
        </table>
      </div>
    </div>

    ${ctaButton(`${SITE_URL}/portal/case-status`, "View Case Status", brand.accent)}
    ${sig()}`;

  return { subject, html: emailWrapper(content, `Your case "${d.caseName}" has moved to the ${d.stageLabel} stage.`) };
}

function buildInvoiceIssuedEmail(d: {
  clientName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  caseName: string | null;
  notes: string | null;
  paymentLink: string | null;
}): { subject: string; html: string } {
  const firstName = d.clientName.split(" ")[0] || d.clientName;
  const amountFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: d.currency?.toUpperCase() ?? "USD",
  }).format(Number(d.amount));
  let subject = `Invoice ${d.invoiceNumber} — ${amountFormatted} Due ${d.dueDate}`;

  const content = `
    <span style="display:inline-block;background-color:${brand.amber};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;font-family:Georgia,serif;">&#128196; Invoice Issued</span>

    <h2 style="margin:0 0 16px;font-size:22px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">
      Invoice ready for review, ${firstName}
    </h2>

    <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
      A new invoice has been issued for your account. Please review the details below and submit payment by the due date.
    </p>

    <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
      <div style="background-color:${brand.primary};padding:12px 22px;">
        <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128197; Invoice Details</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
          ${detailRow("Invoice #", d.invoiceNumber)}
          ${detailRow("Amount Due", `<span style="font-size:20px;color:${brand.amber};">${amountFormatted}</span>`)}
          ${detailRow("Invoice Date", d.invoiceDate)}
          ${detailRow("Due Date", `<strong>${d.dueDate}</strong>`)}
          ${d.caseName ? detailRow("Case", d.caseName) : ""}
          ${d.notes ? detailRow("Notes", d.notes, true) : ""}
        </table>
      </div>
    </div>

    <div style="background-color:${brand.amberLight};border-left:3px solid ${brand.amber};padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:${brand.amber};line-height:1.7;font-family:Georgia,serif;">
        Please ensure payment is submitted by <strong>${d.dueDate}</strong> to avoid any service interruptions.
      </p>
    </div>

    ${d.paymentLink ? ctaButton(d.paymentLink, "Pay Now", brand.amber) : ctaButton(`${SITE_URL}/portal/invoices`, "View Invoice", brand.amber)}
    ${sig()}`;

  return { subject, html: emailWrapper(content, `Invoice ${d.invoiceNumber} for ${amountFormatted} is due on ${d.dueDate}.`) };
}

function buildDeadlineApproachingEmail(d: {
  clientName: string;
  deadlineTitle: string;
  deadlineDate: string;
  daysUntil: number;
  caseName: string | null;
  description: string | null;
}): { subject: string; html: string } {
  const firstName = d.clientName.split(" ")[0] || d.clientName;
  const urgency = d.daysUntil === 1 ? "Tomorrow" : d.daysUntil <= 3 ? `In ${d.daysUntil} Days` : `In ${d.daysUntil} Days`;
  const urgencyColor = d.daysUntil === 1 ? brand.red : d.daysUntil <= 3 ? brand.amber : brand.blue;
  let subject = d.daysUntil === 1
    ? `⚠️ TOMORROW — ${d.deadlineTitle}`
    : `⏰ Deadline Reminder — ${d.deadlineTitle} (${urgency})`;

  const content = `
    <span style="display:inline-block;background-color:${urgencyColor};color:${brand.white};font-size:10px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:8px;font-family:Georgia,serif;">&#9888; Deadline Reminder</span>
    <span style="display:inline-block;background-color:${urgencyColor}22;color:${urgencyColor};font-size:10px;font-weight:bold;letter-spacing:0.10em;text-transform:uppercase;padding:4px 14px;border-radius:20px;margin-bottom:22px;margin-left:8px;font-family:Georgia,serif;">${urgency}</span>

    <h2 style="margin:0 0 16px;font-size:22px;color:${brand.foreground};font-family:Georgia,'Times New Roman',serif;font-weight:normal;border-bottom:1px solid ${brand.border};padding-bottom:14px;">
      Upcoming deadline reminder, ${firstName}
    </h2>

    <p style="margin:0 0 20px;font-size:15px;color:${brand.foreground};line-height:1.8;font-family:Georgia,serif;">
      This is a courtesy reminder that an important deadline for your case is approaching ${d.daysUntil === 1 ? "<strong>tomorrow</strong>" : `in <strong>${d.daysUntil} days</strong>`}. Please review the details and ensure any required actions are completed on time.
    </p>

    <div style="background-color:${brand.bgCard};border:1px solid ${brand.border};border-radius:10px;overflow:hidden;margin:0 0 24px;">
      <div style="background-color:${brand.primary};padding:12px 22px;">
        <p style="margin:0;font-size:11px;color:${brand.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;font-family:Georgia,serif;">&#128197; Deadline Details</p>
      </div>
      <div style="padding:20px 22px;">
        <table style="width:100%;border-collapse:collapse;font-family:Georgia,serif;">
          ${detailRow("Deadline", d.deadlineTitle)}
          ${detailRow("Due Date", `<strong style="color:${urgencyColor};">${d.deadlineDate}</strong>`)}
          ${d.caseName ? detailRow("Case", d.caseName) : ""}
          ${d.description ? detailRow("Details", d.description, true) : ""}
        </table>
      </div>
    </div>

    <div style="background-color:${urgencyColor}11;border-left:3px solid ${urgencyColor};padding:16px 20px;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:${urgencyColor};line-height:1.7;font-family:Georgia,serif;">
        If you have any questions or need to take action, please contact us or log in to your portal immediately.
      </p>
    </div>

    ${ctaButton(`${SITE_URL}/portal/case-status`, "View Case Portal", urgencyColor)}
    ${sig()}`;

  return { subject, html: emailWrapper(content, `Deadline reminder: "${d.deadlineTitle}" is due ${d.daysUntil === 1 ? "tomorrow" : `in ${d.daysUntil} days`}.`) };
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
    const { eventType, clientEmail, clientName, details, inquiryId } = body;

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    if (!clientEmail || !clientName) throw new Error("clientEmail and clientName are required");

    let subject = "";
    let html = "";

    if (eventType === "deliverable_approved") {
      const result = buildDeliverableApprovedEmail({
        clientName,
        fileName: details.fileName ?? "Document",
        deliverableType: details.deliverableType ?? "general",
        caseName: details.caseName ?? "Your Case",
        statusNotes: details.statusNotes ?? null,
        approvedDate: details.approvedDate ?? new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      });
      subject = result.subject;
      html = result.html;
    } else if (eventType === "case_stage_changed") {
      const STAGE_LABELS: Record<string, string> = {
        inquiry: "Inquiry",
        consultation_booked: "Consultation Booked",
        proposal_sent: "Proposal Sent",
        active_client: "Active Client",
        completed: "Completed",
      };
      const result = buildCaseStageChangedEmail({
        clientName,
        caseName: details.caseName ?? "Your Case",
        caseId: details.caseId ?? inquiryId ?? "",
        service: details.service ?? "Legal Services",
        previousStage: details.previousStage ?? "",
        newStage: details.newStage ?? "",
        stageLabel: STAGE_LABELS[details.newStage] ?? details.newStage ?? "Updated",
        message: details.message ?? null,
      });
      subject = result.subject;
      html = result.html;
    } else if (eventType === "invoice_issued") {
      const result = buildInvoiceIssuedEmail({
        clientName,
        invoiceNumber: details.invoiceNumber ?? "INV-001",
        invoiceDate: details.invoiceDate ?? new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        dueDate: details.dueDate ?? "Upon Receipt",
        amount: details.amount ?? 0,
        currency: details.currency ?? "usd",
        caseName: details.caseName ?? null,
        notes: details.notes ?? null,
        paymentLink: details.paymentLink ?? null,
      });
      subject = result.subject;
      html = result.html;
    } else if (eventType === "deadline_approaching") {
      const result = buildDeadlineApproachingEmail({
        clientName,
        deadlineTitle: details.deadlineTitle ?? "Case Deadline",
        deadlineDate: details.deadlineDate ?? "",
        daysUntil: details.daysUntil ?? 3,
        caseName: details.caseName ?? null,
        description: details.description ?? null,
      });
      subject = result.subject;
      html = result.html;
    } else {
      throw new Error(`Unknown eventType: ${eventType}`);
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Maggi May Broussard Legal Services <onboarding@resend.dev>",
        to: [clientEmail],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) throw new Error(resendData?.message ?? "Resend error");

    // Log to Supabase if credentials available
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from("case_lifecycle_email_logs").insert({
        inquiry_id: inquiryId ?? null,
        event_type: eventType,
        client_email: clientEmail,
        client_name: clientName,
        subject,
        resend_email_id: resendData.id ?? null,
        status: "sent",
        details: details ?? {},
      });
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-case-lifecycle-email]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
