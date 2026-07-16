import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

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
    const {
      clientEmail,
      clientName,
      invoiceNumber,
      issueDate,
      dueDate,
      firmName,
      firmEmail,
      firmPhone,
      matterRef,
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      totalDue,
      notes,
    } = await req.json();

    if (!clientEmail || !clientName || !invoiceNumber) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Format currency
    const fmtCurrency = (n: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

    // Format date
    const fmtDate = (d: string) => {
      if (!d) return "";
      return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    };

    // Build line items rows
    const lineItemsHtml = (lineItems || [])
      .map(
        (item: { date: string; description: string; workType: string; hours: number; rate: number; total: number }, idx: number) => `
        <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f9fafb"}">
          <td style="padding:10px 12px;font-size:12px;color:#4b5563;border-bottom:1px solid #f3f4f6;">${fmtDate(item.date)}</td>
          <td style="padding:10px 12px;font-size:12px;color:#1f2937;border-bottom:1px solid #f3f4f6;">${item.description}</td>
          <td style="padding:10px 12px;font-size:12px;color:#374151;text-align:center;border-bottom:1px solid #f3f4f6;font-family:monospace;">${Number(item.hours).toFixed(2)}</td>
          <td style="padding:10px 12px;font-size:12px;color:#374151;text-align:right;border-bottom:1px solid #f3f4f6;font-family:monospace;">${fmtCurrency(item.rate)}</td>
          <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;font-family:monospace;">${fmtCurrency(item.total)}</td>
        </tr>`
      )
      .join("");

    const taxRow =
      taxRate > 0
        ? `<tr><td colspan="4" style="padding:6px 12px;font-size:12px;color:#6b7280;text-align:right;">Tax (${taxRate}%)</td><td style="padding:6px 12px;font-size:12px;color:#6b7280;text-align:right;font-family:monospace;">${fmtCurrency(taxAmount)}</td></tr>`
        : "";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:#1f2937;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${firmName}</p>
                  ${firmEmail ? `<p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">${firmEmail}</p>` : ""}
                  ${firmPhone ? `<p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">${firmPhone}</p>` : ""}
                </td>
                <td align="right">
                  <p style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">INVOICE</p>
                  <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#d1d5db;">${invoiceNumber}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Invoice Meta -->
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" valign="top">
                  <p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Bill To</p>
                  <p style="margin:0;font-size:15px;font-weight:700;color:#111827;">${clientName}</p>
                  <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${clientEmail}</p>
                  ${matterRef ? `<p style="margin:8px 0 0;font-size:11px;color:#6b7280;">Matter: ${matterRef}</p>` : ""}
                </td>
                <td width="50%" align="right" valign="top">
                  <table cellpadding="0" cellspacing="0" align="right">
                    <tr>
                      <td style="padding:3px 8px;font-size:11px;color:#6b7280;text-align:right;">Issue Date</td>
                      <td style="padding:3px 0;font-size:11px;font-weight:600;color:#1f2937;">${fmtDate(issueDate)}</td>
                    </tr>
                    <tr>
                      <td style="padding:3px 8px;font-size:11px;color:#6b7280;text-align:right;">Due Date</td>
                      <td style="padding:3px 0;font-size:11px;font-weight:600;color:#dc2626;">${fmtDate(dueDate)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Line Items -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
              <thead>
                <tr style="background:#1f2937;">
                  <th style="padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#ffffff;text-align:left;">Date</th>
                  <th style="padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#ffffff;text-align:left;">Description</th>
                  <th style="padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#ffffff;text-align:center;">Hrs</th>
                  <th style="padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#ffffff;text-align:right;">Rate</th>
                  <th style="padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#ffffff;text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${lineItemsHtml}
              </tbody>
              <tfoot>
                <tr><td colspan="4" style="padding:8px 12px;font-size:12px;color:#6b7280;text-align:right;border-top:1px solid #e5e7eb;">Subtotal</td><td style="padding:8px 12px;font-size:12px;color:#374151;text-align:right;font-family:monospace;border-top:1px solid #e5e7eb;">${fmtCurrency(subtotal)}</td></tr>
                ${taxRow}
                <tr style="background:#f9fafb;"><td colspan="4" style="padding:12px;font-size:14px;font-weight:700;color:#111827;text-align:right;border-top:2px solid #1f2937;">Total Due</td><td style="padding:12px;font-size:14px;font-weight:700;color:#111827;text-align:right;font-family:monospace;border-top:2px solid #1f2937;">${fmtCurrency(totalDue)}</td></tr>
              </tfoot>
            </table>
          </td>
        </tr>

        ${
          notes
            ? `<tr><td style="padding:0 32px 24px;"><div style="background:#f9fafb;border-radius:8px;padding:16px;border:1px solid #e5e7eb;"><p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Notes & Payment Terms</p><p style="margin:0;font-size:12px;color:#4b5563;line-height:1.6;">${notes.replace(/\n/g, "<br>")}</p></div></td></tr>`
            : ""
        }

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">Thank you for your business. Please remit payment by ${fmtDate(dueDate)}.</p>
            <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">${firmName} · ${firmEmail}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [clientEmail],
        subject: `Invoice ${invoiceNumber} from ${firmName} — Due ${fmtDate(dueDate)}`,
        html: htmlBody,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.json().catch(() => ({}));
      throw new Error(errBody?.message ?? `Resend returned ${resendRes.status}`);
    }

    const resendData = await resendRes.json();

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to send invoice email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
});
