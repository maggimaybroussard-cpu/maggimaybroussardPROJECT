'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

interface CaseNote {
  id: string;
  inquiry_id: string;
  content: string;
  author: string;
  source: string | null;
  notion_page_id: string | null;
  notion_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CaseInfo {
  id: string;
  name: string;
  service: string;
  status: string;
}

const PORTAL_NAV = [
  { href: '/portal/dashboard', label: 'Dashboard' },
  { href: '/portal/cases', label: 'My Cases' },
  { href: '/portal/case-status', label: 'Case Status' },
  { href: '/portal/messages', label: 'Messages' },
  { href: '/portal/documents', label: 'Documents' },
  { href: '/portal/billing', label: 'Billing' },
  { href: '/portal/notion-notes', label: 'Case Notes' },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function renderMarkdown(content: string): string {
  return content
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-serif font-semibold text-foreground mt-6 mb-3">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-serif font-semibold text-foreground mt-5 mb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-foreground mt-4 mb-2">$1</h3>')
    .replace(/^\*\*(.+)\*\*$/gm, '<strong>$1</strong>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-accent pl-4 text-muted-foreground italic my-3">$1</blockquote>')
    .replace(/^📌 (.+)$/gm, '<div class="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 my-3"><span>📌</span><span class="text-sm text-amber-800">$1</span></div>')
    .replace(/^• (.+)$/gm, '<li class="ml-4 text-sm text-foreground">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-foreground">$1</li>')
    .replace(/^\[x\] (.+)$/gm, '<div class="flex items-center gap-2 my-1"><span class="w-4 h-4 rounded bg-primary flex items-center justify-center text-white text-xs">✓</span><span class="text-sm line-through text-muted-foreground">$1</span></div>')
    .replace(/^\[ \] (.+)$/gm, '<div class="flex items-center gap-2 my-1"><span class="w-4 h-4 rounded border border-border"></span><span class="text-sm text-foreground">$1</span></div>')
    .replace(/^---$/gm, '<hr class="border-border my-4" />')
    .replace(/\n\n/g, '</p><p class="text-sm text-foreground leading-relaxed my-2">')
    .replace(/\n/g, '<br/>');
}

export default function NotionNotesPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [inquiryId, setInquiryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncQuery, setSyncQuery] = useState('');
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<CaseNote | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [authLoading, user, router]);

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    const { data: accessData } = await supabase
      .from('client_portal_access')
      .select('inquiry_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const iid = accessData?.inquiry_id ?? null;
    setInquiryId(iid);

    if (iid) {
      const [notesRes, caseRes] = await Promise.all([
        supabase
          .from('case_notes')
          .select('*')
          .eq('inquiry_id', iid)
          .order('created_at', { ascending: false }),
        supabase
          .from('contact_inquiries')
          .select('id, name, service, status')
          .eq('id', iid)
          .single(),
      ]);

      setNotes(notesRes.data ?? []);
      if (caseRes.data) setCaseInfo(caseRes.data);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleSync = async () => {
    if (!inquiryId) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/notion/sync-case-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: inquiryId, query: syncQuery || caseInfo?.name || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setSyncResult(`Synced ${data.synced} of ${data.total} Notion pages.`);
      await fetchNotes();
    } catch (err) {
      setSyncResult(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace('/portal/login');
  };

  const notionNotes = notes.filter((n) => n.source === 'notion');
  const manualNotes = notes.filter((n) => n.source !== 'notion');

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading case notes…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between py-3.5 gap-3">
            <Link href="/" className="inline-flex items-center gap-2.5 group shrink-0">
              <AppLogo size={28} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Broussard Legal Services
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1">
              {PORTAL_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    item.href === '/portal/notion-notes' ?'bg-primary/10 text-primary border border-primary/20' :'text-muted-foreground hover:text-foreground border border-transparent hover:border-border'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground hidden md:block truncate max-w-[140px]">{user?.email}</span>
              <button
                onClick={() => setMobileNavOpen((o) => !o)}
                className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Menu"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 disabled:opacity-60"
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

          {mobileNavOpen && (
            <div className="lg:hidden border-t border-border/60 py-3 flex flex-wrap gap-2 pb-4">
              {PORTAL_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-all duration-200"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10">
        {/* Page header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Client Portal</p>
            <h1 className="text-2xl md:text-3xl font-serif tracking-tight text-foreground">Case Notes</h1>
            {caseInfo && (
              <p className="text-sm text-muted-foreground font-light mt-1">{caseInfo.service}</p>
            )}
          </div>

          {/* Notion Sync Panel */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:w-80">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-foreground flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v16H4z" /><path d="M4 9h16M9 4v16" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-foreground">Sync from Notion</p>
            </div>
            <input
              type="text"
              value={syncQuery}
              onChange={(e) => setSyncQuery(e.target.value)}
              placeholder={caseInfo?.name ?? 'Search query…'}
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 mb-2"
            />
            <button
              onClick={handleSync}
              disabled={syncing || !inquiryId}
              className="w-full py-2 text-xs font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
              style={{ background: '#355E3B', color: 'white' }}
            >
              {syncing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Syncing…
                </span>
              ) : 'Sync Notes'}
            </button>
            {syncResult && (
              <p className={`text-[11px] mt-2 text-center ${syncResult.includes('failed') || syncResult.includes('error') ? 'text-red-600' : 'text-emerald-700'}`}>
                {syncResult}
              </p>
            )}
          </div>
        </div>

        {/* Note detail modal */}
        {selectedNote && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="bg-background border border-border rounded-2xl shadow-xl max-w-2xl w-full my-8">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                  {selectedNote.source === 'notion' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/10 text-[10px] font-semibold text-foreground uppercase tracking-widest">
                      Notion
                    </span>
                  )}
                  <p className="text-sm font-semibold text-foreground">Case Note</p>
                </div>
                <button
                  onClick={() => setSelectedNote(null)}
                  className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="px-6 py-5">
                <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
                  <span>By {selectedNote.author}</span>
                  <span>·</span>
                  <span>{formatDateTime(selectedNote.created_at)}</span>
                  {selectedNote.notion_synced_at && (
                    <>
                      <span>·</span>
                      <span>Synced {formatDateTime(selectedNote.notion_synced_at)}</span>
                    </>
                  )}
                </div>
                <div
                  className="prose-sm max-w-none text-sm text-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedNote.content) }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Notes grid */}
        {notes.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No case notes yet</p>
            <p className="text-xs text-muted-foreground mb-4">Use the Sync button above to pull notes from Notion, or ask your paralegal to add notes.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Notion-synced notes */}
            {notionNotes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-5 h-5 rounded bg-foreground flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16v16H4z" /><path d="M4 9h16M9 4v16" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">From Notion</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">{notionNotes.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {notionNotes.map((note) => {
                    const preview = note.content.replace(/[#*>📌\[\]]/g, '').slice(0, 200).trim();
                    const title = note.content.split('\n')[0].replace(/^#+\s*/, '').replace(/\*\*/g, '').trim() || 'Case Note';
                    return (
                      <button
                        key={note.id}
                        onClick={() => setSelectedNote(note)}
                        className="text-left bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <p className="text-sm font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">{title}</p>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0 mt-0.5">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">{preview}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
                          <span>{formatDate(note.created_at)}</span>
                          {note.notion_synced_at && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-600 font-medium">Synced</span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual notes */}
            {manualNotes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Paralegal Notes</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">{manualNotes.length}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {manualNotes.map((note) => {
                    const preview = note.content.slice(0, 200).trim();
                    return (
                      <button
                        key={note.id}
                        onClick={() => setSelectedNote(note)}
                        className="text-left bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#355E3B' }}>
                            {note.author}
                          </p>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">{preview}</p>
                        <p className="text-[11px] text-muted-foreground/70">{formatDate(note.created_at)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
