'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseDocument {
  id: string;
  inquiry_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  document_type: string | null;
  category: string | null;
  description: string | null;
  client_visible: boolean;
  created_at: string;
}

interface Inquiry {
  id: string;
  name: string;
  service: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  { value: 'discovery', label: 'Discovery', icon: '🔍', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'filing', label: 'Pleading / Filing', icon: '⚖️', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'correspondence', label: 'Correspondence', icon: '✉️', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'evidence', label: 'Evidence', icon: '🗂️', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'contract', label: 'Contract', icon: '📄', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'work_product', label: 'Work Product', icon: '📝', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'other', label: 'Other', icon: '📁', color: 'bg-gray-100 text-gray-600 border-gray-200' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDocTypeConfig(type: string | null) {
  return DOCUMENT_TYPES.find(t => t.value === type) || DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1];
}

function getFileIcon(fileType: string | null): string {
  if (!fileType) return '📄';
  if (fileType.includes('pdf')) return '📕';
  if (fileType.includes('word') || fileType.includes('doc')) return '📘';
  if (fileType.includes('excel') || fileType.includes('sheet') || fileType.includes('xls')) return '📗';
  if (fileType.includes('image')) return '🖼️';
  if (fileType.includes('text')) return '📃';
  return '📄';
}

// ── Portal Nav Items ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/portal/dashboard', label: 'Dashboard' },
  { href: '/portal/cases', label: 'My Cases' },
  { href: '/portal/case-status', label: 'Case Status' },
  { href: '/portal/files', label: 'File Repository' },
  { href: '/portal/documents', label: 'Documents' },
  { href: '/portal/messages', label: 'Messages' },
  { href: '/portal/invoices', label: 'Invoices' },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ClientFileRepositoryPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // ── Auth Guard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/portal/login');
    }
  }, [user, authLoading, router]);

  // ── Data Fetching ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Get client portal access to find inquiry
      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const inquiryId = accessData?.inquiry_id ?? null;
      if (!inquiryId) {
        setLoading(false);
        return;
      }

      // Fetch inquiry details
      const { data: inquiryData } = await supabase
        .from('contact_inquiries')
        .select('id, name, service')
        .eq('id', inquiryId)
        .maybeSingle();

      setInquiry(inquiryData || null);

      // Fetch documents shared with client (client_visible = true)
      const { data: docsData, error: docsError } = await supabase
        .from('case_documents')
        .select('id, inquiry_id, file_name, file_url, file_type, file_size, uploaded_by, document_type, category, description, client_visible, created_at')
        .eq('inquiry_id', inquiryId)
        .eq('client_visible', true)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;
      setDocuments(docsData || []);
    } catch (err: any) {
      setError('Failed to load your file repository. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // ── Download with Audit ──────────────────────────────────────────────────────

  const handleDownload = async (doc: CaseDocument) => {
    if (!inquiry) return;
    setDownloadingId(doc.id);
    try {
      const supabase = createClient();

      // Log in document_download_history
      await supabase.from('document_download_history').insert({
        document_id: doc.id,
        inquiry_id: inquiry.id,
        downloaded_by: user?.email || 'Client',
        downloaded_by_role: 'client',
        file_name: doc.file_name,
      });

      // Log in file_repository_audit
      await supabase.from('file_repository_audit').insert({
        inquiry_id: inquiry.id,
        document_id: doc.id,
        action_type: 'download',
        actor_name: user?.email || 'Client',
        actor_role: 'client',
        file_name: doc.file_name,
        document_type: doc.document_type,
      });

      // Open file
      window.open(doc.file_url, '_blank');
    } catch {
      // Still open the file even if audit fails
      window.open(doc.file_url, '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Filtered Documents ───────────────────────────────────────────────────────

  const filteredDocs = documents.filter(doc => {
    const matchesType = filterType === 'all' || doc.document_type === filterType;
    const matchesSearch = !searchQuery ||
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // ── Group by type ────────────────────────────────────────────────────────────

  const docsByType = DOCUMENT_TYPES.reduce<Record<string, CaseDocument[]>>((acc, dt) => {
    acc[dt.value] = documents.filter(d => (d.document_type || 'other') === dt.value);
    return acc;
  }, {});

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await signOut(); router.replace('/portal/login'); } catch { setSigningOut(false); }
  };

  // ── Loading / Auth ───────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Nav ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/portal/dashboard">
              <AppLogo className="h-7 w-auto" />
            </Link>
            <span className="hidden sm:block text-xs text-muted-foreground">Client Portal</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${item.href === '/portal/files' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileNavOpen ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-border/60 bg-background px-4 py-3 space-y-1">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${item.href === '/portal/files' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
              >
                {item.label}
              </Link>
            ))}
            <button onClick={handleSignOut} className="block w-full text-left px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              Sign out
            </button>
          </div>
        )}
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">File Repository</h1>
          {inquiry && (
            <p className="text-sm text-muted-foreground mt-1">
              Documents shared by your attorney for <span className="font-medium text-foreground">{inquiry.name}</span>
            </p>
          )}
          {!inquiry && (
            <p className="text-sm text-muted-foreground mt-1">Documents shared by your attorney will appear here.</p>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {/* Stats row */}
        {documents.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {DOCUMENT_TYPES.filter(dt => docsByType[dt.value]?.length > 0).map(dt => (
              <button
                key={dt.value}
                onClick={() => setFilterType(filterType === dt.value ? 'all' : dt.value)}
                className={`p-3 rounded-xl border text-left transition-colors ${filterType === dt.value ? 'border-primary bg-primary/5' : 'border-border/60 bg-card hover:border-primary/20'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{dt.icon}</span>
                  <span className="text-lg font-bold text-foreground">{docsByType[dt.value]?.length || 0}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">{dt.label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Search + filter bar */}
        {documents.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <div className="relative">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 w-52"
              />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${filterType === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/40'}`}
              >
                All ({documents.length})
              </button>
              {DOCUMENT_TYPES.filter(dt => docsByType[dt.value]?.length > 0).map(dt => (
                <button
                  key={dt.value}
                  onClick={() => setFilterType(filterType === dt.value ? 'all' : dt.value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${filterType === dt.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/40'}`}
                >
                  {dt.icon} {dt.label} ({docsByType[dt.value]?.length})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Document list */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">No documents shared yet</h3>
            <p className="text-xs text-muted-foreground max-w-xs">Your attorney will share discovery documents, pleadings, correspondence, and evidence here as your case progresses.</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-foreground mb-1">No documents match your filters</p>
            <button onClick={() => { setFilterType('all'); setSearchQuery(''); }} className="text-xs text-primary hover:underline mt-1">Clear filters</button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocs.map(doc => {
              const typeConfig = getDocTypeConfig(doc.document_type);
              const isDownloading = downloadingId === doc.id;
              return (
                <div key={doc.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:border-primary/20 hover:shadow-sm transition-all group">
                  {/* File icon */}
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-xl">
                    {getFileIcon(doc.file_type)}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{doc.file_name}</p>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${typeConfig.color}`}>
                        {typeConfig.icon} {typeConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">{fmtBytes(doc.file_size)}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">Shared {fmtDate(doc.created_at)}</span>
                      {doc.description && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.description}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Download button */}
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={isDownloading}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    )}
                    {isDownloading ? 'Opening...' : 'Download'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Info note */}
        {documents.length > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-xs text-blue-700">All document downloads are logged for security and compliance purposes. Your attorney can see when you access each document.</p>
          </div>
        )}
      </main>
    </div>
  );
}
