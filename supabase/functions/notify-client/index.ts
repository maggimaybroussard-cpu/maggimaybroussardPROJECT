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
  success: "#2d6a4f",
  successLight: "#EAF2EB",
  info: "#1a4a7a",
  infoLight: "#EAF0F8",
};

// ─── Shared Layout ────────────────────────────────────────────────────────────

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
                        You are receiving this because you have an active inquiry with Maggi May Broussard Legal Services.
                        &nbsp;·&nbsp;
                        <a href="${SITE_URL}/portal/login" style="color:${brand.accent}; text-decoration:none;">Access your portal</a>
                        &nbsp;·&nbsp;
                        <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; text-decoration:none;">Contact us</a>
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

function p(text: string): string {
  return `<p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">${text}</p>`;
}

function highlightBox(content: string, bg = brand.accentLight, borderColor = brand.accent): string {
  return `<div style="background-color:${bg}; border-left:3px solid ${borderColor}; padding:18px 22px; border-radius:0 8px 8px 0; margin:22px 0;">${content}</div>`;
}

function ctaButton(href: string, label: string, color = brand.accent): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 24px 0;">
      <tr>
        <td style="background-color:${color}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.25);">
          <a href="${href}" style="display:inline-block; padding:14px 36px; color:${brand.white}; text-decoration:none; font-size:14px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">${label} &rarr;</a>
        </td>
      </tr>
    </table>
  `;
}

function sig(): string {
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

// ─── Stage Progress Bar ───────────────────────────────────────────────────────

const STAGES = ["inquiry", "consultation_booked", "proposal_sent", "active_client", "completed"];
const STAGE_LABELS: Record<string, string> = {
  inquiry: "Inquiry",
  consultation_booked: "Consultation",
  proposal_sent: "Proposal",
  active_client: "Active",
  completed: "Complete",
};

function stageProgressBar(currentStage: string): string {
  const currentIdx = STAGES.indexOf(currentStage);
  const steps = STAGES.map((s, i) => {
    const isActive = i === currentIdx;
    const isDone = i < currentIdx;
    const dotColor = isDone || isActive ? brand.accent : brand.border;
    const labelColor = isActive ? brand.primary : isDone ? brand.muted : brand.border;
    const fontWeight = isActive ? "bold" : "normal";
    return `
      <td align="center" style="width:20%;">
        <div style="width:28px; height:28px; border-radius:50%; background-color:${dotColor}; margin:0 auto 6px; display:flex; align-items:center; justify-content:center; line-height:28px; text-align:center;">
          <span style="color:${brand.white}; font-size:12px; font-family: Georgia, serif;">${isDone ? "&#10003;" : isActive ? "&#9679;" : "&bull;"}</span>
        </div>
        <p style="margin:0; font-size:10px; color:${labelColor}; font-weight:${fontWeight}; font-family: Georgia, serif; letter-spacing:0.04em; text-transform:uppercase;">${STAGE_LABELS[s] ?? s}</p>
      </td>
    `;
  });

  return `
    <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:8px; padding:18px 16px; margin:20px 0;">
      <p style="margin:0 0 14px; font-size:11px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">Case Progress</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
        <tr>${steps.join("")}</tr>
      </table>
    </div>
  `;
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
    const { clientEmail, clientName, eventType, details, inquiryId } = await req.json();

    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

    let subject = "";
    let bodyHtml = "";

    const greeting = p(`Dear ${clientName},`);

    if (eventType === "payment_receipt") {
      const amountFormatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: details.currency?.toUpperCase() ?? "USD",
      }).format(Number(details.amount));

      const paymentTypeLabel =
        details.paymentType === "consultation_deposit" ? "Consultation Deposit"
          : details.paymentType === "retainer_agreement" ? "Retainer Agreement" : details.paymentType ?? "Payment";

      const receiptDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      subject = `Payment Receipt — ${paymentTypeLabel} Confirmed`;

      const bodyContent = `
        ${greeting}
        ${p("Thank you — your payment has been successfully processed. Please keep this email as your official receipt.")}
        ${highlightBox(`
          <p style="margin:0 0 12px; font-size:12px; color:${brand.success}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">&#10003;&nbsp; Payment Confirmed</p>
          <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif;">
            <tr>
              <td style="padding:7px 0; color:${brand.muted}; font-size:13px; width:42%; border-bottom:1px solid rgba(217,208,197,0.5);">Payment Type</td>
              <td style="padding:7px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${paymentTypeLabel}</td>
            </tr>
            <tr>
              <td style="padding:7px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Amount Paid</td>
              <td style="padding:7px 0; font-size:22px; font-weight:bold; color:${brand.success}; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${amountFormatted}</td>
            </tr>
            <tr>
              <td style="padding:7px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Date</td>
              <td style="padding:7px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5);">${receiptDate}</td>
            </tr>
            ${details.paymentIntentId ? `
            <tr>
              <td style="padding:7px 0; color:${brand.muted}; font-size:13px;">Transaction ID</td>
              <td style="padding:7px 0; color:${brand.muted}; font-size:12px; font-family: monospace;">${details.paymentIntentId}</td>
            </tr>` : ""}
            ${details.description ? `
            <tr>
              <td style="padding:7px 0; color:${brand.muted}; font-size:13px;">Description</td>
              <td style="padding:7px 0; color:${brand.foreground}; font-size:14px;">${details.description}</td>
            </tr>` : ""}
          </table>
        `, brand.successLight, brand.success)}
        ${p(`You can log in to your client portal to view your full payment history, download invoices, and track your case progress.`)}
        ${ctaButton(`${SITE_URL}/portal/login`, "View Payment History in Portal", brand.success)}
        ${sig()}
      `;
      bodyHtml = emailWrapper(bodyContent, `Payment of ${amountFormatted} confirmed — ${paymentTypeLabel}`);

    } else if (eventType === "status_change") {
      const statusConfig: Record<string, { label: string; color: string; bg: string; message: string }> = {
        new: { label: "Received", color: brand.info, bg: brand.infoLight, message: "Your inquiry has been received and is in our queue." },
        in_review: { label: "In Review", color: brand.accent, bg: brand.accentLight, message: "Your inquiry is currently being reviewed. I'll be in touch shortly." },
        contacted: { label: "In Progress", color: brand.success, bg: brand.successLight, message: "We're actively working on your matter. Expect regular updates." },
        closed: { label: "Closed", color: brand.muted, bg: brand.secondary, message: "Your inquiry has been closed. Please reach out if you need further assistance." },
      };
      const cfg = statusConfig[details.newStatus] ?? { label: details.newStatus, color: brand.accent, bg: brand.accentLight, message: "Your inquiry status has been updated." };

      subject = `Case Update — Your Inquiry Status: ${cfg.label}`;

      const bodyContent = `
        ${greeting}
        ${p("We wanted to let you know that the status of your inquiry has been updated.")}
        <div style="background-color:${cfg.bg}; border:1px solid ${cfg.color}20; border-radius:8px; padding:20px 24px; margin:22px 0; text-align:center;">
          <p style="margin:0 0 6px; font-size:11px; color:${cfg.color}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family: Georgia, serif;">Current Status</p>
          <p style="margin:0 0 8px; font-size:26px; font-weight:bold; color:${cfg.color}; font-family: Georgia, serif;">${cfg.label}</p>
          ${details.service ? `<p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">Service: ${details.service}</p>` : ""}
        </div>
        ${p(cfg.message)}
        ${p(`Log in to your client portal to view the full details of your case and any attached documents.`)}
        ${ctaButton(`${SITE_URL}/portal/login`, "View Your Case in Portal")}
        ${sig()}
      `;
      bodyHtml = emailWrapper(bodyContent, `Your inquiry status has been updated to ${cfg.label}`);

    } else if (eventType === "booking_stage_change") {
      const stageLabels: Record<string, string> = {
        inquiry: "Inquiry Received",
        consultation_booked: "Consultation Booked",
        proposal_sent: "Proposal Sent",
        active_client: "Active Client",
        completed: "Project Completed",
        closed: "Closed",
      };
      const stageLabel = stageLabels[details.newStage] ?? details.newStage;
      const isCompleted = details.newStage === "completed";

      subject = `Case Update — Your Project is Now: ${stageLabel}`;

      const bodyContent = `
        ${greeting}
        ${p("I wanted to keep you informed — your project status has been updated.")}
        ${stageProgressBar(details.newStage)}
        ${highlightBox(`
          <p style="margin:0 0 6px; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">Current Stage</p>
          <p style="margin:0 0 6px; font-size:22px; font-weight:bold; color:${brand.foreground}; font-family: Georgia, serif;">${stageLabel}</p>
          ${details.service ? `<p style="margin:0; font-size:13px; color:${brand.muted}; font-family: Georgia, serif;">Service: ${details.service}</p>` : ""}
        `)}
        ${isCompleted
          ? p(`Your project has been completed — congratulations! I'll be following up shortly to ensure everything met your expectations. You can always reach me at <a href="mailto:maggimaybroussard@gmail.com" style="color:${brand.accent}; text-decoration:none;">maggimaybroussard@gmail.com</a>.`)
          : p(`You can log in to your client portal to view the full details of your case, review documents, and track upcoming milestones.`)
        }
        ${ctaButton(`${SITE_URL}/portal/login`, isCompleted ? "Access Your Client Portal" : "Track Your Case Progress")}
        ${sig()}
      `;
      bodyHtml = emailWrapper(bodyContent, `Your project stage has been updated to ${stageLabel}`);

      // When stage changes to 'completed', update booking_stage in Supabase
      if (isCompleted && inquiryId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          await supabase
            .from("contact_inquiries")
            .update({ booking_stage: "completed" })
            .eq("id", inquiryId);
        } catch {
          // Non-blocking
        }
      }

    } else if (eventType === "case_note") {
      subject = `Case Update — New Note Added to Your File`;

      const bodyContent = `
        ${greeting}
        ${p("A new note has been added to your case file by your legal support team.")}
        ${highlightBox(`
          <p style="margin:0 0 8px; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">&#128221;&nbsp; Case Note</p>
          <p style="margin:0; font-size:14px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">${details.noteContent?.replace(/\n/g, "<br/>") ?? ""}</p>
        `)}
        ${p(`Log in to your client portal to view the full note, respond, and see all case activity.`)}
        ${ctaButton(`${SITE_URL}/portal/login`, "View Full Case Notes in Portal")}
        ${sig()}
      `;
      bodyHtml = emailWrapper(bodyContent, "A new note has been added to your case file");

    } else if (eventType === "document_upload") {
      subject = `Case Update — New Document Added to Your File`;

      const fileExt = (details.fileName ?? "").split(".").pop()?.toUpperCase() ?? "FILE";
      const extColors: Record<string, string> = { PDF: "#e53e3e", DOC: "#3182ce", DOCX: "#3182ce", XLSX: "#38a169", XLS: "#38a169" };
      const extColor = extColors[fileExt] ?? brand.accent;

      const bodyContent = `
        ${greeting}
        ${p("A new document has been added to your case file and is ready for your review.")}
        <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:8px; padding:18px 22px; margin:22px 0;">
          <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
            <tr>
              <td style="vertical-align:middle; width:48px;">
                <div style="width:40px; height:40px; background-color:${extColor}; border-radius:6px; text-align:center; line-height:40px;">
                  <span style="color:${brand.white}; font-size:10px; font-weight:bold; font-family: Georgia, serif;">${fileExt}</span>
                </div>
              </td>
              <td style="vertical-align:middle; padding-left:14px;">
                <p style="margin:0 0 3px; font-size:15px; font-weight:bold; color:${brand.foreground}; font-family: Georgia, serif;">${details.fileName ?? "Document"}</p>
                ${details.uploadedBy ? `<p style="margin:0; font-size:12px; color:${brand.muted}; font-family: Georgia, serif;">Uploaded by: ${details.uploadedBy}</p>` : ""}
              </td>
            </tr>
          </table>
        </div>
        ${p(`Log in to your client portal to view, download, and manage all documents attached to your case.`)}
        ${ctaButton(`${SITE_URL}/portal/login`, "View &amp; Download Document")}
        ${sig()}
      `;
      bodyHtml = emailWrapper(bodyContent, `New document added: ${details.fileName ?? "Document"}`);

    } else if (eventType === "invoice_issued") {
      // ── Invoice Issued Notification ──────────────────────────────────────────
      const amountFormatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: (details.currency ?? "usd").toUpperCase(),
      }).format(Number(details.amount));

      const invoiceDateFormatted = details.invoiceDate
        ? new Date(details.invoiceDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      const dueDateFormatted = details.dueDate
        ? new Date(details.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : invoiceDateFormatted;

      subject = `Invoice ${details.invoiceNumber} — ${amountFormatted} Due`;

      const lineItemsHtml = Array.isArray(details.lineItems) && details.lineItems.length > 0
        ? details.lineItems
            .filter((item: { total: number }) => item.total > 0)
            .map((item: { description: string; quantity: number; unitPrice: number; total: number }, idx: number) => `
              <tr style="${idx % 2 === 1 ? `background-color:rgba(237,232,224,0.4);` : ""}">
                <td style="padding:9px 14px; font-size:13px; color:${brand.foreground}; font-family:Georgia,serif; line-height:1.5;">${item.description}</td>
                <td style="padding:9px 14px; font-size:13px; color:${brand.muted}; font-family:Georgia,serif; text-align:center;">${item.quantity}</td>
                <td style="padding:9px 14px; font-size:13px; color:${brand.foreground}; font-family:Georgia,serif; text-align:right; font-weight:bold;">${new Intl.NumberFormat("en-US", { style: "currency", currency: (details.currency ?? "usd").toUpperCase() }).format(item.total)}</td>
              </tr>
            `).join("")
        : `<tr><td colspan="3" style="padding:12px 14px; font-size:13px; color:${brand.muted}; font-family:Georgia,serif;">Legal Services</td></tr>`;

      // Payment link CTA — shown prominently when a Stripe link is provided
      const paymentCta = details.paymentLink
        ? `
          <div style="background-color:${brand.accentLight}; border:1px solid ${brand.accent}; border-radius:10px; padding:22px 24px; margin:22px 0; text-align:center;">
            <p style="margin:0 0 6px; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family:Georgia,serif;">&#128274;&nbsp; Secure Online Payment</p>
            <p style="margin:0 0 16px; font-size:14px; color:${brand.foreground}; font-family:Georgia,serif; line-height:1.7;">Pay your invoice securely online using a credit or debit card. No account required.</p>
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
              <tr>
                <td style="background-color:${brand.accent}; border-radius:7px; box-shadow:0 2px 8px rgba(200,150,90,0.30);">
                  <a href="${details.paymentLink}" style="display:inline-block; padding:14px 40px; color:${brand.white}; text-decoration:none; font-size:15px; font-family:Georgia,serif; letter-spacing:0.05em; font-weight:bold;">Pay ${amountFormatted} Now &rarr;</a>
                </td>
              </tr>
            </table>
            <p style="margin:14px 0 0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">Powered by Stripe &nbsp;&middot;&nbsp; 256-bit SSL encryption</p>
          </div>
        `
        : ctaButton(`${SITE_URL}/portal/invoices`, "View Invoice in Portal");

      const bodyContent = `
        ${greeting}
        ${p("A new invoice has been issued for your account. Please review the details below.")}
        <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:22px 0;">
          <div style="background-color:${brand.primary}; padding:14px 20px;">
            <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family:Georgia,serif;">Invoice Details</p>
            <p style="margin:4px 0 0; font-size:17px; color:${brand.white}; font-family:Georgia,serif; font-weight:bold;">${details.invoiceNumber}</p>
          </div>
          <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif;">
            <tr>
              <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; width:42%; border-bottom:1px solid rgba(217,208,197,0.5);">Invoice Date</td>
              <td style="padding:10px 20px; color:${brand.foreground}; font-size:13px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${invoiceDateFormatted}</td>
            </tr>
            <tr>
              <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; border-bottom:1px solid rgba(217,208,197,0.5);">Due Date</td>
              <td style="padding:10px 20px; color:${brand.foreground}; font-size:13px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${dueDateFormatted}</td>
            </tr>
            <tr>
              <td style="padding:10px 20px; color:${brand.muted}; font-size:12px;">Amount Due</td>
              <td style="padding:10px 20px; font-size:20px; font-weight:bold; color:${brand.accent}; font-family:Georgia,serif;">${amountFormatted}</td>
            </tr>
          </table>
        </div>
        <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:22px 0;">
          <div style="background-color:${brand.secondary}; padding:10px 14px; border-bottom:1px solid ${brand.border};">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <th style="text-align:left; font-size:10px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.1em; font-family:Georgia,serif; padding:0 0 0 0; font-weight:bold;">Description</th>
                <th style="text-align:center; font-size:10px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.1em; font-family:Georgia,serif; font-weight:bold;">Qty</th>
                <th style="text-align:right; font-size:10px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.1em; font-family:Georgia,serif; font-weight:bold;">Total</th>
              </tr>
            </table>
          </div>
          <table style="width:100%; border-collapse:collapse;">${lineItemsHtml}</table>
          <div style="background-color:${brand.accent}; padding:12px 14px;">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="font-size:13px; color:${brand.white}; font-weight:bold; font-family:Georgia,serif; text-transform:uppercase; letter-spacing:0.06em;">Total Due</td>
                <td style="text-align:right; font-size:16px; color:${brand.white}; font-weight:bold; font-family:Georgia,serif;">${amountFormatted}</td>
              </tr>
            </table>
          </div>
        </div>
        ${details.notes ? highlightBox(`<p style="margin:0; font-size:13px; color:${brand.foreground}; font-family:Georgia,serif; line-height:1.7;">${details.notes}</p>`) : ""}
        ${paymentCta}
        ${details.paymentLink ? ctaButton(`${SITE_URL}/portal/invoices`, "View Invoice in Portal", brand.primary) : ""}
        ${sig()}
      `;
      bodyHtml = emailWrapper(bodyContent, `New invoice ${details.invoiceNumber} for ${amountFormatted} has been issued.`);

    } else if (eventType === "hours_depletion") {
      // ── Retainer Hours Near Depletion ─────────────────────────────────────────
      const hoursUsed = Number(details.hoursUsed ?? 0);
      const hoursTotal = Number(details.hoursTotal ?? 0);
      const hoursRemaining = Math.max(0, hoursTotal - hoursUsed);
      const percentUsed = hoursTotal > 0 ? Math.round((hoursUsed / hoursTotal) * 100) : 0;
      const isCritical = percentUsed >= 90;
      const alertColor = isCritical ? "#B91C1C" : "#C2410C";
      const alertBg = isCritical ? "#FEF2F2" : "#FFF7ED";

      subject = isCritical
        ? `⚠️ Retainer Hours Critical — Only ${hoursRemaining} Hour${hoursRemaining !== 1 ? "s" : ""} Remaining`
        : `Retainer Hours Alert — ${hoursRemaining} Hour${hoursRemaining !== 1 ? "s" : ""} Remaining`;

      const progressBarWidth = Math.min(100, percentUsed);
      const progressColor = isCritical ? "#B91C1C" : percentUsed >= 75 ? "#C2410C" : brand.accent;

      const bodyContent = `
        ${greeting}
        ${p(`This is an important notice regarding your retainer hours. Your ${details.planName ?? "retainer"} is approaching its monthly hour limit.`)}
        <div style="background-color:${alertBg}; border-left:4px solid ${alertColor}; padding:18px 22px; border-radius:0 8px 8px 0; margin:22px 0;">
          <p style="margin:0 0 6px; font-size:12px; color:${alertColor}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family:Georgia,serif;">&#9888;&nbsp; ${isCritical ? "Critical — Hours Nearly Exhausted" : "Hours Depletion Warning"}</p>
          <p style="margin:0; font-size:14px; color:${brand.foreground}; font-family:Georgia,serif; line-height:1.7;">You have used <strong>${hoursUsed} of ${hoursTotal} hours</strong> (${percentUsed}%) this billing period. Only <strong>${hoursRemaining} hour${hoursRemaining !== 1 ? "s" : ""}</strong> remain.</p>
        </div>
        <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; padding:20px 22px; margin:22px 0;">
          <p style="margin:0 0 14px; font-size:11px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.1em; font-family:Georgia,serif;">Hours Usage This Period</p>
          <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif; margin-bottom:16px;">
            <tr>
              <td style="padding:7px 0; color:${brand.muted}; font-size:13px; width:50%; border-bottom:1px solid rgba(217,208,197,0.5);">Plan</td>
              <td style="padding:7px 0; color:${brand.foreground}; font-size:13px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${details.planName ?? "Monthly Retainer"}</td>
            </tr>
            <tr>
              <td style="padding:7px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Hours Included</td>
              <td style="padding:7px 0; color:${brand.foreground}; font-size:13px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${hoursTotal} hrs/month</td>
            </tr>
            <tr>
              <td style="padding:7px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Hours Used</td>
              <td style="padding:7px 0; color:${alertColor}; font-size:13px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${hoursUsed} hrs (${percentUsed}%)</td>
            </tr>
            <tr>
              <td style="padding:7px 0; color:${brand.muted}; font-size:13px;">Hours Remaining</td>
              <td style="padding:7px 0; color:${isCritical ? alertColor : brand.success}; font-size:16px; font-weight:bold;">${hoursRemaining} hrs</td>
            </tr>
          </table>
          <div style="background-color:${brand.secondary}; border-radius:20px; height:10px; overflow:hidden; margin-top:4px;">
            <div style="background-color:${progressColor}; height:10px; width:${progressBarWidth}%; border-radius:20px; transition:width 0.3s;"></div>
          </div>
          <p style="margin:8px 0 0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif; text-align:right;">${percentUsed}% used</p>
        </div>
        ${details.periodEnd ? p(`Your current billing period ends on <strong>${new Date(details.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>. Unused hours do not roll over.`) : ""}
        ${p("If you anticipate needing additional hours before your next renewal, please contact us to discuss options — including upgrading your retainer tier or purchasing additional hours.")}
        ${ctaButton(`${SITE_URL}/portal/retainer`, "View Your Retainer Details")}
        ${ctaButton(`mailto:maggimaybroussard@gmail.com?subject=Retainer Hours — Need Additional Time`, "Contact Maggi May", brand.primary)}
        ${sig()}
      `;
      bodyHtml = emailWrapper(
        bodyContent,
        `Your retainer has ${hoursRemaining} hours remaining (${percentUsed}% used) this billing period.`
      );

    } else if (eventType === "paid_receipt") {
      const amountPaid = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: details.currency?.toUpperCase() ?? "USD",
      }).format(Number(details.amount));

      subject = `Payment Received — Confirmation`;

      const bodyContent = `
        ${greeting}
        ${p("Thank you for your payment. Your receipt is attached below for your records.")}
        ${highlightBox(`
          <p style="margin:0 0 12px; font-size:12px; color:${brand.success}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">&#10003;&nbsp; Payment Confirmed</p>
          <table style="width:100%; border-collapse:collapse; font-family: Georgia, serif;">
            <tr>
              <td style="padding:7px 0; color:${brand.muted}; font-size:13px; width:42%; border-bottom:1px solid rgba(217,208,197,0.5);">Payment Type</td>
              <td style="padding:7px 0; color:${brand.foreground}; font-size:14px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${details.paymentType}</td>
            </tr>
            <tr>
              <td style="padding:7px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Amount Paid</td>
              <td style="padding:7px 0; font-size:22px; font-weight:bold; color:${brand.success}; font-family: Georgia, serif; border-bottom:1px solid rgba(217,208,197,0.5);">${amountPaid}</td>
            </tr>
            <tr>
              <td style="padding:7px 0; color:${brand.muted}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">Date</td>
              <td style="padding:7px 0; color:${brand.foreground}; font-size:14px; border-bottom:1px solid rgba(217,208,197,0.5);">${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
            </tr>
          </table>
        `, brand.successLight, brand.success)}
        ${p(`You can log in to your client portal to view your full payment history, download invoices, and track your case progress.`)}
        ${ctaButton(`${SITE_URL}/portal/login`, "View Payment History in Portal", brand.success)}
        ${sig()}
      `;
      bodyHtml = emailWrapper(bodyContent, `Payment of ${amountPaid} received.`);

    } else if (eventType === "paid_receipt") {
      // ── Paid Receipt (payment_intent.succeeded) ───────────────────────────────
      const amountFormatted = details.amountFormatted ?? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: (details.currency ?? "usd").toUpperCase(),
      }).format(Number(details.amount));

      const paidDate = details.paidDate ?? new Date().toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });

      subject = `Payment Receipt — Invoice ${details.invoiceNumber} Paid`;

      const bodyContent = `
        ${greeting}
        ${p("Great news — your payment has been successfully received and your invoice has been marked as paid. Please keep this email as your official receipt.")}
        <div style="background-color:${brand.successLight}; border:1px solid ${brand.success}30; border-radius:10px; padding:22px 24px; margin:22px 0; text-align:center;">
          <p style="margin:0 0 4px; font-size:11px; color:${brand.success}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family:Georgia,serif;">&#10003;&nbsp; Payment Confirmed</p>
          <p style="margin:0 0 2px; font-size:32px; font-weight:bold; color:${brand.success}; font-family:Georgia,serif;">${amountFormatted}</p>
          <p style="margin:0; font-size:13px; color:${brand.muted}; font-family:Georgia,serif;">${paidDate}</p>
        </div>
        <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin:22px 0;">
          <div style="background-color:${brand.primary}; padding:12px 20px;">
            <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.12em; font-family:Georgia,serif;">Receipt Details</p>
          </div>
          <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif;">
            <tr>
              <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; width:42%; border-bottom:1px solid rgba(217,208,197,0.5);">Invoice Number</td>
              <td style="padding:10px 20px; color:${brand.foreground}; font-size:13px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${details.invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; border-bottom:1px solid rgba(217,208,197,0.5);">Amount Paid</td>
              <td style="padding:10px 20px; font-size:18px; font-weight:bold; color:${brand.success}; font-family:Georgia,serif; border-bottom:1px solid rgba(217,208,197,0.5);">${amountFormatted}</td>
            </tr>
            <tr>
              <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; border-bottom:1px solid rgba(217,208,197,0.5);">Payment Date</td>
              <td style="padding:10px 20px; color:${brand.foreground}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.5);">${paidDate}</td>
            </tr>
            <tr>
              <td style="padding:10px 20px; color:${brand.muted}; font-size:12px; border-bottom:1px solid rgba(217,208,197,0.5);">Status</td>
              <td style="padding:10px 20px; color:${brand.success}; font-size:13px; font-weight:bold; border-bottom:1px solid rgba(217,208,197,0.5);">${details.isPaidInFull ? "Paid in Full" : "Partial Payment"}</td>
            </tr>
            ${details.paymentIntentId ? `
            <tr>
              <td style="padding:10px 20px; color:${brand.muted}; font-size:12px;">Transaction ID</td>
              <td style="padding:10px 20px; color:${brand.muted}; font-size:11px; font-family:monospace;">${details.paymentIntentId}</td>
            </tr>` : ""}
          </table>
        </div>
        ${details.description ? highlightBox(`<p style="margin:0; font-size:13px; color:${brand.foreground}; font-family:Georgia,serif; line-height:1.7;"><strong>Description:</strong> ${details.description}</p>`) : ""}
        ${p("You can log in to your client portal at any time to view your full payment history, download invoices, and track your case progress.")}
        ${ctaButton(`${SITE_URL}/portal/invoices`, "View Payment History in Portal", brand.success)}
        ${sig()}
      `;
      bodyHtml = emailWrapper(
        bodyContent,
        `Your payment of ${amountFormatted} for invoice ${details.invoiceNumber} has been confirmed.`
      );

    } else {
      throw new Error(`Unknown eventType: ${eventType}`);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "maggimay@broussardlegalservices.com",
        to: [clientEmail],
        subject,
        html: bodyHtml,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json();
      throw new Error(errBody.message || "Resend API error");
    }

    const data = await res.json();

    // ── WhatsApp notification via Twilio (non-blocking, best-effort) ─────────
    const clientPhone: string | undefined = (await req.clone().json().catch(() => ({}))).clientPhone;
    if (clientPhone) {
      const TWILIO_ACCOUNT_SID = (globalThis as any)?.Deno?.env?.get("TWILIO_ACCOUNT_SID");
      const TWILIO_AUTH_TOKEN = (globalThis as any)?.Deno?.env?.get("TWILIO_AUTH_TOKEN");
      const TWILIO_PHONE_NUMBER = (globalThis as any)?.Deno?.env?.get("TWILIO_PHONE_NUMBER");

      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
        try {
          const firstName = clientName?.split(" ")[0] ?? clientName;
          let waBody = "";

          if (eventType === "case_update" || eventType === "case_status_change") {
            const caseRef = details?.caseId ?? details?.caseNumber ?? "";
            const summary = details?.summary ?? details?.message ?? "Your case has been updated.";
            waBody = `Broussard Legal Services\n\nHi ${firstName}, ${caseRef ? `update for case ${caseRef}: ` : ""}${summary}\n\nCheck your portal: https://broussardlegalservices.com/portal/cases`;
          } else if (eventType === "payment_receipt" || eventType === "paid_receipt") {
            const amountStr = details?.amountFormatted ?? (details?.amount ? `$${Number(details.amount).toFixed(2)}` : "your payment");
            waBody = `Broussard Legal Services\n\nHi ${firstName}, your payment of ${amountStr} has been received and confirmed. View your receipt: https://broussardlegalservices.com/portal/invoices`;
          } else if (eventType === "invoice_issued") {
            const invoiceNum = details?.invoiceNumber ?? "";
            const amount = details?.amount ?? "";
            waBody = `Broussard Legal Services\n\nHi ${firstName}, a new invoice${invoiceNum ? ` #${invoiceNum}` : ""}${amount ? ` for ${amount}` : ""} has been issued. Pay securely: https://broussardlegalservices.com/portal/invoices`;
          } else if (eventType === "document_ready") {
            waBody = `Broussard Legal Services\n\nHi ${firstName}, a document is ready for your review in your client portal: https://broussardlegalservices.com/portal/documents`;
          } else if (eventType === "general") {
            const msg = details?.message ?? subject;
            if (msg) waBody = `Broussard Legal Services\n\nHi ${firstName}, ${msg}`;
          }

          if (waBody) {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
            const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

            // Send via WhatsApp (primary)
            const waFormData = new URLSearchParams({
              To: `whatsapp:${clientPhone}`,
              From: `whatsapp:${TWILIO_PHONE_NUMBER}`,
              Body: waBody,
            });
            const waRes = await fetch(twilioUrl, {
              method: "POST",
              headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
              body: waFormData.toString(),
            });

            // SMS fallback if WhatsApp fails
            if (!waRes.ok) {
              const smsFormData = new URLSearchParams({
                To: clientPhone,
                From: TWILIO_PHONE_NUMBER,
                Body: waBody + "\n\nReply STOP to opt out.",
              });
              await fetch(twilioUrl, {
                method: "POST",
                headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
                body: smsFormData.toString(),
              });
            }
          }
        } catch (waErr) {
          console.error("[notify-client] WhatsApp/SMS send failed (non-blocking):", waErr);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
