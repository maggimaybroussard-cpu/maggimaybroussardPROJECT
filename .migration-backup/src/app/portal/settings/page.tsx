'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProfileForm {
  full_name: string;
  phone: string;
  company: string;
  address_line1: string;
  address_city: string;
  address_state: string;
  address_zip: string;
}

interface NotificationPrefs {
  invoice_issued: boolean;
  invoice_reminder: boolean;
  invoice_overdue: boolean;
  payment_received: boolean;
  case_update: boolean;
  retainer_renewal: boolean;
  appointment_reminder: boolean;
  new_message: boolean;
  marketing_emails: boolean;
}

interface InvoiceEmailSettings {
  invoice_email: string;
  cc_emails: string;
  send_pdf_attachment: boolean;
  send_payment_link: boolean;
}

interface SaveState {
  profile: 'idle' | 'saving' | 'saved' | 'error';
  notifications: 'idle' | 'saving' | 'saved' | 'error';
  invoiceEmail: 'idle' | 'saving' | 'saved' | 'error';
  password: 'idle' | 'saving' | 'saved' | 'error';
}

interface CaseSummaryItem {
  id: string;
  matter_name: string;
  matter_ref: string | null;
  status: string | null;
  service_type: string | null;
  created_at: string;
  next_deadline: string | null;
  assigned_paralegal: string | null;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  invoice_issued: true,
  invoice_reminder: true,
  invoice_overdue: true,
  payment_received: true,
  case_update: true,
  retainer_renewal: true,
  appointment_reminder: true,
  new_message: true,
  marketing_emails: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function SaveButton({
  state,
  onClick,
  label = 'Save Changes',
}: {
  state: 'idle' | 'saving' | 'saved' | 'error';
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={state === 'saving'}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60"
      style={{
        background: state === 'saved' ? '#16a34a' : state === 'error' ? '#dc2626' : '#355E3B',
        color: '#fff',
      }}
    >
      {state === 'saving' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {state === 'saved' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {state === 'error' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved!' : state === 'error' ? 'Failed' : label}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground font-light mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 w-10 h-5.5 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          background: checked ? '#355E3B' : '#d1d5db',
          height: '22px',
          width: '40px',
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}

// Card brand icon helper
function CardBrandIcon({ brand }: { brand: string }) {
  const b = brand.toLowerCase();
  if (b === 'visa') return <span className="text-blue-700 font-bold text-xs tracking-widest">VISA</span>;
  if (b === 'mastercard') return <span className="text-red-600 font-bold text-xs">MC</span>;
  if (b === 'amex') return <span className="text-blue-500 font-bold text-xs">AMEX</span>;
  if (b === 'discover') return <span className="text-orange-500 font-bold text-xs">DISC</span>;
  return <span className="text-muted-foreground font-bold text-xs uppercase">{brand}</span>;
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status || 'active').toLowerCase();
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'rgba(53,94,59,0.12)', text: '#355E3B', label: 'Active' },
    open: { bg: 'rgba(53,94,59,0.12)', text: '#355E3B', label: 'Open' },
    pending: { bg: 'rgba(200,150,90,0.15)', text: '#C8965A', label: 'Pending' },
    closed: { bg: 'rgba(100,100,100,0.12)', text: '#6b7280', label: 'Closed' },
    completed: { bg: 'rgba(22,163,74,0.12)', text: '#16a34a', label: 'Completed' },
    on_hold: { bg: 'rgba(239,68,68,0.12)', text: '#dc2626', label: 'On Hold' },
  };
  const style = map[s] || map['active'];
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: style.bg, color: style.text }}>
      {style.label}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PortalSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut, updatePassword } = useAuth();

  const [profile, setProfile] = useState<ProfileForm>({
    full_name: '',
    phone: '',
    company: '',
    address_line1: '',
    address_city: '',
    address_state: '',
    address_zip: '',
  });

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIF_PREFS);

  const [invoiceEmail, setInvoiceEmail] = useState<InvoiceEmailSettings>({
    invoice_email: '',
    cc_emails: '',
    send_pdf_attachment: true,
    send_payment_link: true,
  });

  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<SaveState>({
    profile: 'idle',
    notifications: 'idle',
    invoiceEmail: 'idle',
    password: 'idle',
  });

  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'payment' | 'invoiceEmail' | 'twofa' | 'paymentMethods' | 'caseSummary'>('profile');

  // ── 2FA state ─────────────────────────────────────────────────────────────
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpQR, setTotpQR] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpStep, setTotpStep] = useState<'idle' | 'setup' | 'verify' | 'disabling'>('idle');
  const [totpMsg, setTotpMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);

  // ── Payment methods state ─────────────────────────────────────────────────
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [pmLoading, setPmLoading] = useState(false);
  const [pmError, setPmError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // ── Case summary state ────────────────────────────────────────────────────
  const [cases, setCases] = useState<CaseSummaryItem[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  // ── Fetch existing settings ───────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile({
          full_name: profileData.full_name || user.user_metadata?.full_name || '',
          phone: profileData.phone || '',
          company: profileData.company || '',
          address_line1: profileData.address_line1 || '',
          address_city: profileData.address_city || '',
          address_state: profileData.address_state || '',
          address_zip: profileData.address_zip || '',
        });
        if (profileData.notification_prefs) {
          setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...profileData.notification_prefs });
        }
        if (profileData.invoice_email_settings) {
          setInvoiceEmail({
            invoice_email: profileData.invoice_email_settings.invoice_email || user.email || '',
            cc_emails: profileData.invoice_email_settings.cc_emails || '',
            send_pdf_attachment: profileData.invoice_email_settings.send_pdf_attachment ?? true,
            send_payment_link: profileData.invoice_email_settings.send_payment_link ?? true,
          });
        } else {
          setInvoiceEmail((prev) => ({ ...prev, invoice_email: user.email || '' }));
        }
      } else {
        setProfile((prev) => ({ ...prev, full_name: user.user_metadata?.full_name || '' }));
        setInvoiceEmail((prev) => ({ ...prev, invoice_email: user.email || '' }));
      }

      // Check 2FA status
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasTotp = factors?.totp?.some((f) => f.status === 'verified') ?? false;
      setTotpEnabled(hasTotp);
    } catch {
      // silently fail — form stays with defaults
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchCases = useCallback(async () => {
    if (!user) return;
    setCasesLoading(true);
    setCasesError(null);
    try {
      const supabase = createClient();
      // Try engagements table first (case management)
      const { data, error } = await supabase
        .from('engagements')
        .select('id, matter_name, matter_ref, status, service_type, created_at, next_deadline, assigned_paralegal')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setCases(data as CaseSummaryItem[]);
      } else {
        // Fallback: try client_cases or cases table
        const { data: data2 } = await supabase
          .from('cases')
          .select('id, matter_name, matter_ref, status, service_type, created_at, next_deadline, assigned_paralegal')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setCases((data2 as CaseSummaryItem[]) || []);
      }
    } catch {
      setCasesError('Unable to load case summary at this time.');
    } finally {
      setCasesLoading(false);
    }
  }, [user]);

  const fetchPaymentMethods = useCallback(async () => {
    if (!user) return;
    setPmLoading(true);
    setPmError(null);
    try {
      const res = await fetch('/api/portal/payment-methods');
      if (!res.ok) throw new Error('Failed to load payment methods');
      const json = await res.json();
      setPaymentMethods(json.methods || []);
    } catch {
      setPmError('Unable to load saved payment methods. Please try again.');
    } finally {
      setPmLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchSettings();
  }, [user, fetchSettings]);

  useEffect(() => {
    if (activeTab === 'caseSummary' && user) fetchCases();
  }, [activeTab, user, fetchCases]);

  useEffect(() => {
    if (activeTab === 'paymentMethods' && user) fetchPaymentMethods();
  }, [activeTab, user, fetchPaymentMethods]);

  // ── Save handlers ─────────────────────────────────────────────────────────
  const upsertProfile = async (patch: Record<string, unknown>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ id: user!.id, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    if (error) throw error;
  };

  const handleSaveProfile = async () => {
    setSaveState((s) => ({ ...s, profile: 'saving' }));
    try {
      await upsertProfile({ ...profile });
      const supabase = createClient();
      await supabase.auth.updateUser({ data: { full_name: profile.full_name } });
      setSaveState((s) => ({ ...s, profile: 'saved' }));
      setTimeout(() => setSaveState((s) => ({ ...s, profile: 'idle' })), 2500);
    } catch {
      setSaveState((s) => ({ ...s, profile: 'error' }));
      setTimeout(() => setSaveState((s) => ({ ...s, profile: 'idle' })), 2500);
    }
  };

  const handleSaveNotifications = async () => {
    setSaveState((s) => ({ ...s, notifications: 'saving' }));
    try {
      await upsertProfile({ notification_prefs: notifPrefs });
      setSaveState((s) => ({ ...s, notifications: 'saved' }));
      setTimeout(() => setSaveState((s) => ({ ...s, notifications: 'idle' })), 2500);
    } catch {
      setSaveState((s) => ({ ...s, notifications: 'error' }));
      setTimeout(() => setSaveState((s) => ({ ...s, notifications: 'idle' })), 2500);
    }
  };

  const handleSaveInvoiceEmail = async () => {
    setSaveState((s) => ({ ...s, invoiceEmail: 'saving' }));
    try {
      await upsertProfile({ invoice_email_settings: invoiceEmail });
      setSaveState((s) => ({ ...s, invoiceEmail: 'saved' }));
      setTimeout(() => setSaveState((s) => ({ ...s, invoiceEmail: 'idle' })), 2500);
    } catch {
      setSaveState((s) => ({ ...s, invoiceEmail: 'error' }));
      setTimeout(() => setSaveState((s) => ({ ...s, invoiceEmail: 'idle' })), 2500);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!passwordForm.next || passwordForm.next.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setSaveState((s) => ({ ...s, password: 'saving' }));
    try {
      await updatePassword(passwordForm.next);
      setPasswordForm({ current: '', next: '', confirm: '' });
      setSaveState((s) => ({ ...s, password: 'saved' }));
      setTimeout(() => setSaveState((s) => ({ ...s, password: 'idle' })), 2500);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password.');
      setSaveState((s) => ({ ...s, password: 'error' }));
      setTimeout(() => setSaveState((s) => ({ ...s, password: 'idle' })), 2500);
    }
  };

  // ── 2FA handlers ──────────────────────────────────────────────────────────
  const handleEnroll2FA = async () => {
    setTotpLoading(true);
    setTotpMsg(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator App' });
      if (error) throw error;
      setTotpQR(data.totp.qr_code);
      setTotpSecret(data.totp.secret);
      setTotpStep('setup');
    } catch (err: unknown) {
      setTotpMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to start 2FA setup.' });
    } finally {
      setTotpLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!totpCode || totpCode.length < 6) {
      setTotpMsg({ type: 'error', text: 'Enter the 6-digit code from your authenticator app.' });
      return;
    }
    setTotpLoading(true);
    setTotpMsg(null);
    try {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const pendingFactor = factors?.totp?.find((f) => f.status === 'unverified');
      if (!pendingFactor) throw new Error('No pending factor found. Please restart setup.');

      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: pendingFactor.id });
      if (!challenge) throw new Error('Could not create challenge.');

      const { error } = await supabase.auth.mfa.verify({
        factorId: pendingFactor.id,
        challengeId: challenge.id,
        code: totpCode,
      });
      if (error) throw error;

      setTotpEnabled(true);
      setTotpStep('idle');
      setTotpQR(null);
      setTotpSecret(null);
      setTotpCode('');
      setTotpMsg({ type: 'success', text: 'Two-factor authentication is now enabled on your account.' });
    } catch (err: unknown) {
      setTotpMsg({ type: 'error', text: err instanceof Error ? err.message : 'Verification failed. Check your code and try again.' });
    } finally {
      setTotpLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    setTotpLoading(true);
    setTotpMsg(null);
    try {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f) => f.status === 'verified');
      if (!verified) throw new Error('No active 2FA factor found.');
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id });
      if (error) throw error;
      setTotpEnabled(false);
      setTotpStep('idle');
      setTotpMsg({ type: 'success', text: 'Two-factor authentication has been disabled.' });
    } catch (err: unknown) {
      setTotpMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to disable 2FA.' });
    } finally {
      setTotpLoading(false);
    }
  };

  // ── Payment method handlers ───────────────────────────────────────────────
  const handleRemovePaymentMethod = async (pmId: string) => {
    setRemovingId(pmId);
    try {
      const res = await fetch('/api/portal/payment-methods', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId: pmId }),
      });
      if (!res.ok) throw new Error('Failed to remove');
      setPaymentMethods((prev) => prev.filter((m) => m.id !== pmId));
    } catch {
      setPmError('Could not remove payment method. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
            <div className="w-28 h-7 bg-muted/60 rounded-lg animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="w-20 h-8 bg-muted/60 rounded-lg animate-pulse" />
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 md:px-10 py-10">
          <div className="w-48 h-8 bg-muted/60 rounded-lg animate-pulse mb-8" />
          <div className="bg-card border border-border rounded-2xl p-8 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-full h-12 bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  const navLinks = [
    { href: '/portal/dashboard', label: 'Dashboard', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg> },
    { href: '/portal/cases', label: 'My Cases', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> },
    { href: '/portal/invoices', label: 'Invoices', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg> },
    { href: '/portal/billing', label: 'Billing', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg> },
    { href: '/portal/messages', label: 'Messages', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
    { href: '/portal/notifications', label: 'Notifications', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg> },
    { href: '/portal/settings', label: 'Settings', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> },
  ];

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
    { id: 'notifications' as const, label: 'Notifications', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg> },
    { id: 'payment' as const, label: 'Password', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> },
    { id: 'twofa' as const, label: '2FA', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
    { id: 'paymentMethods' as const, label: 'Payment Methods', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg> },
    { id: 'caseSummary' as const, label: 'My Cases', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> },
    { id: 'invoiceEmail' as const, label: 'Invoice Delivery', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> },
  ];

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-150';
  const labelClass = 'block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5';

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 md:px-10">
          <div className="flex items-center justify-between py-3.5">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <AppLogo size={30} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                    link.href === '/portal/settings' ?'border-primary/40 text-primary bg-primary/5' :'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
                >
                  {link.icon}
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              ))}
              <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[160px]">{user?.email}</span>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 disabled:opacity-60"
              >
                {signingOut ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                )}
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-10 py-8 md:py-10">
        {/* ── Page header ── */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Client Portal</p>
          <h1 className="font-serif text-3xl md:text-4xl text-foreground">Account Settings</h1>
          <p className="text-sm text-muted-foreground font-light mt-1">Manage your profile, preferences, and communication settings.</p>
        </div>

        {/* ── Tab nav ── */}
        <div className="flex gap-1 p-1 bg-muted/40 rounded-2xl mb-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-max inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Profile Tab ── */}
        {activeTab === 'profile' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-border/60" style={{ background: 'linear-gradient(135deg, rgba(53,94,59,0.06) 0%, rgba(53,94,59,0.01) 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.12)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-foreground text-sm">Profile Details</h2>
                  <p className="text-xs text-muted-foreground font-light">Your personal and contact information</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className={labelClass}>Account Email</label>
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border/60 bg-muted/30">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                  </svg>
                  <span className="text-sm text-muted-foreground">{user?.email}</span>
                  <span className="ml-auto text-xs text-muted-foreground/60 font-light">Cannot be changed</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Full Name</label>
                  <input type="text" value={profile.full_name} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} placeholder="Jane Smith" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input type="tel" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" className={inputClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Company / Organization</label>
                <input type="text" value={profile.company} onChange={(e) => setProfile((p) => ({ ...p, company: e.target.value }))} placeholder="Acme Corp (optional)" className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Street Address</label>
                <input type="text" value={profile.address_line1} onChange={(e) => setProfile((p) => ({ ...p, address_line1: e.target.value }))} placeholder="123 Main St" className={inputClass} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelClass}>City</label>
                  <input type="text" value={profile.address_city} onChange={(e) => setProfile((p) => ({ ...p, address_city: e.target.value }))} placeholder="New Orleans" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>State</label>
                  <input type="text" value={profile.address_state} onChange={(e) => setProfile((p) => ({ ...p, address_state: e.target.value }))} placeholder="LA" maxLength={2} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>ZIP Code</label>
                  <input type="text" value={profile.address_zip} onChange={(e) => setProfile((p) => ({ ...p, address_zip: e.target.value }))} placeholder="70112" className={inputClass} />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <SaveButton state={saveState.profile} onClick={handleSaveProfile} />
              </div>
            </div>
          </div>
        )}

        {/* ── Notifications Tab ── */}
        {activeTab === 'notifications' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-border/60" style={{ background: 'linear-gradient(135deg, rgba(53,94,59,0.06) 0%, rgba(53,94,59,0.01) 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.12)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-foreground text-sm">Notification Preferences</h2>
                  <p className="text-xs text-muted-foreground font-light">Choose which emails you receive from us</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Billing & Payments</p>
                <Toggle checked={notifPrefs.invoice_issued} onChange={(v) => setNotifPrefs((p) => ({ ...p, invoice_issued: v }))} label="New Invoice Issued" description="Receive an email when a new invoice is created for you" />
                <Toggle checked={notifPrefs.invoice_reminder} onChange={(v) => setNotifPrefs((p) => ({ ...p, invoice_reminder: v }))} label="Invoice Payment Reminders" description="7-day advance reminder before your invoice is due" />
                <Toggle checked={notifPrefs.invoice_overdue} onChange={(v) => setNotifPrefs((p) => ({ ...p, invoice_overdue: v }))} label="Overdue Invoice Alerts" description="Notification when an invoice becomes past due" />
                <Toggle checked={notifPrefs.payment_received} onChange={(v) => setNotifPrefs((p) => ({ ...p, payment_received: v }))} label="Payment Confirmation" description="Confirmation email when a payment is successfully processed" />
                <Toggle checked={notifPrefs.retainer_renewal} onChange={(v) => setNotifPrefs((p) => ({ ...p, retainer_renewal: v }))} label="Retainer Renewal Notices" description="Advance notice before your retainer subscription renews" />
              </div>
              <div className="mb-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Case & Appointments</p>
                <Toggle checked={notifPrefs.case_update} onChange={(v) => setNotifPrefs((p) => ({ ...p, case_update: v }))} label="Case Status Updates" description="Emails when your case status or milestones change" />
                <Toggle checked={notifPrefs.appointment_reminder} onChange={(v) => setNotifPrefs((p) => ({ ...p, appointment_reminder: v }))} label="Appointment Reminders" description="Reminder emails before scheduled consultations" />
              </div>
              <div className="mb-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Messages</p>
                <Toggle checked={notifPrefs.new_message} onChange={(v) => setNotifPrefs((p) => ({ ...p, new_message: v }))} label="New Message Notifications" description="Email alert when your legal team sends you a new portal message" />
              </div>
              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">General</p>
                <Toggle checked={notifPrefs.marketing_emails} onChange={(v) => setNotifPrefs((p) => ({ ...p, marketing_emails: v }))} label="Newsletters & Updates" description="Occasional firm news, legal insights, and service announcements" />
              </div>
              <div className="flex justify-end">
                <SaveButton state={saveState.notifications} onClick={handleSaveNotifications} />
              </div>
            </div>
          </div>
        )}

        {/* ── Password & Security Tab ── */}
        {activeTab === 'payment' && (
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-border/60" style={{ background: 'linear-gradient(135deg, rgba(53,94,59,0.06) 0%, rgba(53,94,59,0.01) 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.12)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground text-sm">Change Password</h2>
                    <p className="text-xs text-muted-foreground font-light">Update your portal login password</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {passwordError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    {passwordError}
                  </div>
                )}
                <div>
                  <label className={labelClass}>New Password</label>
                  <input type="password" value={passwordForm.next} onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))} placeholder="Minimum 8 characters" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Confirm New Password</label>
                  <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))} placeholder="Re-enter new password" className={inputClass} />
                </div>
                <div className="flex justify-end pt-1">
                  <SaveButton state={saveState.password} onClick={handleChangePassword} label="Update Password" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Two-Factor Auth Tab ── */}
        {activeTab === 'twofa' && (
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-border/60" style={{ background: 'linear-gradient(135deg, rgba(53,94,59,0.06) 0%, rgba(53,94,59,0.01) 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.12)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground text-sm">Two-Factor Authentication</h2>
                    <p className="text-xs text-muted-foreground font-light">Add an extra layer of security to your account</p>
                  </div>
                  <div className="ml-auto">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: totpEnabled ? 'rgba(22,163,74,0.12)' : 'rgba(239,68,68,0.10)',
                        color: totpEnabled ? '#16a34a' : '#dc2626',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: totpEnabled ? '#16a34a' : '#dc2626' }} />
                      {totpEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Status message */}
                {totpMsg && (
                  <div
                    className="p-3 rounded-xl border text-xs flex items-center gap-2"
                    style={{
                      background: totpMsg.type === 'success' ? 'rgba(22,163,74,0.08)' : 'rgba(239,68,68,0.08)',
                      borderColor: totpMsg.type === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.3)',
                      color: totpMsg.type === 'success' ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {totpMsg.type === 'success' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    )}
                    {totpMsg.text}
                  </div>
                )}

                {/* Idle state — not yet enabled */}
                {!totpEnabled && totpStep === 'idle' && (
                  <div>
                    <div className="flex items-start gap-4 p-4 rounded-xl border border-border/60 bg-muted/20 mb-5">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0 mt-0.5">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <div>
                        <p className="text-sm text-foreground font-medium mb-1">Protect your account with an authenticator app</p>
                        <p className="text-xs text-muted-foreground font-light leading-relaxed">
                          Two-factor authentication (2FA) requires a time-based one-time password (TOTP) from an app like Google Authenticator, Authy, or 1Password every time you sign in.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleEnroll2FA}
                      disabled={totpLoading}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60"
                      style={{ background: '#355E3B', color: '#fff' }}
                    >
                      {totpLoading ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                      )}
                      {totpLoading ? 'Setting up…' : 'Enable Two-Factor Auth'}
                    </button>
                  </div>
                )}

                {/* Setup step — show QR code */}
                {totpStep === 'setup' && totpQR && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Step 1 — Scan QR Code</p>
                      <p className="text-sm text-muted-foreground font-light mb-4">Open your authenticator app and scan the QR code below to add your account.</p>
                      <div className="flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={totpQR} alt="Two-factor authentication QR code for your authenticator app" className="w-44 h-44 rounded-xl border border-border p-2 bg-white" />
                      </div>
                    </div>
                    {totpSecret && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Manual Entry Key</p>
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border/60 bg-muted/30">
                          <code className="text-xs font-mono text-foreground tracking-widest break-all">{totpSecret}</code>
                        </div>
                        <p className="text-xs text-muted-foreground font-light mt-1.5">Use this key if you cannot scan the QR code.</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Step 2 — Enter Verification Code</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className={`${inputClass} text-center text-lg tracking-[0.5em] font-mono`}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleVerify2FA}
                        disabled={totpLoading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 disabled:opacity-60"
                        style={{ background: '#355E3B', color: '#fff' }}
                      >
                        {totpLoading ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                        {totpLoading ? 'Verifying…' : 'Verify & Enable'}
                      </button>
                      <button
                        onClick={() => { setTotpStep('idle'); setTotpQR(null); setTotpSecret(null); setTotpCode(''); setTotpMsg(null); }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Enabled state */}
                {totpEnabled && totpStep === 'idle' && (
                  <div>
                    <div className="flex items-start gap-4 p-4 rounded-xl border border-green-200 bg-green-50 mb-5">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-green-800 mb-1">Your account is protected with 2FA</p>
                        <p className="text-xs text-green-700 font-light leading-relaxed">
                          You will be prompted for a verification code from your authenticator app each time you sign in.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleDisable2FA}
                      disabled={totpLoading}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-red-300 text-xs font-semibold uppercase tracking-widest text-red-600 hover:bg-red-50 transition-all duration-200 disabled:opacity-60"
                    >
                      {totpLoading ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      )}
                      {totpLoading ? 'Disabling…' : 'Disable Two-Factor Auth'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Payment Methods Tab ── */}
        {activeTab === 'paymentMethods' && (
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-border/60" style={{ background: 'linear-gradient(135deg, rgba(200,150,90,0.06) 0%, rgba(200,150,90,0.01) 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(200,150,90,0.12)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8965A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground text-sm">Linked Payment Methods</h2>
                    <p className="text-xs text-muted-foreground font-light">Saved cards on file for invoices and retainer billing</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {pmError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    {pmError}
                  </div>
                )}

                {pmLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : paymentMethods.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(200,150,90,0.10)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C8965A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">No saved payment methods</p>
                    <p className="text-xs text-muted-foreground font-light max-w-xs">
                      Cards are saved automatically when you pay an invoice or set up a retainer subscription. They will appear here once added.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentMethods.map((pm) => (
                      <div key={pm.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-muted/10">
                        <div className="w-12 h-8 rounded-lg border border-border/60 bg-white flex items-center justify-center flex-shrink-0">
                          <CardBrandIcon brand={pm.brand} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground capitalize">
                            {pm.brand} ending in {pm.last4}
                            {pm.is_default && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(53,94,59,0.12)', color: '#355E3B' }}>
                                Default
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground font-light">Expires {pm.exp_month.toString().padStart(2, '0')}/{pm.exp_year}</p>
                        </div>
                        <button
                          onClick={() => handleRemovePaymentMethod(pm.id)}
                          disabled={removingId === pm.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-all duration-200 disabled:opacity-60"
                        >
                          {removingId === pm.id ? (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                          ) : (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                          )}
                          {removingId === pm.id ? 'Removing…' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0 mt-0.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <p className="text-xs text-muted-foreground font-light leading-relaxed">
                      Payment details are stored securely by Stripe and are never held on our servers. To add a new card, pay any open invoice from the <Link href="/portal/invoices" className="underline hover:text-foreground">Invoices</Link> page.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Case Summary Tab ── */}
        {activeTab === 'caseSummary' && (
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-5 border-b border-border/60" style={{ background: 'linear-gradient(135deg, rgba(53,94,59,0.06) 0%, rgba(53,94,59,0.01) 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.12)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground text-sm">Case Summary</h2>
                    <p className="text-xs text-muted-foreground font-light">An overview of your active and recent matters</p>
                  </div>
                  <div className="ml-auto">
                    <Link
                      href="/portal/cases"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                      Full View
                    </Link>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {casesError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 mb-4">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    {casesError}
                  </div>
                )}

                {casesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : cases.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(53,94,59,0.10)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">No cases on file</p>
                    <p className="text-xs text-muted-foreground font-light max-w-xs">
                      Your matters will appear here once your legal team opens a case for you.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cases.map((c) => (
                      <div key={c.id} className="p-4 rounded-xl border border-border/60 hover:border-border transition-all duration-150">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{c.matter_name || 'Untitled Matter'}</p>
                            {c.matter_ref && (
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">Ref: {c.matter_ref}</p>
                            )}
                          </div>
                          <StatusBadge status={c.status} />
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {c.service_type && (
                            <span className="text-xs text-muted-foreground font-light flex items-center gap-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                              {c.service_type}
                            </span>
                          )}
                          {c.next_deadline && (
                            <span className="text-xs text-muted-foreground font-light flex items-center gap-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                              Next deadline: {new Date(c.next_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                          {c.assigned_paralegal && (
                            <span className="text-xs text-muted-foreground font-light flex items-center gap-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                              {c.assigned_paralegal}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground font-light flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            Opened {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="mt-3">
                          <Link
                            href={`/portal/cases/${c.id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest transition-colors duration-150 hover:opacity-80"
                            style={{ color: '#355E3B' }}
                          >
                            View Case Details
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Invoice Email Delivery Tab ── */}
        {activeTab === 'invoiceEmail' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-border/60" style={{ background: 'linear-gradient(135deg, rgba(53,94,59,0.06) 0%, rgba(53,94,59,0.01) 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.12)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-foreground text-sm">Invoice Email Delivery</h2>
                  <p className="text-xs text-muted-foreground font-light">Configure where and how invoices are sent to you</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className={labelClass}>Primary Invoice Email</label>
                <input type="email" value={invoiceEmail.invoice_email} onChange={(e) => setInvoiceEmail((p) => ({ ...p, invoice_email: e.target.value }))} placeholder="billing@yourcompany.com" className={inputClass} />
                <p className="text-xs text-muted-foreground font-light mt-1.5">All invoices will be sent to this address. Leave blank to use your account email.</p>
              </div>
              <div>
                <label className={labelClass}>CC Recipients</label>
                <input type="text" value={invoiceEmail.cc_emails} onChange={(e) => setInvoiceEmail((p) => ({ ...p, cc_emails: e.target.value }))} placeholder="accountant@firm.com, cfo@company.com" className={inputClass} />
                <p className="text-xs text-muted-foreground font-light mt-1.5">Comma-separated list of additional recipients to CC on every invoice email.</p>
              </div>
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Delivery Options</p>
                <Toggle checked={invoiceEmail.send_pdf_attachment} onChange={(v) => setInvoiceEmail((p) => ({ ...p, send_pdf_attachment: v }))} label="Attach PDF to Invoice Emails" description="Include a downloadable PDF copy of the invoice in every email" />
                <Toggle checked={invoiceEmail.send_payment_link} onChange={(v) => setInvoiceEmail((p) => ({ ...p, send_payment_link: v }))} label="Include Payment Link in Emails" description="Add a direct pay-now button to invoice notification emails" />
              </div>
              <div className="flex justify-end pt-2">
                <SaveButton state={saveState.invoiceEmail} onClick={handleSaveInvoiceEmail} label="Save Delivery Settings" />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
