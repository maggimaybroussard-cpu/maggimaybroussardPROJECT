'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

interface SharedDoc {
  id: string;
  file_name: string;
  file_url: string;
  expires_at: string;
  access_count: number;
  max_access: number | null;
  is_active: boolean;
  recipient_name: string | null;
}

export default function SharedDocPage() {
  const params = useParams();
  const token = params?.token as string;
  const [doc, setDoc] = useState<SharedDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token) return;
    const fetchDoc = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error: err } = await supabase
          .from('shared_document_links')
          .select('id, file_name, file_url, expires_at, access_count, max_access, is_active, recipient_name')
          .eq('share_token', token)
          .single();

        if (err || !data) {
          setError('This link is invalid or has been removed.');
          return;
        }

        if (!data.is_active) {
          setError('This share link has been revoked.');
          return;
        }

        if (new Date(data.expires_at) < new Date()) {
          setError('This share link has expired.');
          return;
        }

        if (data.max_access && data.access_count >= data.max_access) {
          setError('This share link has reached its maximum number of accesses.');
          return;
        }

        // Increment access count
        await supabase
          .from('shared_document_links')
          .update({ access_count: (data.access_count || 0) + 1 })
          .eq('id', data.id);

        setDoc(data);
      } catch {
        setError('Failed to load document.');
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [token]);

  const handleDownload = async () => {
    if (!doc) return;
    setDownloading(true);
    try {
      const res = await fetch(doc.file_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(doc.file_url, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const daysLeft = doc ? Math.round((new Date(doc.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <AppLogo className="h-10 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Broussard Legal Services — Secure Document Share</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading document…</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <p className="text-foreground font-semibold mb-2">Link Unavailable</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground mt-4">Please contact Broussard Legal Services for a new link.</p>
            </div>
          ) : doc ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              {doc.recipient_name && (
                <p className="text-sm text-muted-foreground mb-2">For: <strong className="text-foreground">{doc.recipient_name}</strong></p>
              )}
              <h1 className="font-serif text-xl text-foreground mb-2">{doc.file_name}</h1>
              <p className="text-xs text-muted-foreground mb-6">
                Shared securely by Broussard Legal Services · Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
              </p>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full py-3 rounded-xl font-semibold text-sm uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                {downloading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Downloading…</>
                ) : (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Document</>
                )}
              </button>

              <div className="mt-6 pt-5 border-t border-border">
                <p className="text-xs text-muted-foreground">🔒 This link is encrypted and time-limited. Do not share it with others.</p>
              </div>
            </div>
          ) : null}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Questions? Contact us at{' '}
          <a href="mailto:maggimay@broussardlegalservices.com" className="text-primary hover:underline">
            maggimay@broussardlegalservices.com
          </a>
        </p>
      </div>
    </div>
  );
}
