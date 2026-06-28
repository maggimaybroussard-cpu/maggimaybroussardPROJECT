import { NextRequest, NextResponse } from 'next/server';

type AlertType = 'new_submission' | 'new_lead' | 'urgent_task' | 'overdue_invoice' | 'new_message';

interface AlertPayload {
  type: AlertType;
  subject?: string;
  clientName?: string;
  clientEmail?: string;
  service?: string;
  message?: string;
  taskTitle?: string;
  dueDate?: string;
  invoiceAmount?: string;
  invoiceNumber?: string;
}

const ALERT_TEMPLATES: Record<AlertType, (p: AlertPayload) => { subject: string; html: string }> = {
  new_submission: (p) => ({
    subject: `📥 New Submission: ${p.clientName ?? 'Unknown'} — Broussard Legal`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:8px;">
        <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
            <div style="width:40px;height:40px;background:#355E3B;border-radius:10px;display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-size:18px;">📥</span>
            </div>
            <div>
              <h2 style="color:#1f2937;margin:0;font-size:18px;">New Form Submission</h2>
              <p style="color:#6b7280;margin:0;font-size:13px;">Broussard Legal Services Admin Alert</p>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:120px;">Client</td><td style="padding:8px 0;color:#1f2937;font-size:13px;font-weight:600;">${p.clientName ?? '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Email</td><td style="padding:8px 0;color:#1f2937;font-size:13px;">${p.clientEmail ?? '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Service</td><td style="padding:8px 0;color:#1f2937;font-size:13px;">${p.service ?? '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Submitted</td><td style="padding:8px 0;color:#1f2937;font-size:13px;">${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td></tr>
          </table>
          ${p.message ? `<div style="background:#f3f4f6;border-radius:8px;padding:16px;margin-bottom:20px;"><p style="color:#374151;font-size:13px;margin:0;line-height:1.6;">${p.message}</p></div>` : ''}
          <a href="https://broussardlegalservices.com/admin" style="display:inline-block;background:#355E3B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">View in Admin Panel →</a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;margin:0;">Broussard Legal Services · Admin Alert System</p>
        </div>
      </div>
    `,
  }),
  new_lead: (p) => ({
    subject: `🎯 New Lead: ${p.clientName ?? 'Unknown'} — ${p.service ?? 'General Inquiry'}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:8px;">
        <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb;">
          <h2 style="color:#1f2937;margin:0 0 16px;">🎯 New Lead Received</h2>
          <p style="color:#4b5563;margin:0 0 16px;font-size:14px;"><strong>${p.clientName}</strong> submitted an inquiry for <strong>${p.service ?? 'legal services'}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:100px;">Email</td><td style="padding:6px 0;color:#1f2937;font-size:13px;">${p.clientEmail ?? '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Service</td><td style="padding:6px 0;color:#1f2937;font-size:13px;">${p.service ?? '—'}</td></tr>
          </table>
          <a href="https://broussardlegalservices.com/admin" style="display:inline-block;background:#355E3B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">Review Lead →</a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;margin:0;">Broussard Legal Services · Admin Alert System</p>
        </div>
      </div>
    `,
  }),
  urgent_task: (p) => ({
    subject: `⚠️ Urgent Task Due: ${p.taskTitle ?? 'Task'} — Broussard Legal`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:8px;">
        <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb;">
          <h2 style="color:#dc2626;margin:0 0 16px;">⚠️ Urgent Task Reminder</h2>
          <p style="color:#4b5563;margin:0 0 16px;font-size:14px;">A high-priority task requires your immediate attention.</p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px;">
            <p style="color:#991b1b;font-weight:600;margin:0 0 8px;font-size:14px;">${p.taskTitle ?? 'Urgent Task'}</p>
            <p style="color:#dc2626;margin:0;font-size:13px;">Due: ${p.dueDate ?? 'ASAP'}</p>
          </div>
          <a href="https://broussardlegalservices.com/admin" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">View Task →</a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;margin:0;">Broussard Legal Services · Admin Alert System</p>
        </div>
      </div>
    `,
  }),
  overdue_invoice: (p) => ({
    subject: `💰 Overdue Invoice Alert: ${p.invoiceNumber ?? ''} — Broussard Legal`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:8px;">
        <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb;">
          <h2 style="color:#d97706;margin:0 0 16px;">💰 Overdue Invoice Alert</h2>
          <p style="color:#4b5563;margin:0 0 16px;font-size:14px;">An invoice is overdue and requires follow-up.</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:120px;">Invoice</td><td style="padding:6px 0;color:#1f2937;font-size:13px;font-weight:600;">${p.invoiceNumber ?? '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Client</td><td style="padding:6px 0;color:#1f2937;font-size:13px;">${p.clientName ?? '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Amount</td><td style="padding:6px 0;color:#1f2937;font-size:13px;font-weight:600;">${p.invoiceAmount ?? '—'}</td></tr>
          </table>
          <a href="https://broussardlegalservices.com/admin" style="display:inline-block;background:#d97706;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">View Invoice →</a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;margin:0;">Broussard Legal Services · Admin Alert System</p>
        </div>
      </div>
    `,
  }),
  new_message: (p) => ({
    subject: `💬 New Client Message from ${p.clientName ?? 'Client'} — Broussard Legal`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:8px;">
        <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #e5e7eb;">
          <h2 style="color:#1f2937;margin:0 0 16px;">💬 New Client Message</h2>
          <p style="color:#4b5563;margin:0 0 16px;font-size:14px;"><strong>${p.clientName ?? 'A client'}</strong> sent you a message in the portal.</p>
          ${p.message ? `<div style="background:#f3f4f6;border-radius:8px;padding:16px;margin-bottom:20px;border-left:3px solid #355E3B;"><p style="color:#374151;font-size:13px;margin:0;line-height:1.6;">"${p.message}"</p></div>` : ''}
          <a href="https://broussardlegalservices.com/admin" style="display:inline-block;background:#355E3B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">Reply in Admin →</a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;margin:0;">Broussard Legal Services · Admin Alert System</p>
        </div>
      </div>
    `,
  }),
};

export async function POST(req: NextRequest) {
  try {
    const body: AlertPayload = await req.json();
    const { type } = body;

    if (!type || !ALERT_TEMPLATES[type]) {
      return NextResponse.json({ error: 'Invalid or missing alert type' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'maggimay@broussardremotelegalservices.com';

    const { subject, html } = ALERT_TEMPLATES[type](body);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Broussard Legal Admin <onboarding@resend.dev>',
        to: [ADMIN_EMAIL],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.message || `Resend error: ${response.status}` }, { status: response.status });
    }

    return NextResponse.json({ success: true, id: data.id, type, sentTo: ADMIN_EMAIL });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
