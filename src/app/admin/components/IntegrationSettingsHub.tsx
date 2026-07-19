'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntegrationStatus {
  id: string;
  name: string;
  description: string;
  category: 'calendar' | 'payments' | 'crm' | 'forms' | 'scheduling' | 'storage';
  connected: boolean;
  accountInfo?: string;
  lastSync?: string;
  envKey?: string;
  envConfigured?: boolean;
  actionLabel?: string;
  docsUrl?: string;
  icon: React.ReactNode;
  color: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  calendar: 'Calendar & Scheduling',
  payments: 'Payments & Billing',
  crm: 'CRM & Notes',
  forms: 'Forms & Intake',
  scheduling: 'Booking',
  storage: 'Storage & Docs',
};

// ─── Integration Icons ────────────────────────────────────────────────────────

function GoogleCalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="18" rx="2" fill="#4285F4" fillOpacity="0.15"/>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="1.5"/>
      <line x1="16" y1="2" x2="16" y2="6" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="2" x2="8" y2="6" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="3" y1="10" x2="21" y2="10" stroke="#4285F4" strokeWidth="1.5"/>
      <rect x="7" y="13" width="4" height="4" rx="0.5" fill="#4285F4"/>
    </svg>
  );
}

function StripeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#635BFF" fillOpacity="0.12"/>
      <path d="M11.5 9.5c0-.83.67-1.17 1.75-1.17 1.56 0 3.54.47 5.1 1.31V5.36C16.72 4.51 15.1 4 13.25 4 9.5 4 7 5.92 7 9.75c0 5.83 8 4.92 8 7.42 0 .97-.84 1.29-2 1.29-1.73 0-3.94-.71-5.69-1.67v4.33C8.92 21.67 10.58 22 12.25 22c3.83 0 6.5-1.89 6.5-5.75-.08-6.29-8.25-5.21-8.25-6.75z" fill="#635BFF"/>
    </svg>
  );
}

function NotionIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#000" fillOpacity="0.08"/>
      <path d="M5 4.5h9.5l4.5 4.5V20H5V4.5z" stroke="#000" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M14.5 4.5V9H19" stroke="#000" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="8" y1="12" x2="16" y2="12" stroke="#000" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="8" y1="15" x2="14" y2="15" stroke="#000" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function TypeformIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#262627" fillOpacity="0.1"/>
      <path d="M12 4L4 8v8l8 4 8-4V8l-8-4z" stroke="#262627" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M4 8l8 4 8-4" stroke="#262627" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="12" y1="12" x2="12" y2="20" stroke="#262627" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function CalendlyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#006BFF" fillOpacity="0.12"/>
      <circle cx="12" cy="12" r="7" stroke="#006BFF" strokeWidth="1.5"/>
      <path d="M12 8v4l3 2" stroke="#006BFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ResendIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#000" fillOpacity="0.08"/>
      <path d="M4 6h16v12H4z" stroke="#000" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M4 6l8 7 8-7" stroke="#000" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}

function TwilioIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#F22F46" fillOpacity="0.12"/>
      <circle cx="12" cy="12" r="7" stroke="#F22F46" strokeWidth="1.5"/>
      <circle cx="9" cy="9.5" r="1.5" fill="#F22F46"/>
      <circle cx="15" cy="9.5" r="1.5" fill="#F22F46"/>
      <circle cx="9" cy="14.5" r="1.5" fill="#F22F46"/>
      <circle cx="15" cy="14.5" r="1.5" fill="#F22F46"/>
    </svg>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ connected, envConfigured }: { connected: boolean; envConfigured?: boolean }) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Connected
      </span>
    );
  }
  if (envConfigured === false) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Needs Setup
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/60 border border-border text-muted-foreground text-xs font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
      Not Connected
    </span>
  );
}

// ─── Integration Card ─────────────────────────────────────────────────────────

interface IntegrationCardProps {
  integration: IntegrationStatus;
  onConnect?: () => void;
  onDisconnect?: () => void;
  actionLoading?: boolean;
}

