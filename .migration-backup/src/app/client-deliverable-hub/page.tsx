'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import LegalSecretaryAssistant from '@/components/LegalSecretaryAssistant';

interface CaseDocument {
  id: string;
  inquiry_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  uploaded_by_role?: string;
  category: string | null;
  description: string | null;
  version: number;
  created_at: string;
  document_type: string | null;
  deliverable_status?: 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected' | null;
  deliverable_type?: string | null;
  due_date?: string | null;
  client_visible?: boolean;
  status_notes?: string | null;
}

interface Inquiry {
  id: string;
  name: string;
  service: string;
  status: string;
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  contracts: { label: 'Contracts', icon: '📄', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  intake: { label: 'Intake Documents', icon: '📋', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  discovery: { label: 'Discovery', icon: '🔍', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  work_product: { label: 'Work Product', icon: '✏️', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  court_filings: { label: 'Filed Documents', icon: '🏛️', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  case_files: { label: 'Case Files', icon: '📁', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
  correspondence: { label: 'Correspondence', icon: '✉️', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  other: { label: 'Other', icon: '📎', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
};

const FILE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  PDF: { bg: 'bg-red-50', text: 'text-red-600' },
  DOC: { bg: 'bg-blue-50', text: 'text-blue-600' },
  DOCX: { bg: 'bg-blue-50', text: 'text-blue-600' },
  XLS: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  XLSX: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  JPEG: { bg: 'bg-purple-50', text: 'text-purple-600' },
  PNG: { bg: 'bg-purple-50', text: 'text-purple-600' },
  TXT: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeBadge({ type }: { type: string | null }) {
  const t = (type ?? 'FILE').toUpperCase().slice(0, 4);
  const colors = FILE_TYPE_COLORS[t] ?? { bg: 'bg-gray-100', text: 'text-gray-500' };
  return (
    <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-[10px] font-bold uppercase tracking-wide shrink-0 ${colors.bg} ${colors.text}`}>
      {t}
    </span>
  );
}

export default function ClientDeliverableHub() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedInquiry, setSelectedInquiry] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAssistant, setShowAssistant] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [recentDownloads, setRecentDownloads] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/portal/login?redirect=/client-deliverable-hub');
    }
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: inqData } = await supabase
        .from('inquiries')
        .select('id, name, service, status')
        .eq('client_user_id', user.id)
        .order('created_at', { ascending: false });

      const inquiryList = inqData ?? [];
      setInquiries(inquiryList);

      if (inquiryList.length > 0) {
        const ids = inquiryList.map((i: Inquiry) => i.id);
        const { data: docData } = await supabase
          .from('case_documents')
          .select('*')
          .in('inquiry_id', ids)
          .order('created_at', { ascending: false });
        setDocuments(docData ?? []);
      }
    } catch (err) {
      console.error('Error fetching deliverables:', err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleDownload = async (doc: CaseDocument) => {
    setDownloadingId(doc.id);
    try {
      const { data } = await supabase.storage
        .from('case-documents')
        .createSignedUrl(doc.file_url, 300);

      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = doc.file_name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setRecentDownloads(prev => [doc.id, ...prev.slice(0, 4)]);

        await supabase.from('document_download_history').insert({
          document_id: doc.id,
          downloaded_by: user?.id,
          downloaded_at: new Date().toISOString(),
        }).select();
      }
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchInquiry = selectedInquiry === 'all' || doc.inquiry_id === selectedInquiry;
    const matchSearch = !searchQuery ||
      doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchInquiry && matchSearch;
  });

  const categoryCounts = documents.reduce<Record<string, number>>((acc, doc) => {
    const cat = doc.category ?? 'other';
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});

  const getInquiryName = (id: string) => inquiries.find(i => i.id === id)?.name ?? 'Unknown Matter';

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/portal/dashboard">
              <AppLogo className="h-8 w-auto" />
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>/</span>
              <span className="text-foreground font-medium">Deliverable Hub</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAssistant(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-all shadow-sm shadow-primary/20"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 8v4l3 3"/>
              </svg>
              <span className="hidden sm:inline">AI Secretary</span>
              <span className="sm:hidden">AI</span>
            </button>
            <Link href="/portal/dashboard" className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif text-foreground mb-1">Client Deliverable Hub</h1>
              <p className="text-muted-foreground text-sm">All your legal documents, organized and ready to download.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/60 rounded-xl px-4 py-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>Secure · Encrypted · Private</span>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total Documents', value: documents.length, icon: '📄' },
            { label: 'Active Matters', value: inquiries.filter(i => i.status !== 'closed').length, icon: '⚖️' },
            { label: 'Recent Downloads', value: recentDownloads.length, icon: '⬇️' },
            { label: 'Categories', value: Object.keys(categoryCounts).length, icon: '🗂️' },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{stat.icon}</span>
                <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="lg:w-56 shrink-0">
            <div className="bg-card border border-border rounded-2xl p-4 sticky top-24">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">Categories</p>
              <nav className="flex flex-col gap-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${selectedCategory === 'all' ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground hover:bg-secondary'}`}
                >
                  <span className="flex items-center gap-2">
                    <span>🗂️</span> All Documents
                  </span>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${selectedCategory === 'all' ? 'bg-white/20' : 'bg-secondary text-muted-foreground'}`}>
                    {documents.length}
                  </span>
                </button>
                {Object.entries(CATEGORY_META).map(([key, meta]) => {
                  const count = categoryCounts[key] ?? 0;
                  if (count === 0) return null;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedCategory(key)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all ${selectedCategory === key ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground hover:bg-secondary'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{meta.icon}</span>
                        <span className="truncate">{meta.label}</span>
                      </span>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${selectedCategory === key ? 'bg-white/20' : 'bg-secondary text-muted-foreground'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>

              {inquiries.length > 1 && (
                <>
                  <div className="border-t border-border my-3" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">Matters</p>
                  <nav className="flex flex-col gap-1">
                    <button
                      onClick={() => setSelectedInquiry('all')}
                      className={`px-3 py-2 rounded-xl text-sm text-left transition-all ${selectedInquiry === 'all' ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground hover:bg-secondary'}`}
                    >
                      All Matters
                    </button>
                    {inquiries.map(inq => (
                      <button
                        key={inq.id}
                        onClick={() => setSelectedInquiry(inq.id)}
                        className={`px-3 py-2 rounded-xl text-sm text-left truncate transition-all ${selectedInquiry === inq.id ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground hover:bg-secondary'}`}
                      >
                        {inq.name}
                      </button>
                    ))}
                  </nav>
                </>
              )}
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex-1 min-w-0 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
              </div>
              <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Results count */}
            {!loading && (
              <p className="text-xs text-muted-foreground mb-4">
                {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}
                {selectedCategory !== 'all' && ` in ${CATEGORY_META[selectedCategory]?.label ?? selectedCategory}`}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading your documents…</p>
              </div>
            )}

            {/* Empty state */}
            {!loading && filteredDocs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-2xl">
                  {searchQuery ? '🔍' : '📭'}
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">
                    {searchQuery ? 'No documents found' : documents.length === 0 ? 'No documents yet' : 'No documents in this category'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'Try a different search term.' : documents.length === 0 ? 'Your attorney will upload documents as your matter progresses.' : 'Select a different category or view all documents.'}
                  </p>
                </div>
                {(searchQuery || selectedCategory !== 'all') && (
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                    className="text-sm text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {/* Grid view */}
            {!loading && filteredDocs.length > 0 && viewMode === 'grid' && (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredDocs.map(doc => {
                  const catMeta = CATEGORY_META[doc.category ?? 'other'] ?? CATEGORY_META.other;
                  const isDownloading = downloadingId === doc.id;
                  const wasDownloaded = recentDownloads.includes(doc.id);
                  return (
                    <div key={doc.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-md transition-all duration-200 group flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <FileTypeBadge type={doc.file_type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate leading-tight">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(doc.created_at)}</p>
                        </div>
                      </div>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${catMeta.bg} ${catMeta.color} ${catMeta.border} border`}>
                          {catMeta.icon} {catMeta.label}
                        </span>
                        {doc.deliverable_status && doc.deliverable_status !== 'pending' && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            doc.deliverable_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                            doc.deliverable_status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            doc.deliverable_status === 'in_progress'? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}>
                            {doc.deliverable_status === 'approved' ? '✓ Approved' :
                             doc.deliverable_status === 'completed' ? '✓ Completed' :
                             doc.deliverable_status === 'in_progress' ? '⚡ In Progress' :
                             doc.deliverable_status}
                          </span>
                        )}
                        {doc.due_date && (
                          <span className="text-[10px] text-muted-foreground">Due {formatDate(doc.due_date)}</span>
                        )}
                        {doc.file_size && (
                          <span className="text-[10px] text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                        )}
                        {wasDownloaded && (
                          <span className="text-[10px] text-emerald-600 font-medium">✓ Downloaded</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-auto pt-1">
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={isDownloading}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-60"
                        >
                          {isDownloading ? (
                            <><div className="w-3 h-3 border border-primary-foreground border-t-transparent rounded-full animate-spin" /> Downloading…</>
                          ) : (
                            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</>
                          )}
                        </button>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 border border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* List view */}
            {!loading && filteredDocs.length > 0 && viewMode === 'list' && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="divide-y divide-border">
                  {filteredDocs.map(doc => {
                    const catMeta = CATEGORY_META[doc.category ?? 'other'] ?? CATEGORY_META.other;
                    const isDownloading = downloadingId === doc.id;
                    const wasDownloaded = recentDownloads.includes(doc.id);
                    return (
                      <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors group">
                        <FileTypeBadge type={doc.file_type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{doc.file_name}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${catMeta.bg} ${catMeta.color}`}>
                              {catMeta.icon} {catMeta.label}
                            </span>
                            {doc.file_size && <span className="text-[10px] text-muted-foreground">{formatFileSize(doc.file_size)}</span>}
                            {wasDownloaded && <span className="text-[10px] text-emerald-600 font-medium">✓ Downloaded</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={isDownloading}
                            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-60"
                          >
                            {isDownloading ? (
                              <div className="w-3 h-3 border border-primary-foreground border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            )}
                            <span className="hidden sm:inline">{isDownloading ? 'Downloading…' : 'Download'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* AI Legal Secretary */}
      {showAssistant && (
        <LegalSecretaryAssistant onClose={() => setShowAssistant(false)} />
      )}
    </div>
  );
}
