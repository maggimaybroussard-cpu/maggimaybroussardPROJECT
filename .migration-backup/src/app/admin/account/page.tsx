'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

interface AdminProfile {
  full_name: string;
  email: string;
  phone: string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function AdminAccountPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<AdminProfile>({ full_name: '', email: '', phone: '' });
  const [profileSave, setProfileSave] = useState<SaveState>('idle');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSave, setPasswordSave] = useState<SaveState>('idle');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.replace('/admin/login'); return; }
      setUser(u);
      setProfile({
        full_name: u.user_metadata?.full_name || '',
        email: u.email || '',
        phone: u.user_metadata?.phone || '',
      });
    } catch {
      router.replace('/admin/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSave('saving');
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: profile.full_name, phone: profile.phone },
      });
      if (error) throw error;
      // Sync to user_profiles table
      await supabase
        .from('user_profiles')
        .upsert(
          { id: user.id, full_name: profile.full_name, phone: profile.phone, email: profile.email, role: 'admin', updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      setProfileSave('saved');
      setTimeout(() => setProfileSave('idle'), 2500);
    } catch {
      setProfileSave('error');
      setTimeout(() => setProfileSave('idle'), 2500);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return; }
    setPasswordSave('saving');
    try {
      // Re-authenticate with current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) throw new Error('Current password is incorrect.');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSave('saved');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSave('idle'), 2500);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password.');
      setPasswordSave('error');
      setTimeout(() => setPasswordSave('idle'), 2500);
    }
  };

  const handleSignOutAll = async () => {
    setSigningOutAll(true);
    try {
      await supabase.auth.signOut({ scope: 'global' });
      router.replace('/admin/login');
    } catch {
      setSigningOutAll(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" style={{ color: 'var(--accent)' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  const SaveBtn = ({ state, onClick, label = 'Save Changes' }: { state: SaveState; onClick: () => void; label?: string }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'saving'}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
      style={{
        background: state === 'saved' ? '#16a34a' : state === 'error' ? '#dc2626' : 'var(--accent)',
        color: 'white',
      }}
    >
      {state === 'saving' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>}
      {state === 'saved' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
      {state === 'error' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
      {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved!' : state === 'error' ? 'Failed' : label}
    </button>
  );

  const EyeIcon = ({ show }: { show: boolean }) => show ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  );

  const inputClass = "w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors";
  const inputStyle = { background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' };
  const labelClass = "block text-sm font-medium mb-1.5";
  const labelStyle = { color: 'var(--foreground)' };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 md:px-10 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="inline-flex items-center gap-3">
              <AppLogo width={32} height={32} className="rounded-lg" />
              <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Broussard Legal</span>
            </Link>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>/</span>
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Account Settings</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              ← Back to Dashboard
            </Link>
            <button
              onClick={handleSignOut}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-80"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-4 py-10">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Page title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Admin Account</h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Manage your admin profile, password, and session security.
            </p>
          </div>

          {/* Profile Section */}
          <div className="rounded-2xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)', opacity: 0.9 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Profile Information</h2>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Update your admin display name and contact details</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass} style={labelStyle}>Full Name</label>
                <input
                  type="text"
                  value={profile.full_name}
                  onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Your full name"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className={inputClass + ' opacity-60 cursor-not-allowed'}
                  style={inputStyle}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Email cannot be changed here. Contact your Supabase admin to update.</p>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Phone (optional)</label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+1 (555) 000-0000"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div className="flex justify-end pt-1">
                <SaveBtn state={profileSave} onClick={handleSaveProfile} />
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="rounded-2xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)', opacity: 0.9 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Change Password</h2>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Use a strong, unique password for your admin account</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                { label: 'Current Password', value: currentPassword, setter: setCurrentPassword, show: showCurrent, toggle: () => setShowCurrent(v => !v), autocomplete: 'current-password' },
                { label: 'New Password', value: newPassword, setter: setNewPassword, show: showNew, toggle: () => setShowNew(v => !v), autocomplete: 'new-password' },
                { label: 'Confirm New Password', value: confirmPassword, setter: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(v => !v), autocomplete: 'new-password' },
              ].map(({ label, value, setter, show, toggle, autocomplete }) => (
                <div key={label}>
                  <label className={labelClass} style={labelStyle}>{label}</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={value}
                      onChange={e => setter(e.target.value)}
                      required
                      autoComplete={autocomplete}
                      placeholder="••••••••"
                      className={inputClass + ' pr-11'}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={toggle}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: 'var(--muted-foreground)' }}
                      aria-label={show ? 'Hide' : 'Show'}
                    >
                      <EyeIcon show={show} />
                    </button>
                  </div>
                </div>
              ))}

              {passwordError && (
                <div className="px-4 py-3 rounded-xl text-sm border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                  {passwordError}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={passwordSave === 'saving' || !currentPassword || !newPassword || !confirmPassword}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                  style={{
                    background: passwordSave === 'saved' ? '#16a34a' : passwordSave === 'error' ? '#dc2626' : 'var(--accent)',
                    color: 'white',
                  }}
                >
                  {passwordSave === 'saving' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>}
                  {passwordSave === 'saving' ? 'Updating…' : passwordSave === 'saved' ? '✓ Updated!' : passwordSave === 'error' ? 'Failed' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Session Security Section */}
          <div className="rounded-2xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)', opacity: 0.9 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Session Security</h2>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Manage active sessions and two-factor authentication</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* 2FA Status */}
              <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                <div className="flex items-center gap-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Two-Factor Authentication (TOTP)</p>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Required for all admin logins</p>
                  </div>
                </div>
                <Link
                  href="/admin/setup-totp"
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:opacity-80"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  Manage 2FA
                </Link>
              </div>

              {/* Sign out all sessions */}
              <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Sign Out All Sessions</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Revoke all active sessions across all devices</p>
                </div>
                <button
                  onClick={handleSignOutAll}
                  disabled={signingOutAll}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:opacity-80 disabled:opacity-60"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  {signingOutAll ? 'Signing out…' : 'Sign Out All'}
                </button>
              </div>

              {/* Account info */}
              <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)' }}>Account Info</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--muted-foreground)' }}>Email</span>
                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>{user?.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--muted-foreground)' }}>Role</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(53,94,59,0.12)', color: '#355E3B' }}>
                      Admin
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--muted-foreground)' }}>Account Created</span>
                    <span style={{ color: 'var(--foreground)' }}>
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--muted-foreground)' }}>Last Sign In</span>
                    <span style={{ color: 'var(--foreground)' }}>
                      {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