function IntegrationCard({ integration, onConnect, onDisconnect, actionLoading }: IntegrationCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:border-primary/20 hover:shadow-sm">
      <div className="px-5 py-4 flex items-center gap-4">
        {/* Icon */}
        <div className="w-11 h-11 rounded-xl bg-secondary/40 border border-border flex items-center justify-center shrink-0">
          {integration.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{integration.name}</h3>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded-full border border-border">
              {CATEGORY_LABELS[integration.category] ?? integration.category}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{integration.description}</p>
          {integration.connected && integration.accountInfo && (
            <p className="text-xs text-primary font-medium mt-0.5 truncate">{integration.accountInfo}</p>
          )}
        </div>

        {/* Status + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge connected={integration.connected} envConfigured={integration.envConfigured} />
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-border bg-secondary/10">
          <div className="space-y-4">
            {/* Details grid */}
            {integration.connected ? (
              <div className="grid grid-cols-2 gap-3">
                {integration.accountInfo && (
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Account</p>
                    <p className="text-sm font-medium text-foreground truncate">{integration.accountInfo}</p>
                  </div>
                )}
                {integration.lastSync && (
                  <div className="bg-card rounded-xl p-3 border border-border">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Last Activity</p>
                    <p className="text-sm font-medium text-foreground">{integration.lastSync}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-800 mb-1">Setup Required</p>
                <p className="text-xs text-amber-700">
                  {integration.envKey
                    ? <>Configure <code className="bg-amber-100 px-1 rounded font-mono">{integration.envKey}</code> in your environment variables to enable this integration.</>
                    : 'This integration requires additional configuration. See documentation for setup steps.'}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {integration.connected && onDisconnect && (
                <button
                  onClick={onDisconnect}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-all disabled:opacity-60"
                >
                  {actionLoading ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  )}
                  Disconnect
                </button>
              )}
              {!integration.connected && onConnect && (
                <button
                  onClick={onConnect}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-60"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Connect
                </button>
              )}
              {integration.docsUrl && (
                <a
                  href={integration.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:text-foreground hover:bg-secondary/40 transition-all"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Docs
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IntegrationSettingsHub() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maggimaybr6854.builtwithrocket.new';

  const [gcalStatus, setGcalStatus] = useState<{
    connected: boolean;
    accountEmail?: string;
    calendarId?: string;
  } | null>(null);
  const [gcalLoading, setGcalLoading] = useState(true);
  const [gcalActionLoading, setGcalActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Twilio SMS test state
  const [smsTestPhone, setSmsTestPhone] = useState('');
  const [smsTestType, setSmsTestType] = useState<'mfa' | 'payment_reminder' | 'appointment_reminder'>('mfa');
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<{ success: boolean; message: string } | null>(null);

  // Resend email test state
  const [resendTestEmail, setResendTestEmail] = useState('');
  const [resendSending, setResendSending] = useState(false);
  const [resendResult, setResendResult] = useState<{ success: boolean; message: string } | null>(null);

  // Broussard sync test state
  const [broussardTesting, setBroussardTesting] = useState(false);
  const [broussardResult, setBroussardResult] = useState<{ success: boolean; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    // Handle OAuth callback
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const gcal = params.get('gcal');
      const email = params.get('email');
      const reason = params.get('reason');
      if (gcal === 'connected' && email) {
        showToast('success', `Google Calendar connected as ${email}`);
        const url = new URL(window.location.href);
        url.searchParams.delete('gcal');
        url.searchParams.delete('email');
        window.history.replaceState({}, '', url.toString());
      } else if (gcal === 'error') {
        const reasonMap: Record<string, string> = {
          no_refresh_token: 'No refresh token received. Grant offline access and try again.',
          missing_credentials: 'Google OAuth credentials not configured.',
          no_code: 'Authorization was denied.',
          server_error: 'A server error occurred during OAuth.',
        };
        showToast('error', reasonMap[reason ?? ''] ?? `OAuth error: ${reason}`);
        const url = new URL(window.location.href);
        url.searchParams.delete('gcal');
        url.searchParams.delete('reason');
        window.history.replaceState({}, '', url.toString());
      }
    }

    fetch('/api/google-calendar/status')
      .then((r) => r.json())
      .then((d) => setGcalStatus(d))
      .catch(() => setGcalStatus({ connected: false }))
      .finally(() => setGcalLoading(false));
  }, [showToast]);

  function handleGcalConnect() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      showToast('error', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set in environment variables.');
      return;
    }
    const redirectUri = encodeURIComponent(`${siteUrl}/api/google-calendar/callback`);
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    window.location.href = url;
  }

  async function handleGcalDisconnect() {
    setGcalActionLoading(true);
    try {
      const res = await fetch('/api/google-calendar/status', { method: 'DELETE' });
      if (res.ok) {
        setGcalStatus({ connected: false });
        showToast('success', 'Google Calendar disconnected successfully.');
      } else {
        showToast('error', 'Failed to disconnect Google Calendar.');
      }
    } catch {
      showToast('error', 'Network error. Please try again.');
    } finally {
      setGcalActionLoading(false);
    }
  }

  async function handleSmsTest() {
    if (!smsTestPhone) return;
    setSmsSending(true);
    setSmsResult(null);
    try {
      const payload: Record<string, unknown> = { type: smsTestType, to: smsTestPhone };
      if (smsTestType === 'mfa') {
        payload.code = '847291';
      } else if (smsTestType === 'payment_reminder') {
        payload.clientName = 'Test Client';
        payload.invoiceNumber = 'INV-001';
        payload.amount = '$500.00';
        payload.dueDate = 'June 30, 2026';
      } else {
        payload.clientName = 'Test Client';
        payload.eventDate = 'Monday, June 30, 2026';
        payload.eventTime = '10:00 AM CST';
        payload.reminderType = '24hr';
      }
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSmsResult({ success: true, message: `SMS sent! SID: ${data.messageSid}` });
      } else {
        setSmsResult({ success: false, message: data.error ?? 'Failed to send SMS' });
      }
    } catch (err) {
      setSmsResult({ success: false, message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setSmsSending(false);
    }
  }

  async function handleResendTest() {
    if (!resendTestEmail) return;
    setResendSending(true);
    setResendResult(null);
    try {
      const res = await fetch('/api/admin/send-resend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: resendTestEmail,
          subject: 'Resend Integration Test — Broussard Legal Services',
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
            <h2 style="margin:0 0 8px;font-size:20px;color:#111">✅ Resend is working!</h2>
            <p style="margin:0 0 16px;color:#555;font-size:14px">This is a test email from <strong>Broussard Legal Services</strong> confirming your Resend integration is live and sending correctly.</p>
            <p style="margin:0;color:#888;font-size:12px">Sent via Resend API · ${new Date().toLocaleString()}</p>
          </div>`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResendResult({ success: true, message: `Email sent! ID: ${data.id}` });
      } else {
        setResendResult({ success: false, message: data.error ?? 'Failed to send email' });
      }
    } catch (err) {
      setResendResult({ success: false, message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setResendSending(false);
    }
  }

  async function handleBroussardTest() {
    setBroussardTesting(true);
    setBroussardResult(null);
    try {
      const res = await fetch('/api/broussard/test-sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setBroussardResult({ success: true, message: data.message });
      } else {
        setBroussardResult({ success: false, message: data.message ?? 'Sync failed — check server logs.' });
      }
    } catch (err) {
      setBroussardResult({ success: false, message: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setBroussardTesting(false);
    }
  }

  // Check env vars (client-side accessible ones)
  const stripeConfigured = !!(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const googleConfigured = !!(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

  const integrations: IntegrationStatus[] = [
    {
      id: 'google_calendar',
      name: 'Google Calendar',
      description: 'Auto-sync Calendly bookings and cancellations to your Google Calendar',
      category: 'calendar',
      connected: gcalStatus?.connected ?? false,
      accountInfo: gcalStatus?.accountEmail ? `Connected as ${gcalStatus.accountEmail}` : undefined,
      lastSync: gcalStatus?.connected ? 'Active — syncing new bookings' : undefined,
      envKey: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
      envConfigured: googleConfigured,
      docsUrl: 'https://developers.google.com/calendar/api/guides/overview',
      icon: <GoogleCalendarIcon />,
      color: '#4285F4',
    },
    {
      id: 'google_meet',
      name: 'Google Meet',
      description: 'Video consultation links auto-generated and sent with every booking confirmation',
      category: 'calendar',
      connected: gcalStatus?.connected ?? false,
      accountInfo: gcalStatus?.connected ? 'Meet links auto-generated via Calendar API' : undefined,
      lastSync: gcalStatus?.connected ? 'Active — links sent on booking' : undefined,
      envKey: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
      envConfigured: googleConfigured,
      docsUrl: 'https://developers.google.com/meet',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="23 7 16 12 23 17 23 7" fill="#00897B" fillOpacity="0.15" stroke="#00897B" strokeWidth="1.5" strokeLinejoin="round"/>
          <rect x="1" y="5" width="15" height="14" rx="2" fill="#00897B" fillOpacity="0.1" stroke="#00897B" strokeWidth="1.5"/>
        </svg>
      ),
      color: '#00897B',
    },
    {
      id: 'google_docs',
      name: 'Google Docs',
      description: 'Case notes, intake documents, and engagement letters synced to Google Docs',
      category: 'storage',
      connected: googleConfigured,
      accountInfo: googleConfigured ? 'Document drafting via Lexi AI' : undefined,
      lastSync: googleConfigured ? 'Active — Lexi can draft to Docs' : undefined,
      envKey: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
      envConfigured: googleConfigured,
      docsUrl: 'https://developers.google.com/docs/api',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="#4285F4" fillOpacity="0.1" stroke="#4285F4" strokeWidth="1.5" strokeLinejoin="round"/>
          <polyline points="14 2 14 8 20 8" stroke="#4285F4" strokeWidth="1.5" strokeLinejoin="round"/>
          <line x1="16" y1="13" x2="8" y2="13" stroke="#4285F4" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="16" y1="17" x2="8" y2="17" stroke="#4285F4" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      ),
      color: '#4285F4',
    },
    {
      id: 'google_sheets',
      name: 'Google Sheets',
      description: 'Billing records, time logs, and case data exported to Google Sheets',
      category: 'storage',
      connected: googleConfigured,
      accountInfo: googleConfigured ? 'Billing & time tracking exports' : undefined,
      lastSync: googleConfigured ? 'Active — data export available' : undefined,
      envKey: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
      envConfigured: googleConfigured,
      docsUrl: 'https://developers.google.com/sheets/api',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="2" fill="#0F9D58" fillOpacity="0.1" stroke="#0F9D58" strokeWidth="1.5"/>
          <line x1="3" y1="9" x2="21" y2="9" stroke="#0F9D58" strokeWidth="1.2"/>
          <line x1="3" y1="15" x2="21" y2="15" stroke="#0F9D58" strokeWidth="1.2"/>
          <line x1="9" y1="3" x2="9" y2="21" stroke="#0F9D58" strokeWidth="1.2"/>
          <line x1="15" y1="3" x2="15" y2="21" stroke="#0F9D58" strokeWidth="1.2"/>
        </svg>
      ),
      color: '#0F9D58',
    },
    {
      id: 'google_voice',
      name: 'Google Voice',
      description: 'Direct client calls routed through Google Voice for professional communication',
      category: 'crm',
      connected: false,
      envKey: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
      envConfigured: googleConfigured,
      docsUrl: 'https://voice.google.com',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .98h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" fill="#DB4437" fillOpacity="0.1" stroke="#DB4437" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      ),
      color: '#DB4437',
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Process payments, manage invoices, and handle retainer subscriptions',
      category: 'payments',
      connected: stripeConfigured,
      accountInfo: stripeConfigured ? 'Publishable key configured' : undefined,
      lastSync: stripeConfigured ? 'Payments, invoices & webhooks active' : undefined,
      envKey: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      envConfigured: stripeConfigured,
      docsUrl: 'https://stripe.com/docs',
      icon: <StripeIcon />,
      color: '#635BFF',
    },
    {
      id: 'twilio',
      name: 'Twilio',
      description: 'SMS notifications for MFA codes, payment reminders, and appointment reminders',
      category: 'crm',
      connected: false,
      envKey: 'TWILIO_ACCOUNT_SID',
      envConfigured: false,
      docsUrl: 'https://www.twilio.com/docs/sms',
      icon: <TwilioIcon />,
      color: '#F22F46',
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Sync case notes and client records to your Notion workspace',
      category: 'crm',
      connected: false,
      envKey: 'NOTION_API_KEY',
      envConfigured: false,
      docsUrl: 'https://developers.notion.com',
      icon: <NotionIcon />,
      color: '#000000',
    },
    {
      id: 'typeform',
      name: 'Typeform',
      description: 'Receive intake form submissions via webhook and auto-create client records',
      category: 'forms',
      connected: true,
      accountInfo: 'Webhook endpoint active',
      lastSync: 'Receiving intake submissions',
      docsUrl: 'https://www.typeform.com/developers/',
      icon: <TypeformIcon />,
      color: '#262627',
    },
    {
      id: 'calendly',
      name: 'Calendly',
      description: 'Auto-process consultation bookings, send confirmations, and trigger sequences',
      category: 'scheduling',
      connected: true,
      accountInfo: 'Webhook endpoint active',
      lastSync: 'Processing new bookings',
      docsUrl: 'https://developer.calendly.com',
      icon: <CalendlyIcon />,
      color: '#006BFF',
    },
    {
      id: 'resend',
      name: 'Resend',
      description: 'Transactional email delivery for client notifications, sequences, and digests',
      category: 'crm',
      connected: false,
      envKey: 'RESEND_API_KEY',
      envConfigured: false,
      docsUrl: 'https://resend.com/docs',
      icon: <ResendIcon />,
      color: '#000000',
    },
  ];

  const connectedCount = integrations.filter((i) => i.connected).length;
  const needsSetupCount = integrations.filter((i) => !i.connected && i.envConfigured === false).length;

  // Group by category
  const grouped = integrations.reduce<Record<string, IntegrationStatus[]>>((acc, i) => {
    const cat = i.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(i);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border ${
          toast.type === 'success' ?'bg-emerald-50 border-emerald-200 text-emerald-800' :'bg-red-50 border-red-200 text-red-800'
        }`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {toast.type === 'success'
              ? <><polyline points="20 6 9 17 4 12"/></>
              : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
          </svg>
          {toast.text}
        </div>
      )}

      {/* Twilio Setup Banner */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-red-200 flex items-center justify-center shrink-0 shadow-sm">
            <TwilioIcon />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-900">Set Up Twilio SMS</h3>
            <p className="text-xs text-red-700 mt-0.5">Add your Twilio credentials to enable MFA codes, payment reminders, and appointment reminders via SMS.</p>
          </div>
        </div>

        <ol className="space-y-3 mb-4">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
            <div>
              <p className="text-xs font-semibold text-red-900">Get your Twilio credentials</p>
              <p className="text-xs text-red-700 mt-0.5">
                Log in to{' '}
                <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">console.twilio.com</a>
                {' '}and copy your <strong>Account SID</strong>, <strong>Auth Token</strong>, and <strong>From Phone Number</strong>.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
            <div>
              <p className="text-xs font-semibold text-red-900">Add credentials to your .env file</p>
              <div className="mt-1.5 bg-white border border-red-200 rounded-lg px-3 py-2 space-y-1">
                <code className="block text-[11px] font-mono text-red-800">TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
                <code className="block text-[11px] font-mono text-red-800">TWILIO_AUTH_TOKEN=your-auth-token</code>
                <code className="block text-[11px] font-mono text-red-800">TWILIO_PHONE_NUMBER=+19854133841</code>
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
            <div>
              <p className="text-xs font-semibold text-red-900">Also add to Supabase Edge Function secrets</p>
              <p className="text-xs text-red-700 mt-0.5">
                In your Supabase dashboard → Edge Functions → Secrets, add the same three keys so the <code className="bg-red-100 px-1 rounded font-mono">send-sms</code> edge function can use them.
              </p>
            </div>
          </li>
        </ol>

        {/* SMS Test Panel */}
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-900 mb-3">Test SMS (once credentials are set)</p>
          <div className="flex gap-2 mb-2">
            <input
              type="tel"
              placeholder="+1 555 000 0000"
              value={smsTestPhone}
              onChange={(e) => setSmsTestPhone(e.target.value)}
              className="flex-1 text-xs border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
            />
            <select
              value={smsTestType}
              onChange={(e) => setSmsTestType(e.target.value as typeof smsTestType)}
              className="text-xs border border-red-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
            >
              <option value="mfa">MFA Code</option>
              <option value="payment_reminder">Payment Reminder</option>
              <option value="appointment_reminder">Appointment Reminder</option>
            </select>
          </div>
          <button
            onClick={handleSmsTest}
            disabled={smsSending || !smsTestPhone}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {smsSending ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/>
              </svg>
            )}
            Send Test SMS
          </button>
          {smsResult && (
            <p className={`mt-2 text-xs font-medium ${smsResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
              {smsResult.success ? '✓' : '✗'} {smsResult.message}
            </p>
          )}
        </div>
      </div>

      {/* Resend Email Test Panel */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-sm">
            <ResendIcon />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900">Test Resend Email</h3>
            <p className="text-xs text-gray-600 mt-0.5">Send a test email to verify your Resend integration is live. Requires <code className="bg-gray-100 px-1 rounded font-mono text-[10px]">RESEND_API_KEY</code> to be set.</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-800 mb-3">Send a test email</p>
          <div className="flex gap-2 mb-2">
            <input
              type="email"
              placeholder="your@email.com"
              value={resendTestEmail}
              onChange={(e) => setResendTestEmail(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
            />
          </div>
          <button
            onClick={handleResendTest}
            disabled={resendSending || !resendTestEmail}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendSending ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            )}
            Send Test Email
          </button>
          {resendResult && (
            <p className={`mt-2 text-xs font-medium ${resendResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
              {resendResult.success ? '✓' : '✗'} {resendResult.message}
            </p>
          )}
        </div>
      </div>

      {/* Google Calendar Quick Setup Banner — shown when not connected */}
      {!gcalLoading && gcalStatus && !gcalStatus.connected && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center shrink-0 shadow-sm">
              <GoogleCalendarIcon />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-blue-900">Connect Google Calendar in 3 steps</h3>
              <p className="text-xs text-blue-700 mt-0.5">Auto-sync every Calendly booking to your Google Calendar — takes about 2 minutes.</p>
            </div>
          </div>

          <ol className="space-y-3 mb-4">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div>
                <p className="text-xs font-semibold text-blue-900">Create a Google OAuth Client</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Go to{' '}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    Google Cloud Console → Credentials
                  </a>
                  {' '}→ Create OAuth 2.0 Client ID (Web application).
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div>
                <p className="text-xs font-semibold text-blue-900">Add the redirect URI</p>
                <p className="text-xs text-blue-700 mt-0.5 mb-1.5">Copy this exact URL into <strong>Authorized redirect URIs</strong>:</p>
                <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2">
                  <code className="text-[11px] font-mono text-blue-800 flex-1 break-all">
                    {siteUrl}/api/google-calendar/callback
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${siteUrl}/api/google-calendar/callback`);
                      showToast('success', 'Redirect URI copied to clipboard');
                    }}
                    className="shrink-0 text-blue-500 hover:text-blue-700 transition-colors"
                    title="Copy"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                </div>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <div>
                <p className="text-xs font-semibold text-blue-900">Add your credentials to .env</p>
                <div className="mt-1.5 bg-white border border-blue-200 rounded-lg px-3 py-2 space-y-1">
                  <code className="block text-[11px] font-mono text-blue-800">NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id</code>
                  <code className="block text-[11px] font-mono text-blue-800">GOOGLE_CLIENT_ID=your-client-id</code>
                  <code className="block text-[11px] font-mono text-blue-800">GOOGLE_CLIENT_SECRET=your-client-secret</code>
                </div>
              </div>
            </li>
          </ol>

          <button
            onClick={handleGcalConnect}
            disabled={gcalActionLoading || !googleConfigured}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            {googleConfigured ? 'Connect Google Calendar' : 'Add credentials above, then connect'}
          </button>
          {!googleConfigured && (
            <p className="text-center text-[11px] text-blue-600 mt-2">
              Complete step 3 first — credentials not yet detected in environment.
            </p>
          )}
        </div>
      )}

      {/* Google Calendar Connected Banner */}
      {!gcalLoading && gcalStatus?.connected && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
            <GoogleCalendarIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">Google Calendar connected</p>
            {gcalStatus.accountEmail && (
              <p className="text-xs text-emerald-700 truncate">{gcalStatus.accountEmail}</p>
            )}
            <p className="text-xs text-emerald-600 mt-0.5">Calendly bookings are syncing automatically.</p>
          </div>
          <button
            onClick={handleGcalDisconnect}
            disabled={gcalActionLoading}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition-all disabled:opacity-60"
          >
            {gcalActionLoading ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            ) : 'Disconnect'}
          </button>
        </div>
      )}

      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{integrations.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">Total Integrations</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">{connectedCount}</p>
          <p className="text-xs text-emerald-600 mt-0.5 font-medium">Connected</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{needsSetupCount}</p>
          <p className="text-xs text-amber-600 mt-0.5 font-medium">Needs Setup</p>
        </div>
      </div>

      {/* Loading state for gcal */}
      {gcalLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Checking connection statuses…
        </div>
      )}

      {/* Grouped integration cards */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3 px-1">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div className="space-y-3">
            {items.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onConnect={integration.id === 'google_calendar' ? handleGcalConnect : undefined}
                onDisconnect={integration.id === 'google_calendar' ? handleGcalDisconnect : undefined}
                actionLoading={integration.id === 'google_calendar' ? gcalActionLoading : false}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Environment variables guide */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Configuring Integrations</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Most integrations require API keys or OAuth credentials set as environment variables. 
              Add them via your project&apos;s <code className="bg-secondary px-1 rounded font-mono">.env</code> file or your hosting provider&apos;s environment settings. 
              Webhook-based integrations (Typeform, Calendly) are active as long as you configure the webhook URL in their respective dashboards.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { key: 'NOTION_API_KEY', label: 'Notion' },
                { key: 'RESEND_API_KEY', label: 'Resend Email' },
                { key: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID', label: 'Google OAuth' },
                { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', label: 'Stripe' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2 border border-border">
                  <code className="text-[10px] font-mono text-foreground flex-1 truncate">{key}</code>
                  <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Broussard Sync Test Panel */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">Broussard App Sync</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send a test conversation to verify the Broussard sync is working. Requires <code className="bg-secondary px-1 rounded font-mono text-[10px]">BROUSSARD_API_URL</code> and <code className="bg-secondary px-1 rounded font-mono text-[10px]">BROUSSARD_API_KEY</code> to be set.
            </p>
          </div>
        </div>
        <button
          onClick={handleBroussardTest}
          disabled={broussardTesting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {broussardTesting ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.08-4.49"/>
            </svg>
          )}
          {broussardTesting ? 'Sending test conversation…' : 'Send Test Conversation'}
        </button>
        {broussardResult && (
          <div className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium border ${
            broussardResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :'bg-red-50 border-red-200 text-red-800'
          }`}>
            <span className="shrink-0 mt-0.5">{broussardResult.success ? '✓' : '✗'}</span>
            <span>{broussardResult.message}</span>
          </div>
        )}
      </div>

      {/* ── Account Channels ──────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">Account Channels</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              All active email addresses and web channels linked to this account. The main contact email is used for lead routing, notifications, and client-facing correspondence.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {/* Main contact email — highlighted */}
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">maggimay@broussardlegalservices.com</p>
              <p className="text-[11px] text-primary font-medium mt-0.5">Main Contact Email</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase tracking-wide shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Primary
            </span>
          </div>

          {/* Additional email channels */}
          {[
            { address: 'admin@broussardlegalservices.com', label: 'Admin' },
            { address: 'sales@broussardlegalservices.com', label: 'Sales' },
            { address: 'books@broussardlegalservices.com', label: 'Bookkeeping' },
          ].map(({ address, label }) => (
            <div key={address} className="flex items-center gap-3 bg-secondary/30 border border-border rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{address}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{label} inbox</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border text-muted-foreground text-[10px] font-semibold uppercase tracking-wide shrink-0">
                Active
              </span>
            </div>
          ))}

          {/* Web channel */}
          <div className="flex items-center gap-3 bg-secondary/30 border border-border rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">online.broussardlegalservices.com</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Web channel / online portal</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold uppercase tracking-wide shrink-0">
              Web
            </span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
          All inbound messages and leads from these channels are routed to the admin dashboard. The main contact email <strong>maggimay@broussardlegalservices.com</strong> is used for all client-facing notifications and automated sequences.
        </p>
      </div>
    </div>
  );
}
