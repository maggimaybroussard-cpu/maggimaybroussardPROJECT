'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';

interface SignatureRequest {
  id: string;
  inquiry_id: string;
  title: string;
  document_description: string | null;
  document_content: string;
  status: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
}

interface Signature {
  id: string;
  request_id: string;
  signer_name: string;
  signer_email: string;
  signature_type: string;
  signature_data: string;
  signed_at: string;
}

interface Inquiry {
  id: string;
  name: string;
  email: string;
  service: string;
}

type SignMode = 'draw' | 'type';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'signed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
        Signed
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
        Awaiting Signature
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-red-50 text-red-700 border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-gray-100 text-gray-600 border-gray-200">
      {status}
    </span>
  );
}

export default function PortalSignaturesPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Signing modal state
  const [activeRequest, setActiveRequest] = useState<SignatureRequest | null>(null);
  const [signMode, setSignMode] = useState<SignMode>('draw');
  const [typedName, setTypedName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Canvas drawing helpers
  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const { data: accessData, error: accessError } = await supabase
        .from('client_portal_access')
        .select('inquiry_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (accessError) throw accessError;
      if (!accessData) {
        setLoading(false);
        return;
      }

      const inquiryId = accessData.inquiry_id;

      const [inquiryRes, requestsRes, signaturesRes] = await Promise.all([
        supabase.from('contact_inquiries').select('id,name,email,service').eq('id', inquiryId).single(),
        supabase.from('signature_requests').select('*').eq('inquiry_id', inquiryId).order('created_at', { ascending: false }),
        supabase.from('signatures').select('*').eq('user_id', user.id).order('signed_at', { ascending: false }),
      ]);

      if (inquiryRes.error) throw inquiryRes.error;
      setInquiry(inquiryRes.data);
      setRequests(requestsRes.data || []);
      setSignatures(signaturesRes.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load signature requests.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/portal/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/portal/login');
    } catch {
      setSigningOut(false);
    }
  };

  const openSignModal = (req: SignatureRequest) => {
    setActiveRequest(req);
    setSignMode('draw');
    setTypedName('');
    setHasDrawn(false);
    setSubmitError(null);
    setSuccessId(null);
  };

  const closeModal = () => {
    setActiveRequest(null);
    clearCanvas();
    setTypedName('');
    setHasDrawn(false);
    setSubmitError(null);
  };

  const getSignatureData = (): string | null => {
    if (signMode === 'type') {
      return typedName.trim() ? `typed:${typedName.trim()}` : null;
    }
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return null;
    return canvas.toDataURL('image/png');
  };

  const handleDownloadPDF = async (req: SignatureRequest) => {
    const sig = signatures.find((s) => s.request_id === req.id);
    if (!sig) return;

    setDownloadingId(req.id);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 60;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // Header bar
      doc.setFillColor(53, 94, 59);
      doc.rect(0, 0, pageWidth, 8, 'F');

      // Firm name
      doc.setFont('times', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(53, 94, 59);
      doc.text('Maggi May Broussard', margin, y + 30);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text('Legal Services  ·  broussardlegalservices.com', margin, y + 46);

      // Divider
      y += 64;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 20;

      // Document title
      doc.setFont('times', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(30, 30, 30);
      doc.text(req.title, margin, y);
      y += 18;

      if (req.document_description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        const descLines = doc.splitTextToSize(req.document_description, contentWidth);
        doc.text(descLines, margin, y);
        y += descLines.length * 14 + 6;
      }

      // Metadata row
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(130, 130, 130);
      doc.text(`Prepared by: ${req.created_by}   ·   Issued: ${formatDate(req.created_at)}`, margin, y);
      y += 20;

      // Divider
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageWidth - margin, y);
      y += 20;

      // Document content
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      const contentLines = doc.splitTextToSize(req.document_content, contentWidth);
      const lineHeight = 14;

      for (let i = 0; i < contentLines.length; i++) {
        if (y + lineHeight > pageHeight - 160) {
          doc.addPage();
          // Footer bar on new page
          doc.setFillColor(53, 94, 59);
          doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');
          y = margin;
        }
        doc.text(contentLines[i], margin, y);
        y += lineHeight;
      }

      // Signature section
      y += 20;
      if (y + 120 > pageHeight - 60) {
        doc.addPage();
        doc.setFillColor(53, 94, 59);
        doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');
        y = margin;
      }

      // Signature box
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(250, 252, 250);
      doc.roundedRect(margin, y, contentWidth, 110, 4, 4, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(53, 94, 59);
      doc.text('ELECTRONIC SIGNATURE', margin + 16, y + 18);

      // Signature image or typed name
      if (sig.signature_type === 'drawn' && sig.signature_data?.startsWith('data:image')) {
        try {
          doc.addImage(sig.signature_data, 'PNG', margin + 16, y + 24, 180, 50);
        } catch {
          doc.setFont('times', 'italic');
          doc.setFontSize(20);
          doc.setTextColor(30, 30, 30);
          doc.text(sig.signer_name, margin + 16, y + 58);
        }
      } else {
        const displayName = sig.signature_data?.startsWith('typed:')
          ? sig.signature_data.replace('typed:', '')
          : sig.signer_name;
        doc.setFont('times', 'italic');
        doc.setFontSize(22);
        doc.setTextColor(30, 30, 30);
        doc.text(displayName, margin + 16, y + 62);
      }

      // Signature line
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.5);
      doc.line(margin + 16, y + 80, margin + 220, y + 80);

      // Signer details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`Name: ${sig.signer_name}`, margin + 16, y + 92);
      doc.text(`Email: ${sig.signer_email}`, margin + 16, y + 103);

      // Timestamp on right side
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(53, 94, 59);
      doc.text('Signed:', margin + contentWidth - 180, y + 40);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const signedDate = new Date(sig.signed_at);
      doc.text(signedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), margin + contentWidth - 180, y + 52);
      doc.text(signedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }), margin + contentWidth - 180, y + 64);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      doc.text(`Signature ID: ${sig.id}`, margin + contentWidth - 180, y + 80);

      // Footer bar
      doc.setFillColor(53, 94, 59);
      doc.rect(0, pageHeight - 6, pageWidth, 6, 'F');

      // Footer text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(160, 160, 160);
      doc.text('This document was electronically signed via the Broussard Legal Services client portal.', margin, pageHeight - 16);
      doc.text(`Generated: ${new Date().toLocaleString('en-US')}`, pageWidth - margin, pageHeight - 16, { align: 'right' });

      const fileName = `${req.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_signed.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSubmitSignature = async () => {
    if (!user || !inquiry || !activeRequest) return;
    const sigData = getSignatureData();
    if (!sigData) {
      setSubmitError(signMode === 'draw' ? 'Please draw your signature before submitting.' : 'Please type your full name to sign.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const supabase = createClient();

      const { error: sigError } = await supabase.from('signatures').insert({
        request_id: activeRequest.id,
        inquiry_id: inquiry.id,
        user_id: user.id,
        signer_name: inquiry.name,
        signer_email: inquiry.email,
        signature_data: sigData,
        signature_type: signMode,
        signed_at: new Date().toISOString(),
      });

      if (sigError) throw sigError;

      // Update request status to signed
      await supabase
        .from('signature_requests')
        .update({ status: 'signed' })
        .eq('id', activeRequest.id);

      setSuccessId(activeRequest.id);
      await fetchData();

      setTimeout(() => {
        closeModal();
      }, 2500);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit signature. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isSigned = (requestId: string) => signatures.some((s) => s.request_id === requestId);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
          <div className="max-w-5xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
            <div className="w-28 h-7 bg-muted/60 rounded-lg animate-pulse" />
            <div className="w-20 h-8 bg-muted/60 rounded-lg animate-pulse" />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 md:px-10 py-10">
          <div className="w-48 h-8 bg-muted/60 rounded-lg animate-pulse mb-8" />
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6">
                <div className="w-64 h-5 bg-muted/50 rounded animate-pulse mb-3" />
                <div className="w-40 h-4 bg-muted/40 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 md:px-10">
          <div className="flex items-center justify-between py-3.5">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <AppLogo size={30} className="transition-transform duration-300 group-hover:scale-105" />
              <span className="font-serif text-sm tracking-tight hidden sm:block" style={{ color: '#355E3B' }}>
                Maggi May Broussard
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/portal/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link
                href="/portal/cases"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="hidden sm:inline">Cases</span>
              </Link>
              <Link
                href="/portal/documents"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="hidden sm:inline">Documents</span>
              </Link>
              <Link
                href="/portal/signatures"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold uppercase tracking-widest transition-all duration-200"
                style={{ borderColor: '#355E3B', color: '#355E3B', background: 'rgba(53,94,59,0.06)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span className="hidden sm:inline">Signatures</span>
              </Link>
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

      {/* ── Main content ── */}
      <main className="max-w-5xl mx-auto px-4 md:px-10 py-8 md:py-10">
        {/* Page header */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Client Portal</p>
          <h1 className="text-2xl font-serif font-semibold text-foreground">E-Signatures</h1>
          {inquiry && (
            <p className="text-sm text-muted-foreground mt-1">
              Documents requiring your signature for <span className="font-medium text-foreground">{inquiry.service}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* No portal access */}
        {!inquiry && !loading && (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No portal access found</p>
            <p className="text-xs text-muted-foreground">Your account is not yet linked to a case. Please contact Maggi May Broussard.</p>
          </div>
        )}

        {/* Empty state */}
        {inquiry && requests.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(53,94,59,0.08)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No documents to sign yet</p>
            <p className="text-xs text-muted-foreground">When Maggi May sends you an engagement letter or agreement, it will appear here for your signature.</p>
          </div>
        )}

        {/* Signature requests list */}
        {requests.length > 0 && (
          <div className="space-y-4">
            {requests.map((req) => {
              const signed = isSigned(req.id) || req.status === 'signed';
              const sig = signatures.find((s) => s.request_id === req.id);
              return (
                <div
                  key={req.id}
                  className="bg-card border border-border rounded-2xl overflow-hidden transition-shadow hover:shadow-sm"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h2 className="text-base font-semibold text-foreground">{req.title}</h2>
                          <StatusBadge status={signed ? 'signed' : req.status} />
                        </div>
                        {req.document_description && (
                          <p className="text-sm text-muted-foreground mb-3">{req.document_description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Sent by {req.created_by}</span>
                          <span>·</span>
                          <span>{formatDate(req.created_at)}</span>
                          {req.expires_at && !signed && (
                            <>
                              <span>·</span>
                              <span className="text-amber-600">Expires {formatDate(req.expires_at)}</span>
                            </>
                          )}
                          {signed && sig && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-600">Signed {formatDateTime(sig.signed_at)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
                        {!signed && req.status !== 'expired' && (
                          <button
                            onClick={() => openSignModal(req)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest transition-all duration-200 hover:opacity-90"
                            style={{ background: '#355E3B', color: '#fff' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                            Sign Now
                          </button>
                        )}
                        {signed && (
                          <>
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Completed
                            </div>
                            <button
                              onClick={() => handleDownloadPDF(req)}
                              disabled={downloadingId === req.id}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all duration-200 disabled:opacity-50"
                            >
                              {downloadingId === req.id ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                              )}
                              Download PDF
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Document preview (collapsed) */}
                    <details className="mt-4 group">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-1.5">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-90">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        View Document
                      </summary>
                      <div className="mt-3 p-4 rounded-xl bg-muted/30 border border-border/60 text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed font-mono text-xs max-h-64 overflow-y-auto">
                        {req.document_content}
                      </div>
                    </details>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Signature Modal ── */}
      {activeRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">{activeRequest.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Review and sign the document below</p>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Success state */}
            {successId === activeRequest.id ? (
              <div className="px-6 py-12 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(53,94,59,0.1)' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-foreground mb-1">Document Signed</p>
                <p className="text-sm text-muted-foreground">Your signature has been recorded with a timestamp. Use the Download PDF button to save a copy.</p>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-5">
                {/* Document preview */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Document</p>
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/60 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed font-mono max-h-40 overflow-y-auto">
                    {activeRequest.document_content}
                  </div>
                </div>

                {/* Signature mode toggle */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Signature Method</p>
                  <div className="flex rounded-xl border border-border overflow-hidden">
                    <button
                      onClick={() => { setSignMode('draw'); clearCanvas(); }}
                      className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all ${signMode === 'draw' ? 'text-white' : 'text-muted-foreground hover:text-foreground bg-background'}`}
                      style={signMode === 'draw' ? { background: '#355E3B' } : {}}
                    >
                      Draw
                    </button>
                    <button
                      onClick={() => setSignMode('type')}
                      className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all ${signMode === 'type' ? 'text-white' : 'text-muted-foreground hover:text-foreground bg-background'}`}
                      style={signMode === 'type' ? { background: '#355E3B' } : {}}
                    >
                      Type
                    </button>
                  </div>
                </div>

                {/* Draw signature */}
                {signMode === 'draw' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Draw Your Signature</p>
                      <button
                        onClick={clearCanvas}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="rounded-xl border-2 border-dashed border-border overflow-hidden bg-white relative" style={{ touchAction: 'none' }}>
                      <canvas
                        ref={canvasRef}
                        width={480}
                        height={160}
                        className="w-full cursor-crosshair block"
                        style={{ height: '160px' }}
                        onMouseDown={startDraw}
                        onMouseMove={draw}
                        onMouseUp={endDraw}
                        onMouseLeave={endDraw}
                        onTouchStart={startDraw}
                        onTouchMove={draw}
                        onTouchEnd={endDraw}
                      />
                      {!hasDrawn && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <p className="text-xs text-muted-foreground/50">Sign here using your mouse or finger</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Type signature */}
                {signMode === 'type' && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Type Your Full Name</p>
                    <input
                      type="text"
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="Your full legal name"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                      style={{ fontFamily: 'Georgia, serif', fontSize: '18px' }}
                    />
                    {typedName && (
                      <div className="mt-3 p-4 rounded-xl border border-border bg-white text-center">
                        <span style={{ fontFamily: 'Georgia, serif', fontSize: '22px', color: '#1a1a1a' }}>{typedName}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Legal notice */}
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    By clicking <strong>Submit Signature</strong>, you agree that your electronic signature is legally binding and equivalent to a handwritten signature. Your signature, name, email, and timestamp will be recorded.
                  </p>
                </div>

                {submitError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                    {submitError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pb-1">
                  <button
                    onClick={closeModal}
                    className="flex-1 py-3 rounded-full border border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitSignature}
                    disabled={submitting || (signMode === 'draw' && !hasDrawn) || (signMode === 'type' && !typedName.trim())}
                    className="flex-1 py-3 rounded-full text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: '#355E3B', color: '#fff' }}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Submitting…
                      </span>
                    ) : 'Submit Signature'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
