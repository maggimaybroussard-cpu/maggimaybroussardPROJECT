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
  warning: "#92400e",
  warningLight: "#FEF3C7",
  danger: "#991b1b",
  dangerLight: "#FEE2E2",
};

function emailWrapper(content: string, preheader = "", digestLabel = "Case Digest"): string {
  const isDaily = digestLabel.includes("Daily");
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>${digestLabel} — Maggi May Broussard</title>
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
                          <td style="text-align:right; vertical-align: middle; padding-left: 20px;">
                            <p style="margin:0; font-size:10px; color:${brand.accent}; letter-spacing:0.14em; text-transform:uppercase; font-family: Georgia, serif;">${isDaily ? "Daily" : "Weekly"}</p>
                            <p style="margin:2px 0 0; font-size:18px; color:${brand.white}; font-family: Georgia, serif; font-weight:normal;">Case Digest</p>
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
              <td style="padding: 0 36px 32px;">
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
                      <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.7; font-family: Georgia, serif;">
                        You are receiving this ${isDaily ? "daily" : "weekly"} digest because you have an active case with Maggi May Broussard Legal Services.
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

function sectionHeader(title: string, icon: string): string {
  return `
    <div style="margin: 28px 0 14px; display:flex; align-items:center; gap:10px;">
      <span style="font-size:16px;">${icon}</span>
      <h3 style="margin:0; font-size:14px; color:${brand.primary}; font-family: Georgia, serif; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em;">${title}</h3>
      <div style="flex:1; height:1px; background:${brand.border}; margin-left:8px;"></div>
    </div>
  `;
}

function statusBadge(status: string): string {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    new: { bg: "#DBEAFE", color: "#1e40af", label: "New" },
    in_progress: { bg: "#D1FAE5", color: "#065f46", label: "In Progress" },
    active: { bg: "#D1FAE5", color: "#065f46", label: "Active" },
    pending: { bg: "#FEF3C7", color: "#92400e", label: "Pending" },
    completed: { bg: "#F3F4F6", color: "#374151", label: "Completed" },
    closed: { bg: "#F3F4F6", color: "#374151", label: "Closed" },
    paid: { bg: "#D1FAE5", color: "#065f46", label: "Paid" },
    overdue: { bg: "#FEE2E2", color: "#991b1b", label: "Overdue" },
    cancelled: { bg: "#F3F4F6", color: "#374151", label: "Cancelled" },
  };
  const s = map[status?.toLowerCase()] ?? { bg: brand.accentLight, color: brand.primary, label: status ?? "Unknown" };
  return `<span style="display:inline-block; background-color:${s.bg}; color:${s.color}; font-size:10px; font-weight:bold; letter-spacing:0.08em; text-transform:uppercase; padding:3px 10px; border-radius:20px; font-family: Georgia, serif;">${s.label}</span>`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function signature(): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 12px 0 28px; border-top:1px solid ${brand.border}; padding-top:20px; width:100%;">
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
    const SUPABASE_URL = (globalThis as any)?.Deno?.env?.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = (globalThis as any)?.Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
    const RESEND_API_KEY = (globalThis as any)?.Deno?.env?.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env vars not set");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse optional body for targeted send (specific client email or inquiry_id)
    let targetEmail: string | null = null;
    let targetInquiryId: string | null = null;
    let frequency: "daily" | "weekly" = "weekly";
    let docTypeFilter: string | null = null;
    let pendingReviewOnly = false;
    try {
      const body = await req.json();
      targetEmail = body?.clientEmail ?? null;
      targetInquiryId = body?.inquiryId ?? null;
      if (body?.frequency === "daily") frequency = "daily";
      docTypeFilter = body?.docTypeFilter ?? null; // e.g. "contract", "filing", null = all
      pendingReviewOnly = body?.pendingReviewOnly === true;
    } catch {
      // No body — send to all active clients, weekly
    }

    // Lookback window: 1 day for daily, 7 days for weekly
    const lookbackDays = frequency === "daily" ? 1 : 7;
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - lookbackDays);
    const periodStartISO = periodStart.toISOString();

    // ── Fetch active cases (contact_inquiries with active/in_progress status) ──
    let inquiriesQuery = supabase
      .from("contact_inquiries")
      .select("id, name, email, firm, service, status, notes, created_at, updated_at")
      .in("status", ["active", "in_progress", "new", "pending"])
      .order("updated_at", { ascending: false });

    if (targetEmail) inquiriesQuery = inquiriesQuery.eq("email", targetEmail);
    if (targetInquiryId) inquiriesQuery = inquiriesQuery.eq("id", targetInquiryId);

    const { data: inquiries, error: inquiriesError } = await inquiriesQuery;
    if (inquiriesError) throw new Error(`Inquiries fetch error: ${inquiriesError.message}`);
    if (!inquiries || inquiries.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No active cases found", sent: 0 }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Group inquiries by client email
    const clientMap = new Map<string, typeof inquiries>();
    for (const inq of inquiries) {
      const key = inq.email.toLowerCase();
      if (!clientMap.has(key)) clientMap.set(key, []);
      clientMap.get(key)!.push(inq);
    }

    const digestLabel = frequency === "daily"
      ? `Daily Case Digest`
      : `Weekly Case Digest`;

    let sentCount = 0;
    const errors: string[] = [];

    for (const [clientEmail, clientCases] of clientMap) {
      const clientName = clientCases[0].name;
      const inquiryIds = clientCases.map((c) => c.id);

      // ── Fetch invoices for this client's cases ──
      const { data: invoices } = await supabase
        .from("client_invoices")
        .select("id, invoice_number, invoice_date, due_date, amount, amount_paid, status, inquiry_id")
        .in("inquiry_id", inquiryIds)
        .order("due_date", { ascending: true });

      // ── Fetch recent case notes / updates ──
      const { data: caseNotes } = await supabase
        .from("case_notes")
        .select("id, inquiry_id, content, created_at")
        .in("inquiry_id", inquiryIds)
        .gte("created_at", periodStartISO)
        .order("created_at", { ascending: false })
        .limit(10);

      // ── Fetch case timeline events ──
      const { data: timelineEvents } = await supabase
        .from("case_timeline")
        .select("id, inquiry_id, event_type, description, created_at")
        .in("inquiry_id", inquiryIds)
        .gte("created_at", periodStartISO)
        .order("created_at", { ascending: false })
        .limit(10);

      // ── Fetch pending admin tasks for this client ──
      const { data: tasks } = await supabase
        .from("admin_tasks")
        .select("id, title, description, due_date, priority, status")
        .eq("status", "pending")
        .order("due_date", { ascending: true })
        .limit(5);

      // ── Fetch portal messages ──
      const { data: messages } = await supabase
        .from("portal_messages")
        .select("id, inquiry_id, message, sender_type, created_at")
        .in("inquiry_id", inquiryIds)
        .gte("created_at", periodStartISO)
        .order("created_at", { ascending: false })
        .limit(5);

      // ── Fetch recent document uploads ──
      let docsQuery = supabase
        .from("case_documents")
        .select("id, inquiry_id, file_name, file_size, category, document_type, uploaded_by, created_at, storage_path, requires_client_review")
        .in("inquiry_id", inquiryIds)
        .gte("created_at", periodStartISO)
        .order("created_at", { ascending: false })
        .limit(10);

      if (docTypeFilter) {
        docsQuery = docsQuery.eq("document_type", docTypeFilter);
      }
      if (pendingReviewOnly) {
        docsQuery = docsQuery.eq("requires_client_review", true);
      }

      const { data: recentDocs } = await docsQuery;

      // ── Build email body ──
      const dateLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const firstName = clientName.split(" ")[0];
      const periodLabel = frequency === "daily" ? "Today" : `Week of ${dateLabel}`;

      // Greeting + intro
      let bodyContent = `
        <div style="padding-top: 28px;">
          <span style="display:inline-block; background-color:${brand.accent}; color:${brand.white}; font-size:10px; font-weight:bold; letter-spacing:0.12em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:22px; font-family: Georgia, serif;">&#128197;&nbsp; ${periodLabel}</span>
          <h2 style="margin:0 0 16px; font-size:22px; color:${brand.foreground}; font-family: Georgia, 'Times New Roman', serif; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:14px;">Your ${frequency === "daily" ? "Daily" : "Weekly"} Case Summary, ${firstName}</h2>
          <p style="margin:0 0 8px; font-size:15px; color:${brand.foreground}; line-height:1.8; font-family: Georgia, serif;">
            Here is a summary of your active case${clientCases.length > 1 ? "s" : ""}, recent updates, new documents, pending action items, and invoice status${frequency === "daily" ? " for today" : " for the past week"}.
          </p>
        </div>
      `;

      // ── CASE STATUS SECTION ──
      bodyContent += sectionHeader("Active Cases", "&#128196;");
      for (const c of clientCases) {
        bodyContent += `
          <div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin-bottom:14px;">
            <div style="background-color:${brand.primary}; padding:10px 20px; display:flex; justify-content:space-between; align-items:center;">
              <p style="margin:0; font-size:12px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">${c.service}</p>
              ${statusBadge(c.status)}
            </div>
            <div style="padding:16px 20px;">
              <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif;">
                <tr>
                  <td style="padding:6px 0; color:${brand.muted}; font-size:12px; width:38%; border-bottom:1px solid rgba(217,208,197,0.4);">Client / Firm</td>
                  <td style="padding:6px 0; color:${brand.foreground}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.4);">${c.name}${c.firm ? ` · ${c.firm}` : ""}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; color:${brand.muted}; font-size:12px; border-bottom:1px solid rgba(217,208,197,0.4);">Case Opened</td>
                  <td style="padding:6px 0; color:${brand.foreground}; font-size:13px; border-bottom:1px solid rgba(217,208,197,0.4);">${formatDate(c.created_at)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; color:${brand.muted}; font-size:12px;">Last Updated</td>
                  <td style="padding:6px 0; color:${brand.foreground}; font-size:13px;">${formatDate(c.updated_at)}</td>
                </tr>
                ${c.notes ? `
                <tr>
                  <td colspan="2" style="padding:10px 0 0;">
                    <p style="margin:0; font-size:12px; color:${brand.muted}; font-style:italic; line-height:1.6; font-family:Georgia,serif; border-left:3px solid ${brand.accent}; padding-left:12px;">${c.notes}</p>
                  </td>
                </tr>` : ""}
              </table>
            </div>
          </div>
        `;
      }

      // ── RECENT UPDATES SECTION ──
      const allUpdates = [
        ...(caseNotes ?? []).map((n) => ({ type: "note", text: n.content, date: n.created_at, inquiryId: n.inquiry_id })),
        ...(timelineEvents ?? []).map((e) => ({ type: "event", text: e.description ?? e.event_type, date: e.created_at, inquiryId: e.inquiry_id })),
        ...(messages ?? []).map((m) => ({ type: "message", text: m.message, date: m.created_at, inquiryId: m.inquiry_id, sender: m.sender_type })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

      const updatesLabel = frequency === "daily" ? "Recent Updates (Today)" : "Recent Updates (This Week)";
      if (allUpdates.length > 0) {
        bodyContent += sectionHeader(updatesLabel, "&#128276;");
        bodyContent += `<div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin-bottom:14px;">`;
        allUpdates.forEach((u, idx) => {
          const iconMap: Record<string, string> = { note: "&#128221;", event: "&#9889;", message: "&#128172;" };
          const labelMap: Record<string, string> = { note: "Case Note", event: "Timeline Event", message: (u as any).sender === "admin" ? "Message from Maggi" : "Your Message" };
          bodyContent += `
            <div style="padding:14px 20px; ${idx < allUpdates.length - 1 ? `border-bottom:1px solid rgba(217,208,197,0.4);` : ""}">
              <div style="display:flex; align-items:flex-start; gap:10px;">
                <span style="font-size:14px; margin-top:1px;">${iconMap[u.type] ?? "&#8226;"}</span>
                <div style="flex:1;">
                  <p style="margin:0 0 4px; font-size:11px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.08em; font-family:Georgia,serif;">${labelMap[u.type] ?? u.type} · ${formatDate(u.date)}</p>
                  <p style="margin:0; font-size:13px; color:${brand.foreground}; line-height:1.6; font-family:Georgia,serif;">${u.text}</p>
                </div>
              </div>
            </div>
          `;
        });
        bodyContent += `</div>`;
      } else {
        bodyContent += sectionHeader(updatesLabel, "&#128276;");
        bodyContent += `<p style="margin:0 0 20px; font-size:13px; color:${brand.muted}; font-style:italic; font-family:Georgia,serif;">No new updates ${frequency === "daily" ? "today" : "this week"}. Your paralegal will be in touch soon.</p>`;
      }

      // ── DOCUMENTS SECTION ──
      const docsLabel = frequency === "daily" ? "Documents Uploaded Today" : "Documents Uploaded This Week";
      bodyContent += sectionHeader(docsLabel, "&#128196;");
      if (recentDocs && recentDocs.length > 0) {
        // Generate signed download URLs for each document
        const docsWithUrls: Array<typeof recentDocs[0] & { downloadUrl: string | null }> = [];
        for (const doc of recentDocs) {
          let downloadUrl: string | null = null;
          if (doc.storage_path) {
            const { data: signedData } = await supabase.storage
              .from("case-documents")
              .createSignedUrl(doc.storage_path, 60 * 60 * 24 * 7); // 7-day signed URL
            downloadUrl = signedData?.signedUrl ?? null;
          }
          docsWithUrls.push({ ...doc, downloadUrl });
        }

        const pendingReviewDocs = docsWithUrls.filter((d) => d.requires_client_review);
        const docTypeFilterLabel = docTypeFilter
          ? docTypeFilter.charAt(0).toUpperCase() + docTypeFilter.slice(1) + "s Only"
          : null;

        bodyContent += `<div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin-bottom:14px;">`;

        // Header bar
        bodyContent += `
          <div style="background-color:${brand.primary}; padding:10px 20px; display:flex; justify-content:space-between; align-items:center;">
            <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">${docsWithUrls.length} Document${docsWithUrls.length !== 1 ? "s" : ""} Added${docTypeFilterLabel ? ` · ${docTypeFilterLabel}` : ""}</p>
            ${pendingReviewDocs.length > 0 ? `<span style="background-color:#FEF3C7; color:#92400e; font-size:10px; font-weight:bold; letter-spacing:0.08em; text-transform:uppercase; padding:3px 10px; border-radius:20px; font-family: Georgia, serif;">&#9888; ${pendingReviewDocs.length} Pending Your Review</span>` : ""}
          </div>
        `;

        // Pending review alert banner
        if (pendingReviewDocs.length > 0) {
          bodyContent += `
            <div style="background-color:${brand.warningLight}; border-bottom:1px solid #FDE68A; padding:12px 20px;">
              <p style="margin:0; font-size:13px; color:${brand.warning}; font-weight:bold; font-family:Georgia,serif;">&#9888;&nbsp; ${pendingReviewDocs.length} document${pendingReviewDocs.length > 1 ? "s require" : " requires"} your review and action. Please log in to your portal to review and respond.</p>
            </div>
          `;
        }

        docsWithUrls.forEach((doc, idx) => {
          const ext = doc.file_name?.split(".").pop()?.toUpperCase() ?? "FILE";
          const extColors: Record<string, { bg: string; color: string }> = {
            PDF: { bg: "#FEE2E2", color: "#991b1b" },
            DOC: { bg: "#DBEAFE", color: "#1e40af" },
            DOCX: { bg: "#DBEAFE", color: "#1e40af" },
            JPG: { bg: "#D1FAE5", color: "#065f46" },
            JPEG: { bg: "#D1FAE5", color: "#065f46" },
            PNG: { bg: "#D1FAE5", color: "#065f46" },
            XLSX: { bg: "#D1FAE5", color: "#065f46" },
            XLS: { bg: "#D1FAE5", color: "#065f46" },
          };
          const extStyle = extColors[ext] ?? { bg: brand.accentLight, color: brand.primary };
          const sizeLabel = formatFileSize(doc.file_size);
          const uploadedBy = doc.uploaded_by === "admin" ? "Uploaded by Maggi" : "Uploaded by you";

          // Document type badge
          const docTypeBadgeMap: Record<string, { bg: string; color: string; label: string }> = {
            contract: { bg: "#EDE9FE", color: "#5b21b6", label: "Contract" },
            filing: { bg: "#DBEAFE", color: "#1e40af", label: "Filing" },
            correspondence: { bg: "#D1FAE5", color: "#065f46", label: "Correspondence" },
            invoice: { bg: "#FEF3C7", color: "#92400e", label: "Invoice" },
            evidence: { bg: "#FEE2E2", color: "#991b1b", label: "Evidence" },
            other: { bg: brand.accentLight, color: brand.primary, label: "Other" },
          };
          const docTypeBadge = doc.document_type && docTypeBadgeMap[doc.document_type]
            ? `<span style="display:inline-block; background-color:${docTypeBadgeMap[doc.document_type].bg}; color:${docTypeBadgeMap[doc.document_type].color}; font-size:10px; font-weight:bold; letter-spacing:0.06em; padding:2px 8px; border-radius:20px; font-family:Georgia,serif; margin-left:6px;">${docTypeBadgeMap[doc.document_type].label}</span>`
            : "";

          const pendingBadge = doc.requires_client_review
            ? `<span style="display:inline-block; background-color:#FEF3C7; color:#92400e; font-size:10px; font-weight:bold; letter-spacing:0.06em; padding:2px 8px; border-radius:20px; font-family:Georgia,serif; margin-left:6px;">&#9888; Pending Your Review</span>`
            : "";

          bodyContent += `
            <div style="padding:14px 20px; ${idx < docsWithUrls.length - 1 ? `border-bottom:1px solid rgba(217,208,197,0.4);` : ""}${doc.requires_client_review ? `background-color:#FFFBEB;` : ""}">
              <div style="display:flex; align-items:flex-start; gap:12px;">
                <span style="display:inline-block; background-color:${extStyle.bg}; color:${extStyle.color}; font-size:10px; font-weight:bold; letter-spacing:0.06em; padding:4px 8px; border-radius:6px; font-family:Georgia,serif; flex-shrink:0; margin-top:2px;">${ext}</span>
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; flex-wrap:wrap; align-items:center; gap:4px; margin-bottom:3px;">
                    <p style="margin:0; font-size:13px; color:${brand.foreground}; font-weight:bold; font-family:Georgia,serif;">${doc.file_name}</p>
                    ${docTypeBadge}
                    ${pendingBadge}
                  </div>
                  <p style="margin:0; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">
                    ${uploadedBy}${doc.category ? ` · ${doc.category}` : ""}${sizeLabel ? ` · ${sizeLabel}` : ""} · ${formatDate(doc.created_at)}
                  </p>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0;">
                  ${doc.downloadUrl
                    ? `<a href="${doc.downloadUrl}" style="display:inline-block; background-color:${brand.accent}; color:${brand.white}; font-size:11px; font-weight:bold; padding:6px 12px; border-radius:6px; text-decoration:none; font-family:Georgia,serif; text-align:center;">&#8595; Download</a>`
                    : ""}
                  <a href="${SITE_URL}/portal/documents" style="display:inline-block; background-color:${brand.accentLight}; color:${brand.primary}; font-size:11px; font-weight:bold; padding:6px 12px; border-radius:6px; text-decoration:none; font-family:Georgia,serif; text-align:center; border:1px solid ${brand.border};">View &#8594;</a>
                </div>
              </div>
            </div>
          `;
        });
        bodyContent += `</div>`;
      } else {
        bodyContent += `<p style="margin:0 0 20px; font-size:13px; color:${brand.muted}; font-style:italic; font-family:Georgia,serif;">No new documents uploaded ${frequency === "daily" ? "today" : "this week"}${docTypeFilter ? ` matching the selected type (${docTypeFilter})` : ""}.</p>`;
      }

      // ── ACTION ITEMS SECTION ──
      if (tasks && tasks.length > 0) {
        bodyContent += sectionHeader("Action Items", "&#9989;");
        bodyContent += `<div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin-bottom:14px;">`;
        tasks.forEach((t, idx) => {
          const priorityColor = t.priority === "high" ? brand.danger : t.priority === "medium" ? brand.warning : brand.muted;
          bodyContent += `
            <div style="padding:14px 20px; ${idx < tasks.length - 1 ? `border-bottom:1px solid rgba(217,208,197,0.4);` : ""}">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="flex:1;">
                  <p style="margin:0 0 4px; font-size:13px; color:${brand.foreground}; font-weight:bold; font-family:Georgia,serif;">&#9744;&nbsp; ${t.title}</p>
                  ${t.description ? `<p style="margin:0; font-size:12px; color:${brand.muted}; line-height:1.5; font-family:Georgia,serif;">${t.description}</p>` : ""}
                </div>
                <div style="text-align:right; margin-left:12px; flex-shrink:0;">
                  ${t.due_date ? `<p style="margin:0 0 4px; font-size:11px; color:${brand.muted}; font-family:Georgia,serif;">Due ${formatDate(t.due_date)}</p>` : ""}
                  <span style="font-size:10px; color:${priorityColor}; text-transform:uppercase; letter-spacing:0.08em; font-weight:bold; font-family:Georgia,serif;">${t.priority ?? "normal"} priority</span>
                </div>
              </div>
            </div>
          `;
        });
        bodyContent += `</div>`;
      }

      // ── INVOICE STATUS SECTION ──
      bodyContent += sectionHeader("Invoice Status", "&#128181;");
      if (invoices && invoices.length > 0) {
        const totalOwed = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + (i.amount - i.amount_paid), 0);
        const overdueInvoices = invoices.filter((i) => i.status === "overdue");

        if (overdueInvoices.length > 0) {
          bodyContent += `
            <div style="background-color:${brand.dangerLight}; border:1px solid #FECACA; border-radius:8px; padding:14px 18px; margin-bottom:14px;">
              <p style="margin:0; font-size:13px; color:${brand.danger}; font-weight:bold; font-family:Georgia,serif;">&#9888;&nbsp; You have ${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""}. Please review and pay at your earliest convenience.</p>
            </div>
          `;
        }

        bodyContent += `<div style="background-color:${brand.bgCard}; border:1px solid ${brand.border}; border-radius:10px; overflow:hidden; margin-bottom:14px;">`;
        bodyContent += `
          <div style="background-color:${brand.primary}; padding:10px 20px;">
            <p style="margin:0; font-size:11px; color:${brand.accent}; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; font-family: Georgia, serif;">Invoice Summary</p>
          </div>
          <div style="padding:0;">
            <table style="width:100%; border-collapse:collapse; font-family:Georgia,serif;">
              <thead>
                <tr style="background-color:#F9F6F1;">
                  <th style="padding:10px 16px; text-align:left; font-size:11px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.08em; border-bottom:1px solid ${brand.border};">Invoice #</th>
                  <th style="padding:10px 16px; text-align:left; font-size:11px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.08em; border-bottom:1px solid ${brand.border};">Due Date</th>
                  <th style="padding:10px 16px; text-align:right; font-size:11px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.08em; border-bottom:1px solid ${brand.border};">Amount</th>
                  <th style="padding:10px 16px; text-align:center; font-size:11px; color:${brand.muted}; text-transform:uppercase; letter-spacing:0.08em; border-bottom:1px solid ${brand.border};">Status</th>
                </tr>
              </thead>
              <tbody>
        `;
        invoices.forEach((inv, idx) => {
          bodyContent += `
            <tr style="${idx % 2 === 1 ? `background-color:#FDFBF8;` : ""}">
              <td style="padding:10px 16px; font-size:13px; color:${brand.foreground}; border-bottom:1px solid rgba(217,208,197,0.3);">${inv.invoice_number}</td>
              <td style="padding:10px 16px; font-size:13px; color:${brand.foreground}; border-bottom:1px solid rgba(217,208,197,0.3);">${formatDate(inv.due_date)}</td>
              <td style="padding:10px 16px; font-size:13px; color:${brand.foreground}; font-weight:bold; text-align:right; border-bottom:1px solid rgba(217,208,197,0.3);">${formatCurrency(inv.amount)}</td>
              <td style="padding:10px 16px; text-align:center; border-bottom:1px solid rgba(217,208,197,0.3);">${statusBadge(inv.status)}</td>
            </tr>
          `;
        });
        bodyContent += `</tbody></table></div>`;
        if (totalOwed > 0) {
          bodyContent += `
            <div style="padding:14px 20px; background-color:${brand.accentLight}; border-top:1px solid ${brand.border}; display:flex; justify-content:space-between; align-items:center;">
              <p style="margin:0; font-size:13px; color:${brand.primary}; font-weight:bold; font-family:Georgia,serif;">Total Outstanding Balance</p>
              <p style="margin:0; font-size:18px; color:${brand.primary}; font-weight:bold; font-family:Georgia,serif;">${formatCurrency(totalOwed)}</p>
            </div>
          `;
        }
        bodyContent += `</div>`;
      } else {
        bodyContent += `<p style="margin:0 0 20px; font-size:13px; color:${brand.muted}; font-style:italic; font-family:Georgia,serif;">No invoices on file for your active cases.</p>`;
      }

      // ── CTA ──
      bodyContent += `
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0 8px;">
          <tr>
            <td style="background-color:${brand.accent}; border-radius:7px; box-shadow: 0 2px 8px rgba(200,150,90,0.25); margin-right:12px;">
              <a href="${SITE_URL}/portal/dashboard" style="display:inline-block; padding:13px 28px; color:${brand.white}; text-decoration:none; font-size:13px; font-family: Georgia, serif; letter-spacing:0.05em; font-weight:bold;">View Your Portal &rarr;</a>
            </td>
          </tr>
        </table>
        ${signature()}
      `;

      const docsCount = recentDocs?.length ?? 0;
      const preheader = `Your ${frequency} case digest — ${clientCases.length} active case${clientCases.length > 1 ? "s" : ""}, ${docsCount} document${docsCount !== 1 ? "s" : ""}, ${invoices?.length ?? 0} invoice${(invoices?.length ?? 0) !== 1 ? "s" : ""}, ${allUpdates.length} update${allUpdates.length !== 1 ? "s" : ""}.`;
      const html = emailWrapper(bodyContent, preheader, digestLabel);

      const subject = frequency === "daily"
        ? `Your Daily Case Digest — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })} · Maggi May Broussard`
        : `Your Weekly Case Digest — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · Maggi May Broussard`;

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Maggi May Broussard <maggimay@broussardlegalservices.com>",
          to: [clientEmail],
          subject,
          html,
        }),
      });

      if (sendRes.ok) {
        sentCount++;
        try {
          await supabase.from("weekly_digest_logs").insert({
            client_email: clientEmail,
            client_name: clientName,
            cases_included: clientCases.length,
            invoices_included: invoices?.length ?? 0,
            updates_included: allUpdates.length,
            documents_included: docsCount,
            frequency,
            sent_at: new Date().toISOString(),
            status: "sent",
          });
        } catch {
          // Non-blocking
        }
      } else {
        const errBody = await sendRes.json().catch(() => ({}));
        errors.push(`${clientEmail}: ${errBody?.message ?? "Send failed"}`);
        try {
          await supabase.from("weekly_digest_logs").insert({
            client_email: clientEmail,
            client_name: clientName,
            cases_included: clientCases.length,
            invoices_included: invoices?.length ?? 0,
            updates_included: allUpdates.length,
            documents_included: docsCount,
            frequency,
            sent_at: new Date().toISOString(),
            status: "failed",
            error_message: errBody?.message ?? "Send failed",
          });
        } catch {
          // Non-blocking
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: clientMap.size,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
