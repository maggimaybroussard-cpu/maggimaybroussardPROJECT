'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contract {
  id: string;
  title: string;
  description: string | null;
  contract_type: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  status: string;
  signed_at: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  version: string | null;
  tags: string[] | null;
  is_template: boolean;
  notes: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  general: 'Service Agreement',
  retainer: 'Retainer Contract',
  nda: 'Non-Disclosure Agreement',
  engagement: 'Engagement Letter',
  intake: 'Intake Form',
  addendum: 'Addendum',
  amendment: 'Amendment',
  template: 'Template',
};

const STATUS_CONFIG: Record<string, { label: string; pill: string }> = {
  active: { label: 'Active', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  signed: { label: 'Signed', pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  pending_signature: { label: 'Awaiting Signature', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Expired', pill: 'bg-gray-100 text-gray-500 border-gray-200' },
  terminated: { label: 'Terminated', pill: 'bg-red-50 text-red-600 border-red-200' },
  draft: { label: 'Draft', pill: 'bg-gray-100 text-gray-500 border-gray-200' },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function ClientContractsPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const fetchContracts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = createClient();

      const { data: accessData } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const inquiryId = accessData?.inquiry_id ?? null;

      let query = supabase
        .from('contracts_repository')
        .select('id,title,description,contract_type,file_name,file_url,file_size,file_type,status,signed_at,effective_date,expiry_date,version,tags,is_template,notes,created_at')
        .eq('visible_to_client', true)
        .order('created_at', { ascending: false });

      if (inquiryId) {
        query = query.or(`user_id.eq.${user.id},inquiry_id.eq.${inquiryId}`);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setContracts(data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login?redirectTo=/client/contracts');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchContracts();
  }, [user, fetchContracts]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  const handleDownload = async (contract: Contract) => {
    setDownloadingId(contract.id);
    try {
      const supabase = createClient();
      // Try to get a signed URL from storage
      const { data, error } = await supabase.storage
        .from('case-documents')
        .createSignedUrl(contract.file_url, 3600);

      if (!error && data?.signedUrl) {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.download = contract.file_name;
        a.target = '_blank';
        a.click();
      } else {
        // Fallback: open direct URL
        window.open(contract.file_url, '_blank');
      }
    } catch {
      window.open(contract.file_url, '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const contractTypes = ['all', ...Array.from(new Set(contracts.map((c) => c.contract_type)))];

  const filtered = contracts.filter((c) => {
    const matchesType = filterType === 'all' || c.contract_type === filterType;
    const matchesSearch =
      !searchQuery ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // ── Loading ───────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-5xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
            <div className="w-28 h-6 bg-muted/60 rounded-lg animate-pulse" />
            <div className="w-20 h-8 bg-muted/60 rounded-lg animate-pulse" />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-5 md:px-8 py-10 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 h-24 animate-pulse" />
          ))}
        </main>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div className="flex items-center justify-between py-3.5 gap-3">
            <Link href="/client/dashboard" className="inline-flex items-center gap-2.5 group shrink-0">
              <AppLogo className="h-7 w-auto" />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {[
                { href: '/client/dashboard', label: 'Dashboard' },
                { href: '/client/invoices', label: 'Invoices' },
                { href: '/client/contracts', label: 'Contracts' },
                { href: '/portal/documents', label: 'Documents' },
                { href: '/portal/messages', label: 'Messages' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    item.href === '/client/contracts' ?'bg-primary/10 text-primary' :'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
              <button
                className="md:hidden p-2 rounded-lg hover:bg-muted/60 transition-colors"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileNavOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          {mobileNavOpen && (
            <div className="md:hidden border-t border-border/60 py-3 space-y-1">
              {[
                { href: '/client/dashboard', label: 'Dashboard' },
                { href: '/client/invoices', label: 'Invoices' },
                { href: '/client/contracts', label: 'Contracts' },
                { href: '/portal/documents', label: 'Documents' },
                { href: '/portal/messages', label: 'Messages' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    item.href === '/client/contracts' ?'bg-primary/10 text-primary' :'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                  onClick={() => setMobileNavOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-8 py-8">

        {/* Page title */}
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Legal Documents</p>
          <h1 className="text-2xl font-bold text-foreground">Contract Repository</h1>
          <p className="text-sm text-muted-foreground mt-1">Securely access and download all contracts and agreements associated with your engagement.</p>
        </div>

        {/* Security notice */}
        <div className="mb-6 flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-xl px-5 py-3.5">
          <svg className="w-4 h-4 text-primary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-sm text-foreground">
            <span className="font-semibold">Secure access.</span> These documents are encrypted and accessible only to you and Broussard Legal Services. Download links expire after 1 hour.
          </p>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search contracts…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {contractTypes.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : CONTRACT_TYPE_LABELS[type] ?? type}
              </option>
            ))}
          </select>
        </div>

        {/* Contract count */}
        {contracts.length > 0 && (
          <p className="text-xs text-muted-foreground mb-4">
            Showing {filtered.length} of {contracts.length} contract{contracts.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Contract list */}
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {searchQuery || filterType !== 'all' ? 'No contracts match your search' : 'No contracts yet'}
            </p>
            <p className="text-xs text-muted-foreground">
              {searchQuery || filterType !== 'all' ?'Try adjusting your search or filter.' :'Your contracts and agreements will appear here once uploaded by Broussard Legal Services.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((contract) => {
              const statusCfg = STATUS_CONFIG[contract.status] ?? STATUS_CONFIG.active;
              const typeLabel = CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type;
              const isDownloading = downloadingId === contract.id;

              return (
                <div key={contract.id} className="bg-card border border-border rounded-2xl p-5 hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-4">
                    {/* File icon */}
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-foreground">{contract.title}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.pill}`}>
                          {statusCfg.label}
                        </span>
                        {contract.is_template && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200">
                            Template
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-2">
                        <span>{typeLabel}</span>
                        {contract.version && <span>v{contract.version}</span>}
                        <span>Added {fmtDate(contract.created_at)}</span>
                        {contract.effective_date && <span>Effective {fmtDate(contract.effective_date)}</span>}
                        {contract.signed_at && <span className="text-emerald-600 font-medium">Signed {fmtDate(contract.signed_at)}</span>}
                        {contract.expiry_date && <span>Expires {fmtDate(contract.expiry_date)}</span>}
                        {contract.file_size && <span>{fmtFileSize(contract.file_size)}</span>}
                      </div>

                      {contract.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{contract.description}</p>
                      )}

                      {contract.tags && contract.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {contract.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-muted/60 text-muted-foreground border border-border/60">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleDownload(contract)}
                          disabled={isDownloading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                        >
                          {isDownloading ? (
                            <>
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Preparing…
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </>
                          )}
                        </button>

                        <span className="text-xs text-muted-foreground">{contract.file_name}</span>
                      </div>
                    </div>
                  </div>

                  {contract.notes && (
                    <div className="mt-3 pt-3 border-t border-border/60">
                      <p className="text-xs text-muted-foreground"><span className="font-medium">Note:</span> {contract.notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Link to standard contracts */}
        <div className="mt-8 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Standard Service Agreements</p>
              <p className="text-xs text-muted-foreground mb-3">View and download Broussard Legal Services standard contract templates including the Service Agreement, Retainer Contract, and Intake Invoice Form.</p>
              <Link
                href="/contracts"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                View standard contracts
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
