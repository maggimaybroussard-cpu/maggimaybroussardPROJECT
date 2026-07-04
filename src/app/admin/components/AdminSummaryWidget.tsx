'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';


interface SummaryData {
  pendingConsultations: number;
  upcomingConsultations: number;
  recentSubmissions: RecentSubmission[];
  totalSubmissionsToday: number;
  newLeads: number;
  pendingInvoices: number;
}

interface RecentSubmission {
  id: string;
  name: string;
  email: string;
  service: string;
  status: string;
  created_at: string;
}

interface QuickLink {
  label: string;
  description: string;
  href?: string;
  tab?: string;
  icon: React.ReactNode;
  color: string;
  external?: boolean;
}

interface AdminSummaryWidgetProps {
  onNavigate?: (tab: string) => void;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  in_review: 'bg-amber-100 text-amber-700',
  contacted: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-gray-100 text-gray-500',
};

export default function AdminSummaryWidget({ onNavigate }: AdminSummaryWidgetProps) {
  const supabase = createClient();
  const [data, setData] = useState<SummaryData>({
    pendingConsultations: 0,
    upcomingConsultations: 0,
    recentSubmissions: [],
    totalSubmissionsToday: 0,
    newLeads: 0,
    pendingInvoices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [submissionsRes, consultationsRes, invoicesRes] = await Promise.allSettled([
        supabase
          .from('contact_inquiries')
          .select('id, name, email, service, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('contact_inquiries')
          .select('id, status, booking_stage, calendly_start_time')
          .in('booking_stage', ['consultation_booked', 'inquiry'])
          .gte('created_at', weekAgo),
        supabase
          .from('client_invoices')
          .select('id, status')
          .in('status', ['pending', 'overdue']),
      ]);

      const submissions = submissionsRes.status === 'fulfilled' ? submissionsRes.value.data ?? [] : [];
      const consultations = consultationsRes.status === 'fulfilled' ? consultationsRes.value.data ?? [] : [];
      const invoices = invoicesRes.status === 'fulfilled' ? invoicesRes.value.data ?? [] : [];

      const todaySubmissions = submissions.filter((s) => s.created_at >= todayStart);
      const newLeads = submissions.filter((s) => s.status === 'new').length;

      const upcoming = consultations.filter((c) => {
        if (!c.calendly_start_time) return false;
        return new Date(c.calendly_start_time) > now;
      });

      setData({
        pendingConsultations: consultations.filter((c) => c.status === 'new' || c.status === 'in_review').length,
        upcomingConsultations: upcoming.length,
        recentSubmissions: submissions.slice(0, 5) as RecentSubmission[],
        totalSubmissionsToday: todaySubmissions.length,
        newLeads,
        pendingInvoices: invoices.length,
      });
      setLastRefreshed(new Date());
    } catch {
      // silently fail — widget is supplementary
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const quickLinks: QuickLink[] = [
    {
      label: 'Book Consultation',
      description: 'Open Calendly booking',
      href: process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com',
      external: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    },
    {
      label: 'Consultations',
      description: 'Manage all consultations',
      tab: 'consultation_admin',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    },
    {
      label: 'Form Submissions',
      description: 'Review contact inquiries',
      tab: 'inquiries',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>
      ),
      color: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
    },
    {
      label: 'Case Studies',
      description: 'Manage case study content',
      tab: 'case_studies_manager',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      ),
      color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    },
    {
      label: 'Invoices',
      description: 'Billing & payment status',
      tab: 'invoices',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
      color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    },
    {
      label: 'Analytics',
      description: 'Site & booking metrics',
      tab: 'analytics_dashboard',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
        </svg>
      ),
      color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
    },
  ];

  const handleQuickLink = (link: QuickLink) => {
    if (link.tab && onNavigate) {
      onNavigate(link.tab);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-muted-foreground font-medium">
            Live · Updated {timeAgo(lastRefreshed.toISOString())}
          </span>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
            <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Pending Consultations',
            value: data.pendingConsultations,
            sub: `${data.upcomingConsultations} upcoming`,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
            ),
            tab: 'consultation_admin',
          },
          {
            label: 'New Leads',
            value: data.newLeads,
            sub: 'awaiting response',
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            ),
            tab: 'inquiries',
          },
          {
            label: 'Submissions Today',
            value: data.totalSubmissionsToday,
            sub: 'contact forms',
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
              </svg>
            ),
            tab: 'inquiries',
          },
          {
            label: 'Pending Invoices',
            value: data.pendingInvoices,
            sub: 'unpaid / overdue',
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            ),
            tab: 'invoices',
          },
        ].map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => kpi.tab && onNavigate && onNavigate(kpi.tab)}
            className="bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/30 hover:shadow-sm transition-all group"
          >
            <div className={`w-8 h-8 rounded-xl ${kpi.bg} ${kpi.color} flex items-center justify-center mb-3`}>
              {kpi.icon}
            </div>
            {loading ? (
              <div className="h-7 w-10 bg-secondary animate-pulse rounded-lg mb-1" />
            ) : (
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            )}
            <p className="text-xs font-semibold text-foreground mt-0.5">{kpi.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
          </button>
        ))}
      </div>

      {/* Two-column: Recent Submissions + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Recent Form Submissions */}
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
              </svg>
              <h3 className="text-sm font-semibold text-foreground">Recent Form Submissions</h3>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('inquiries')}
              className="text-xs text-primary hover:underline font-medium"
            >
              View all →
            </button>
          </div>

          {loading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="w-28 h-3.5 bg-secondary animate-pulse rounded mb-1.5" />
                    <div className="w-20 h-3 bg-secondary/70 animate-pulse rounded" />
                  </div>
                  <div className="w-16 h-5 bg-secondary animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          ) : data.recentSubmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40 mb-3">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
              </svg>
              <p className="text-sm text-muted-foreground">No submissions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.recentSubmissions.map((sub) => {
                const initials = sub.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <button
                    key={sub.id}
                    onClick={() => onNavigate && onNavigate('inquiries')}
                    className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{sub.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{sub.service}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[sub.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {sub.status === 'in_review' ? 'In Review' : sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                      </span>
                      <span className="text-xs text-muted-foreground/60 hidden sm:block">{timeAgo(sub.created_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {quickLinks.map((link) => {
              if (link.external && link.href) {
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all ${link.color}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {link.icon}
                      <span className="text-xs font-semibold">{link.label}</span>
                    </div>
                    <p className="text-xs opacity-70">{link.description}</p>
                  </a>
                );
              }
              return (
                <button
                  key={link.label}
                  onClick={() => handleQuickLink(link)}
                  className={`flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all ${link.color}`}
                >
                  <div className="flex items-center gap-1.5">
                    {link.icon}
                    <span className="text-xs font-semibold">{link.label}</span>
                  </div>
                  <p className="text-xs opacity-70">{link.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
