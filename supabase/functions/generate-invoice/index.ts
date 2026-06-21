import { PDFDocument, StandardFonts, rgb, PageSizes } from 'https://esm.sh/pdf-lib@1.17.1';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = "https://broussardlegalservices.com";

const brand = {
  bg: "#FAF7F2",
  primary: "#4A3728",
  accent: "#C8965A",
  accentLight: "#F5EDE0",
  foreground: "#2C1F14",
  muted: "#7A6B5D",
  border: "#D9D0C5",
  secondary: "#EDE8E0",
  white: "#FFFFFF",
  success: "#2d6a4f",
};

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientName: string;
  clientEmail: string;
  paymentType: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  items: InvoiceItem[];
  notes?: string;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

function getPaymentTypeLabel(paymentType: string): string {
  if (paymentType === 'consultation_deposit') return 'Consultation Deposit';
  if (paymentType === 'retainer_agreement') return 'Retainer Agreement';
  return paymentType ?? 'Legal Services';
}

async function generateInvoicePDF(data: InvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(PageSizes.Letter);

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const { width, height } = page.getSize();
  const margin = 50;
  const contentWidth = width - margin * 2;

  const accentBrown = rgb(0.784, 0.588, 0.353);  // #C8965A
  const primaryBrown = rgb(0.290, 0.216, 0.157);  // #4A3728
  const lightGray = rgb(0.96, 0.93, 0.88);        // warm light
  const mediumGray = rgb(0.478, 0.42, 0.365);     // #7A6B5D
  const white = rgb(1, 1, 1);
  const green = rgb(0.176, 0.416, 0.31);

  // ─── LETTERHEAD IMAGE ──────────────────────────────────────────────────────
  // Attempt to embed the letterhead image at the top of the page
  let headerHeight = 100;
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://maggimaybr6854.builtwithrocket.new';
    const letterheadUrl = `${SUPABASE_URL}/assets/images/letterhead-1780100512052.png`;
    const letterheadRes = await fetch(letterheadUrl);
    if (letterheadRes.ok) {
      const letterheadBytes = await letterheadRes.arrayBuffer();
      const letterheadImg = await pdfDoc.embedPng(new Uint8Array(letterheadBytes));
      const imgDims = letterheadImg.scaleToFit(width, 120);
      headerHeight = imgDims.height;
      page.drawImage(letterheadImg, {
        x: 0,
        y: height - imgDims.height,
        width: imgDims.width,
        height: imgDims.height,
      });
    } else {
      throw new Error('Letterhead fetch failed');
    }
  } catch {
    // Fallback: draw the original dark header band
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width,
      height: 100,
      color: primaryBrown,
    });
    page.drawText('MAGGI MAY BROUSSARD', {
      x: margin,
      y: height - 42,
      size: 18,
      font: helveticaBold,
      color: white,
    });
    page.drawText('LEGAL SERVICES', {
      x: margin,
      y: height - 62,
      size: 11,
      font: helvetica,
      color: rgb(0.95, 0.9, 0.82),
    });
    page.drawText('INVOICE', {
      x: width - margin - 90,
      y: height - 50,
      size: 28,
      font: helveticaBold,
      color: white,
    });
    headerHeight = 100;
  }

  // Accent line under header
  page.drawLine({
    start: { x: margin, y: height - headerHeight - 4 },
    end: { x: width - margin, y: height - headerHeight - 4 },
    thickness: 1.5,
    color: accentBrown,
  });

  let y = height - headerHeight - 20;

  // ─── INVOICE META ──────────────────────────────────────────────────────────
  page.drawText('BILL TO', {
    x: margin,
    y: y,
    size: 8,
    font: helveticaBold,
    color: accentBrown,
  });
  page.drawText(data.clientName, {
    x: margin,
    y: y - 16,
    size: 11,
    font: helveticaBold,
    color: rgb(0.173, 0.122, 0.078),
  });
  page.drawText(data.clientEmail, {
    x: margin,
    y: y - 30,
    size: 9,
    font: helvetica,
    color: mediumGray,
  });

  const rightCol = width - margin - 180;
  const labelX = rightCol;
  const valueX = rightCol + 90;

  const metaRows = [
    ['Invoice No:', data.invoiceNumber],
    ['Invoice Date:', data.invoiceDate],
    ['Due Date:', data.dueDate],
    ['Status:', 'PAID'],
  ];

  metaRows.forEach(([label, value], i) => {
    const rowY = y - i * 16;
    page.drawText(label, { x: labelX, y: rowY, size: 9, font: helveticaBold, color: mediumGray });
    page.drawText(value, {
      x: valueX,
      y: rowY,
      size: 9,
      font: i === 3 ? helveticaBold : helvetica,
      color: i === 3 ? green : rgb(0.173, 0.122, 0.078),
    });
  });

  y -= 70;

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.5,
    color: rgb(0.85, 0.82, 0.78),
  });

  y -= 20;

  // ─── ITEMS TABLE HEADER ────────────────────────────────────────────────────
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: contentWidth,
    height: 22,
    color: lightGray,
  });

  const col1 = margin + 8;
  const col2 = margin + contentWidth * 0.55;
  const col3 = margin + contentWidth * 0.7;
  const col4 = margin + contentWidth * 0.85;

  page.drawText('DESCRIPTION', { x: col1, y: y + 4, size: 8, font: helveticaBold, color: accentBrown });
  page.drawText('QTY', { x: col2, y: y + 4, size: 8, font: helveticaBold, color: accentBrown });
  page.drawText('UNIT PRICE', { x: col3, y: y + 4, size: 8, font: helveticaBold, color: accentBrown });
  page.drawText('TOTAL', { x: col4, y: y + 4, size: 8, font: helveticaBold, color: accentBrown });

  y -= 24;

  // ─── ITEMS ─────────────────────────────────────────────────────────────────
  data.items.forEach((item, idx) => {
    if (idx % 2 === 1) {
      page.drawRectangle({ x: margin, y: y - 4, width: contentWidth, height: 20, color: rgb(0.99, 0.97, 0.94) });
    }
    page.drawText(item.description, { x: col1, y: y + 2, size: 9, font: helvetica, color: rgb(0.173, 0.122, 0.078) });
    page.drawText(String(item.quantity), { x: col2, y: y + 2, size: 9, font: helvetica, color: rgb(0.173, 0.122, 0.078) });
    page.drawText(formatCurrency(item.unitPrice, data.currency), { x: col3, y: y + 2, size: 9, font: helvetica, color: rgb(0.173, 0.122, 0.078) });
    page.drawText(formatCurrency(item.total, data.currency), { x: col4, y: y + 2, size: 9, font: helveticaBold, color: rgb(0.173, 0.122, 0.078) });
    y -= 22;
  });

  y -= 8;

  page.drawLine({ start: { x: col3 - 10, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.85, 0.82, 0.78) });
  y -= 14;

  page.drawText('Subtotal:', { x: col3 - 10, y, size: 9, font: helvetica, color: mediumGray });
  page.drawText(formatCurrency(data.amount, data.currency), { x: col4, y, size: 9, font: helvetica, color: rgb(0.173, 0.122, 0.078) });
  y -= 14;

  page.drawText('Tax (0%):', { x: col3 - 10, y, size: 9, font: helvetica, color: mediumGray });
  page.drawText(formatCurrency(0, data.currency), { x: col4, y, size: 9, font: helvetica, color: rgb(0.173, 0.122, 0.078) });
  y -= 8;

  // Total band
  page.drawRectangle({ x: col3 - 14, y: y - 6, width: width - margin - (col3 - 14), height: 26, color: accentBrown });
  page.drawText('TOTAL DUE:', { x: col3 - 8, y: y + 4, size: 10, font: helveticaBold, color: white });
  page.drawText(formatCurrency(data.amount, data.currency), { x: col4, y: y + 4, size: 10, font: helveticaBold, color: white });

  y -= 40;

  // ─── PAYMENT INFO ──────────────────────────────────────────────────────────
  page.drawRectangle({ x: margin, y: y - 50, width: contentWidth, height: 60, color: lightGray, borderColor: rgb(0.85, 0.82, 0.78), borderWidth: 0.5 });

  page.drawText('PAYMENT INFORMATION', { x: margin + 12, y: y - 10, size: 8, font: helveticaBold, color: accentBrown });
  page.drawText(`Payment Method: Credit / Debit Card (Stripe)`, { x: margin + 12, y: y - 24, size: 9, font: helvetica, color: rgb(0.173, 0.122, 0.078) });
  page.drawText(`Transaction ID: ${data.paymentIntentId}`, { x: margin + 12, y: y - 38, size: 8, font: helveticaOblique, color: mediumGray });

  y -= 70;

  if (data.notes) {
    page.drawText('NOTES', { x: margin, y, size: 8, font: helveticaBold, color: accentBrown });
    page.drawText(data.notes, { x: margin, y: y - 14, size: 9, font: helvetica, color: rgb(0.173, 0.122, 0.078) });
    y -= 40;
  }

  // ─── FOOTER IMAGE ──────────────────────────────────────────────────────────
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://maggimaybr6854.builtwithrocket.new';
    const footerUrl = `${SUPABASE_URL}/assets/images/footer-1780100663536.png`;
    const footerRes = await fetch(footerUrl);
    if (footerRes.ok) {
      const footerBytes = await footerRes.arrayBuffer();
      const footerImg = await pdfDoc.embedPng(new Uint8Array(footerBytes));
      const footerDims = footerImg.scaleToFit(width, 80);
      page.drawImage(footerImg, {
        x: 0,
        y: 0,
        width: footerDims.width,
        height: footerDims.height,
      });
    } else {
      throw new Error('Footer fetch failed');
    }
  } catch {
    // Fallback: draw the original text footer
    page.drawLine({ start: { x: margin, y: 60 }, end: { x: width - margin, y: 60 }, thickness: 0.5, color: rgb(0.85, 0.82, 0.78) });
    page.drawText('Thank you for your business. This invoice was generated automatically upon payment confirmation.', {
      x: margin, y: 46, size: 8, font: helveticaOblique, color: mediumGray,
    });
    page.drawText('Maggi May Broussard Legal Services  |  broussardlegalservices.com', {
      x: margin, y: 32, size: 8, font: helvetica, color: mediumGray,
    });
  }

  return pdfDoc.save();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      clientEmail,
      clientName,
      // portal download uses these aliases
      customerEmail,
      customerName,
      paymentIntentId,
      paymentType,
      amount,
      currency = 'usd',
      description,
      returnPdf,
      createdAt,
      // ── Retainer invoice overrides ──────────────────────────────────────────
      items: itemsOverride,       // pre-built itemized line items array
      invoiceNumber: invoiceNumberOverride, // pre-built invoice number
    } = body;

    const resolvedEmail = clientEmail || customerEmail;
    const resolvedName = clientName || customerName;

    if (!resolvedEmail && !returnPdf) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: clientEmail, paymentIntentId, amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!paymentIntentId || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: paymentIntentId, amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentTypeLabel = getPaymentTypeLabel(paymentType);
    const invoiceNumber = invoiceNumberOverride || `INV-${paymentIntentId.slice(-8).toUpperCase()}`;
    const now = createdAt ? new Date(createdAt) : new Date();
    const invoiceDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const dueDate = invoiceDate;

    // Use caller-supplied itemized line items if provided, otherwise build default
    let items: InvoiceItem[];
    if (itemsOverride && Array.isArray(itemsOverride) && itemsOverride.length > 0) {
      items = itemsOverride as InvoiceItem[];
    } else {
      items = [
        {
          description: description || paymentTypeLabel,
          quantity: 1,
          unitPrice: Number(amount),
          total: Number(amount),
        },
      ];

      if (paymentType === 'retainer_agreement' || paymentType === 'retainer') {
        items[0].description = 'Retainer Agreement – Legal Services';
      } else if (paymentType === 'consultation_deposit') {
        items[0].description = 'Initial Consultation Deposit – Legal Services';
      }
    }

    const invoiceData: InvoiceData = {
      invoiceNumber,
      invoiceDate,
      dueDate,
      clientName: resolvedName || 'Valued Client',
      clientEmail: resolvedEmail || '',
      paymentType,
      paymentIntentId,
      amount: Number(amount),
      currency,
      items,
      notes: 'Payment received in full. No further action required. Please retain this invoice for your records.',
    };

    const pdfBytes = await generateInvoicePDF(invoiceData);

    // ── Return PDF directly for portal downloads ──────────────────────────────
    if (returnPdf) {
      return new Response(pdfBytes, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Invoice-${invoiceNumber}.pdf"`,
        },
      });
    }

    // ── Email flow ────────────────────────────────────────────────────────────
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');

    const base64Pdf = btoa(String.fromCharCode(...pdfBytes));
    const amountFormatted = formatCurrency(Number(amount), currency);

    // ── Branded HTML email ──
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0; padding:0; background-color:${brand.secondary}; font-family:Georgia,'Times New Roman',serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${brand.secondary}; padding:32px 16px;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:${brand.bg}; border-radius:12px; overflow:hidden; border:1px solid ${brand.border};">
              <!-- Header -->
              <tr>
                <td style="background-color:${brand.primary}; padding:28px 36px 24px;">
                  <p style="margin:0 0 4px; font-size:11px; color:${brand.accent}; letter-spacing:0.12em; text-transform:uppercase;">Maggi May Broussard</p>
                  <h1 style="margin:0; font-size:22px; color:${brand.white}; font-weight:normal; letter-spacing:-0.01em;">Legal Services</h1>
                  <div style="margin-top:16px; height:1px; background:linear-gradient(to right,${brand.accent},transparent);"></div>
                </td>
              </tr>
              <!-- Badge + Title -->
              <tr>
                <td style="padding:32px 36px 0;">
                  <span style="display:inline-block; background-color:${brand.accent}; color:${brand.white}; font-size:11px; font-weight:bold; letter-spacing:0.1em; text-transform:uppercase; padding:4px 14px; border-radius:20px; margin-bottom:20px;">Invoice Attached</span>
                  <h2 style="margin:0 0 20px; font-size:20px; color:${brand.foreground}; font-weight:normal; border-bottom:1px solid ${brand.border}; padding-bottom:16px;">Invoice &amp; Billing Statement</h2>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:0 36px 32px;">
                  <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.75;">Dear ${resolvedName || 'Valued Client'},</p>
                  <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.75;">
                    Thank you for your payment. Please find your invoice and billing statement attached to this email as a PDF document.
                  </p>
                  <!-- Invoice Summary Box -->
                  <div style="background-color:${brand.accentLight}; border-left:3px solid ${brand.accent}; padding:16px 20px; border-radius:6px; margin:20px 0;">
                    <table style="width:100%; border-collapse:collapse; font-size:14px; color:${brand.foreground}; font-family:Georgia,serif;">
                      <tr>
                        <td style="padding:6px 0; color:${brand.muted}; width:40%;">Invoice Number</td>
                        <td style="padding:6px 0; font-weight:bold;">${invoiceNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0; color:${brand.muted};">Service</td>
                        <td style="padding:6px 0; font-weight:bold;">${paymentTypeLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0; color:${brand.muted};">Amount Paid</td>
                        <td style="padding:6px 0; font-weight:bold; font-size:20px; color:${brand.success};">${amountFormatted}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0; color:${brand.muted};">Date</td>
                        <td style="padding:6px 0;">${invoiceDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0; color:${brand.muted};">Status</td>
                        <td style="padding:6px 0; font-weight:bold; color:${brand.success};">PAID IN FULL</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0; color:${brand.muted};">Transaction ID</td>
                        <td style="padding:6px 0; font-size:12px; color:${brand.muted};">${paymentIntentId}</td>
                      </tr>
                    </table>
                  </div>
                  <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.75;">
                    Your itemized invoice is attached as a PDF. You can also view your full payment history in your 
                    <a href="${SITE_URL}/portal/login" style="color:${brand.accent}; text-decoration:none;">client portal</a>.
                  </p>
                  <!-- CTA -->
                  <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
                    <tr>
                      <td style="background-color:${brand.accent}; border-radius:6px;">
                        <a href="${SITE_URL}/portal/login" style="display:inline-block; padding:13px 32px; color:${brand.white}; text-decoration:none; font-size:14px; font-family:Georgia,serif; letter-spacing:0.04em; font-weight:bold;">View in Client Portal</a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 16px; font-size:15px; color:${brand.foreground}; line-height:1.75;">
                    If you have any questions about this invoice, please don't hesitate to reach out.
                  </p>
                  <p style="margin:0; font-size:15px; color:${brand.foreground}; line-height:1.75;">
                    Warm regards,<br/>
                    <strong>Maggi May Broussard</strong><br/>
                    <span style="color:${brand.muted}; font-size:13px;">Legal Services · Louisiana &amp; Nationwide</span>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color:${brand.secondary}; padding:20px 36px; border-top:1px solid ${brand.border};">
                  <p style="margin:0; font-size:11px; color:${brand.muted}; line-height:1.6;">
                    You are receiving this email because you completed a payment with Maggi May Broussard Legal Services.
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: [resolvedEmail],
        subject: `Invoice ${invoiceNumber} – ${paymentTypeLabel} (${amountFormatted})`,
        html: emailHtml,
        attachments: [
          {
            filename: `Invoice-${invoiceNumber}.pdf`,
            content: base64Pdf,
          },
        ],
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.json();
      throw new Error(errBody.message || 'Resend API error');
    }

    const resendData = await resendRes.json();

    // ── Also fire invoice_issued notification via notify-client (non-blocking) ──
    // This sends a portal-linked notification in addition to the PDF email
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && resolvedEmail && !returnPdf) {
        const nowIso = now.toISOString().split('T')[0];
        await fetch(`${SUPABASE_URL}/functions/v1/notify-client`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            clientEmail: resolvedEmail,
            clientName: resolvedName || 'Valued Client',
            eventType: 'invoice_issued',
            details: {
              invoiceNumber,
              invoiceDate: nowIso,
              dueDate: nowIso,
              amount: Number(amount),
              currency,
              lineItems: items,
            },
          }),
        });
      }
    } catch {
      // Non-blocking — PDF email already sent
    }

    return new Response(
      JSON.stringify({ success: true, invoiceNumber, emailId: resendData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invoice generation failed';
    console.error('generate-invoice error:', e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
