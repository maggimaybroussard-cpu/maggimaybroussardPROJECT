'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface TotpFactor {
  id: string;
  friendly_name?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function AdminSecurityDashboard() {
  const supabase = createClient();

  const [factors, setFactors] = useState<TotpFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unenrolling, setUnenrolling] = useState<string | null>(null);
  const [confirmUnenroll, setConfirmUnenroll] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(data?.totp || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load security settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async (factorId: string) => {
    setUnenrolling(factorId);
    setError(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      setSuccessMsg('Authenticator app removed. You can set up a new one at your next login.');
      setConfirmUnenroll(null);
      await loadFactors();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove authenticator.');
    } finally {
      setUnenrolling(null);
    }
  };

  const verifiedFactors = factors.filter(f => f.status === 'verified');
  const pendingFactors = factors.filter(f => f.status !== 'verified');

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header card */}
      <div className="rounded-2xl border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#355E3B' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--foreground)' }}>Two-Factor Authentication</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              TOTP (Time-based One-Time Password) adds an extra layer of security to your admin account. 
              Each login requires a 6-digit code from your authenticator app in addition to your password.
            </p>
          </div>
        </div>
      </div>

      {/* Status */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" style={{ color: 'var(--accent)' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
              {error}
            </div>
          )}
          {successMsg && (
            <div className="px-4 py-3 rounded-xl text-sm border" style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.2)', color: '#16a34a' }}>
              {successMsg}
            </div>
          )}

          {/* Status badge */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {verifiedFactors.length > 0 ? (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {verifiedFactors.length > 0 ? '2FA is Active' : '2FA is Not Configured'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {verifiedFactors.length > 0
                      ? `${verifiedFactors.length} authenticator app${verifiedFactors.length > 1 ? 's' : ''} linked`
                      : 'Your admin account is not protected by 2FA'}
                  </p>
                </div>
              </div>
              {verifiedFactors.length === 0 && (
                <a
                  href="/admin/setup-totp"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#355E3B' }}
                >
                  Set Up 2FA
                </a>
              )}
            </div>
          </div>

          {/* Enrolled factors */}
          {verifiedFactors.length > 0 && (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="px-5 py-3 border-b" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                  Enrolled Authenticators
                </p>
              </div>
              <div className="divide-y" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                {verifiedFactors.map(factor => (
                  <div key={factor.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          {factor.friendly_name || 'Authenticator App'}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          Added {new Date(factor.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>
                        Active
                      </span>
                      {confirmUnenroll === factor.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Remove?</span>
                          <button
                            onClick={() => handleUnenroll(factor.id)}
                            disabled={unenrolling === factor.id}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                          >
                            {unenrolling === factor.id ? 'Removing…' : 'Yes, remove'}
                          </button>
                          <button
                            onClick={() => setConfirmUnenroll(null)}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium"
                            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmUnenroll(factor.id)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-70"
                          style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending / unverified factors */}
          {pendingFactors.length > 0 && (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="px-5 py-3 border-b" style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                  Pending Setup
                </p>
              </div>
              <div className="divide-y" style={{ background: 'var(--card)' }}>
                {pendingFactors.map(factor => (
                  <div key={factor.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(234,179,8,0.1)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          {factor.friendly_name || 'Authenticator App'}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Not yet verified</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(234,179,8,0.1)', color: '#ca8a04' }}>
                        Pending
                      </span>
                      <a
                        href="/admin/setup-totp"
                        className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                        style={{ background: '#355E3B' }}
                      >
                        Complete Setup
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="rounded-2xl border p-5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)' }}>
              How TOTP Works
            </p>
            <div className="space-y-2.5">
              {[
                { icon: '🔐', text: 'After entering your password, you\'ll be asked for a 6-digit code from your authenticator app.' },
                { icon: '⏱️', text: 'Codes refresh every 30 seconds and can only be used once.' },
                { icon: '📱', text: 'Compatible apps: Google Authenticator, Authy, Microsoft Authenticator, 1Password, and any TOTP app.' },
                { icon: '🔄', text: 'To switch devices, remove the current authenticator and re-enroll at your next login.' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-sm flex-shrink-0 mt-0.5">{item.icon}</span>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
