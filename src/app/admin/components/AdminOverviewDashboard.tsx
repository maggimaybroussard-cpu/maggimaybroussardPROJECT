'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import OverdueInvoiceAlerts from './OverdueInvoiceAlerts';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIData {
  openCases: number;
  pendingInvoicesTotal: number;
  newLeadsThisWeek: number;
  unreadMessages: number;
  upcomingTasksCount: number;
  overdueTasksCount: number;
  totalSubmissions: number;
  newEntriesThisWeek: number;
  avgResponseTimeHours: number | null;
}

interface ServiceBreakdown {
  service: string;
  count: number;
}

interface ActivityItem {
  id: string;
  type: 'case_update' | 'invoice' | 'lead' | 'message' | 'task' | 'document';
  title: string;
  subtitle: string;
  timestamp: string;
  badge?: string;
  badgeColor?: string;
}

interface UpcomingTask {
  id: string;
  title: string;
  case_name: string | null;
  due_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
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
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due in ${diffDays}d`;
}

const PRIORITY_CONFIG = {
  low: { dot: 'bg-slate-400', text: 'text-slate-500' },
  medium: { dot: 'bg-blue-500', text: 'text-blue-600' },
  high: { dot: 'bg-amber-500', text: 'text-amber-600' },
  urgent: { dot: 'bg-red-500', text: 'text-red-600' },
};

const ACTIVITY_ICONS: Record<ActivityItem['type'], React.ReactNode> = {
  case_update: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
  invoice: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  lead: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  message: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  task: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  document: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
};

const ACTIVITY_COLORS: Record<ActivityItem['type'], string> = {
  case_update: 'bg-emerald-50 text-emerald-700',
  invoice: 'bg-amber-50 text-amber-700',
  lead: 'bg-blue-50 text-blue-700',
  message: 'bg-violet-50 text-violet-700',
  task: 'bg-orange-50 text-orange-700',
  document: 'bg-slate-100 text-slate-600',
};

const SERVICE_CHART_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#afd9ba', '#d1f0d9', '#c8a96e', '#e8c98e'];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
  icon: React.ReactNode;
  iconBg: string;
  loading: boolean;
  onClick?: () => void;
}

function KPICard({ label, value, sub, subColor, icon, iconBg, loading, onClick }: KPICardProps) {
  return (
    <button
      onClick={onClick}
      className={`group bg-card border border-border rounded-2xl p-5 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-sm w-full ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        {sub && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${subColor ?? 'bg-slate-100 text-slate-500'}`}>
            {sub}
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-16 bg-secondary animate-pulse rounded-lg mt-1" />
      ) : (
        <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      )}
      <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
    </button>
  );
}

// ─── Service Breakdown Chart ──────────────────────────────────────────────────

function ServiceBreakdownChart({ data, loading }: { data: ServiceBreakdown[]; loading: boolean }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <h2 className="text-sm font-semibold text-foreground">Service Request Breakdown</h2>
        </div>
        <span className="text-xs text-muted-foreground">{total} total</span>
      </div>
      {loading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-secondary animate-pulse" />
              <div className="flex-1 h-3 bg-secondary animate-pulse rounded" />
              <div className="w-8 h-3 bg-secondary animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center px-6">
          <p className="text-sm text-muted-foreground">No service data yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5 items-center">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="service"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={SERVICE_CHART_COLORS[i % SERVICE_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [value, 'Requests']}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2">
            {data.slice(0, 6).map((item, i) => {
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <div key={item.service} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SERVICE_CHART_COLORS[i % SERVICE_CHART_COLORS.length] }} />
                  <span className="text-xs text-foreground truncate flex-1">{item.service || 'Other'}</span>
                  <span className="text-xs font-semibold text-foreground">{item.count}</span>
                  <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface AdminOverviewDashboardProps {
  onNavigate?: (tab: string) => void;
}

export default function AdminOverviewDashboard({ onNavigate }: AdminOverviewDashboardProps) {
  const supabase = createClient();
  const [kpis, setKpis] = useState<KPIData>({
    openCases: 0,
    pendingInvoicesTotal: 0,
    newLeadsThisWeek: 0,
    unreadMessages: 0,
    upcomingTasksCount: 0,
    overdueTasksCount: 0,
    totalSubmissions: 0,
    newEntriesThisWeek: 0,
    avgResponseTimeHours: null,
  });
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceBreakdown[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const todayStr = now.toISOString().split('T')[0];
      const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        casesRes,
        invoicesRes,
        leadsRes,
        messagesRes,
        tasksRes,
        overdueTasksRes,
        totalSubmissionsRes,
        newEntriesRes,
        recentInquiriesForAvgRes,
        serviceBreakdownRes,
        activityCasesRes,
        activityInvoicesRes,
        activityLeadsRes,
        activityMessagesRes,
        activityDocsRes,
        upcomingTasksRes,
      ] = await Promise.all([
        // Open cases
        supabase
          .from('contact_inquiries')
          .select('id', { count: 'exact', head: true })
          .in('booking_stage', ['active_client', 'consultation_booked', 'proposal_sent']),

        // Pending invoices total
        supabase
          .from('client_invoices')
          .select('amount_cents')
          .in('status', ['draft', 'sent', 'overdue']),

        // New leads this week
        supabase
          .from('contact_inquiries')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', weekAgo),

        // Unread messages
        supabase
          .from('portal_messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_role', 'client')
          .eq('read_by_admin', false),

        // Upcoming tasks
        supabase
          .from('admin_tasks')
          .select('id', { count: 'exact', head: true })
          .not('status', 'eq', 'done')
          .gte('due_date', todayStr)
          .lte('due_date', sevenDaysOut),

        // Overdue tasks
        supabase
          .from('admin_tasks')
          .select('id', { count: 'exact', head: true })
          .not('status', 'eq', 'done')
          .lt('due_date', todayStr),

        // Total submissions (all time)
        supabase
          .from('contact_inquiries')
          .select('id', { count: 'exact', head: true }),

        // New entries this week (contact_inquiries + intake_submissions combined)
        supabase
          .from('contact_inquiries')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', weekAgo),

        // Recent inquiries for avg response time calculation
        supabase
          .from('contact_inquiries')
          .select('created_at, updated_at, status')
          .not('status', 'eq', 'new')
          .order('updated_at', { ascending: false })
          .limit(50),

        // Service breakdown
        supabase
          .from('contact_inquiries')
          .select('service'),

        // Activity: recent case updates
        supabase
          .from('contact_inquiries')
          .select('id, name, firm, booking_stage, updated_at')
          .order('updated_at', { ascending: false })
          .limit(5),

        // Activity: recent invoices
        supabase
          .from('client_invoices')
          .select('id, invoice_number, amount_cents, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),

        // Activity: recent leads
        supabase
          .from('contact_inquiries')
          .select('id, name, firm, service, created_at')
          .order('created_at', { ascending: false })
          .limit(5),

        // Activity: recent messages
        supabase
          .from('portal_messages')
          .select('id, content, sender_role, created_at, read_by_admin')
          .eq('sender_role', 'client')
          .order('created_at', { ascending: false })
          .limit(5),

        // Activity: recent document uploads
        supabase
          .from('case_documents')
          .select('id, file_name, uploaded_by, created_at')
          .order('created_at', { ascending: false })
          .limit(5),

        // Upcoming tasks list
        supabase
          .from('admin_tasks')
          .select('id, title, case_name, due_date, priority, status')
          .not('status', 'eq', 'done')
          .lte('due_date', sevenDaysOut)
          .order('due_date', { ascending: true })
          .limit(6),
      ]);

      // KPIs
      const pendingTotal = (invoicesRes.data ?? []).reduce((sum, inv) => sum + (inv.amount_cents ?? 0), 0);

      // Average response time: diff between created_at and updated_at for responded inquiries
      let avgResponseTimeHours: number | null = null;
      const respondedInquiries = recentInquiriesForAvgRes.data ?? [];
      if (respondedInquiries.length > 0) {
        const diffs = respondedInquiries.map((inq) => {
          const created = new Date(inq.created_at).getTime();
          const updated = new Date(inq.updated_at).getTime();
          return (updated - created) / (1000 * 60 * 60); // hours
        }).filter((h) => h > 0 && h < 720); // filter out outliers > 30 days
        if (diffs.length > 0) {
          avgResponseTimeHours = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        }
      }

      // Service breakdown
      const serviceMap: Record<string, number> = {};
      (serviceBreakdownRes.data ?? []).forEach((row) => {
        const svc = row.service?.trim() || 'Other';
        serviceMap[svc] = (serviceMap[svc] || 0) + 1;
      });
      const breakdownArr: ServiceBreakdown[] = Object.entries(serviceMap)
        .map(([service, count]) => ({ service, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      setServiceBreakdown(breakdownArr);

      setKpis({
        openCases: casesRes.count ?? 0,
        pendingInvoicesTotal: pendingTotal,
        newLeadsThisWeek: leadsRes.count ?? 0,
        unreadMessages: messagesRes.count ?? 0,
        upcomingTasksCount: tasksRes.count ?? 0,
        overdueTasksCount: overdueTasksRes.count ?? 0,
        totalSubmissions: totalSubmissionsRes.count ?? 0,
        newEntriesThisWeek: newEntriesRes.count ?? 0,
        avgResponseTimeHours,
      });

      // Build activity feed
      const items: ActivityItem[] = [];

      (activityCasesRes.data ?? []).forEach((c) => {
        items.push({
          id: `case-${c.id}`,
          type: 'case_update',
          title: c.name ?? 'Unknown Client',
          subtitle: `Stage: ${c.booking_stage?.replace(/_/g, ' ') ?? 'unknown'}`,
          timestamp: c.updated_at,
          badge: c.booking_stage === 'active_client' ? 'Active' : c.booking_stage === 'proposal_sent' ? 'Proposal' : 'Booked',
          badgeColor: c.booking_stage === 'active_client' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
        });
      });

      (activityInvoicesRes.data ?? []).forEach((inv) => {
        items.push({
          id: `inv-${inv.id}`,
          type: 'invoice',
          title: `Invoice ${inv.invoice_number ?? '#'}`,
          subtitle: `${formatCurrency(inv.amount_cents ?? 0)} · ${inv.status}`,
          timestamp: inv.created_at,
          badge: inv.status,
          badgeColor: inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : inv.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
        });
      });

      (activityLeadsRes.data ?? []).forEach((lead) => {
        items.push({
          id: `lead-${lead.id}`,
          type: 'lead',
          title: lead.name ?? 'New Lead',
          subtitle: `${lead.firm ?? ''} · ${lead.service ?? ''}`.replace(/^·\s*/, '').replace(/\s*·$/, ''),
          timestamp: lead.created_at,
          badge: 'New Lead',
          badgeColor: 'bg-blue-100 text-blue-700',
        });
      });

      (activityMessagesRes.data ?? []).forEach((msg) => {
        items.push({
          id: `msg-${msg.id}`,
          type: 'message',
          title: 'Client Message',
          subtitle: (msg.content ?? '').slice(0, 60) + ((msg.content?.length ?? 0) > 60 ? '…' : ''),
          timestamp: msg.created_at,
          badge: msg.read_by_admin ? undefined : 'Unread',
          badgeColor: 'bg-violet-100 text-violet-700',
        });
      });

      (activityDocsRes.data ?? []).forEach((doc) => {
        items.push({
          id: `doc-${doc.id}`,
          type: 'document',
          title: doc.file_name ?? 'Document',
          subtitle: `Uploaded by ${doc.uploaded_by ?? 'client'}`,
          timestamp: doc.created_at,
        });
      });

      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivity(items.slice(0, 15));

      setUpcomingTasks(
        (upcomingTasksRes.data ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          case_name: t.case_name,
          due_date: t.due_date,
          priority: t.priority as UpcomingTask['priority'],
          status: t.status,
        }))
      );

      setLastRefreshed(new Date());
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Format avg response time
  const formatAvgResponse = (hours: number | null): string => {
    if (hours === null) return '—';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const kpiCards = [
    {
      label: 'Total Submissions',
      value: kpis.totalSubmissions,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-700">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>
      ),
      iconBg: 'bg-indigo-50',
      tab: 'submissions_inbox',
    },
    {
      label: 'New Entries This Week',
      value: kpis.newEntriesThisWeek,
      sub: kpis.newEntriesThisWeek > 0 ? `+${kpis.newEntriesThisWeek}` : undefined,
      subColor: 'bg-blue-100 text-blue-700',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      iconBg: 'bg-blue-50',
      tab: 'inquiries',
    },
    {
      label: 'Avg. Response Time',
      value: formatAvgResponse(kpis.avgResponseTimeHours),
      sub: kpis.avgResponseTimeHours !== null && kpis.avgResponseTimeHours < 4 ? 'Fast' : kpis.avgResponseTimeHours !== null ? 'Moderate' : undefined,
      subColor: kpis.avgResponseTimeHours !== null && kpis.avgResponseTimeHours < 4 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-teal-700">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      iconBg: 'bg-teal-50',
      tab: undefined,
    },
    {
      label: 'Open Cases',
      value: kpis.openCases,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-700">
          <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      ),
      iconBg: 'bg-emerald-50',
      tab: 'cases',
    },
    {
      label: 'Pending Invoices',
      value: formatCurrency(kpis.pendingInvoicesTotal),
      sub: kpis.pendingInvoicesTotal > 0 ? 'Unpaid' : undefined,
      subColor: 'bg-amber-100 text-amber-700',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-700">
          <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
      ),
      iconBg: 'bg-amber-50',
      tab: 'invoice_generator',
    },
    {
      label: 'New Leads This Week',
      value: kpis.newLeadsThisWeek,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-700">
          <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 5 5 12"/>
        </svg>
      ),
      iconBg: 'bg-sky-50',
      tab: 'inquiries',
    },
    {
      label: 'Unread Messages',
      value: kpis.unreadMessages,
      sub: kpis.unreadMessages > 0 ? `${kpis.unreadMessages} new` : undefined,
      subColor: 'bg-violet-100 text-violet-700',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-700">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      iconBg: 'bg-violet-50',
      tab: 'messages',
    },
    {
      label: 'Tasks Due This Week',
      value: kpis.upcomingTasksCount,
      sub: kpis.overdueTasksCount > 0 ? `${kpis.overdueTasksCount} overdue` : undefined,
      subColor: 'bg-red-100 text-red-700',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-700">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
      iconBg: 'bg-orange-50',
      tab: 'tasks',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Last updated{' '}
            <span className="font-medium text-foreground">
              {lastRefreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all disabled:opacity-50"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* KPI Grid — 4 cols on large, 2 on small */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <KPICard
            key={card.label}
            label={card.label}
            value={card.value}
            sub={card.sub}
            subColor={card.subColor}
            icon={card.icon}
            iconBg={card.iconBg}
            loading={loading}
            onClick={card.tab && onNavigate ? () => onNavigate(card.tab!) : undefined}
          />
        ))}
      </div>

      {/* Critical Alerts: Overdue Invoices */}
      <OverdueInvoiceAlerts onNavigate={onNavigate} />

      {/* Service Breakdown + Upcoming Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ServiceBreakdownChart data={serviceBreakdown} loading={loading} />

        {/* Upcoming Task Deadlines */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <h2 className="text-sm font-semibold text-foreground">Upcoming Deadlines</h2>
            </div>
            {onNavigate && (
              <button onClick={() => onNavigate('tasks')} className="text-xs text-primary hover:underline font-medium">
                View all
              </button>
            )}
          </div>

          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5 space-y-1.5">
                  <div className="h-3.5 w-40 bg-secondary animate-pulse rounded" />
                  <div className="h-3 w-24 bg-secondary animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : upcomingTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground mb-1">All clear!</p>
              <p className="text-xs text-muted-foreground">No tasks due in the next 7 days.</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[340px] overflow-y-auto">
              {upcomingTasks.map((task) => {
                const dueLabel = formatDueDate(task.due_date);
                const isOverdue = new Date(task.due_date) < new Date();
                const pc = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
                return (
                  <div key={task.id} className="px-5 py-3.5 hover:bg-secondary/20 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        {task.case_name && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{task.case_name}</p>
                        )}
                        <p className={`text-xs font-semibold mt-1 ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {dueLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Lexi & Auto-Invoice Quick Access ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lexi AI Tools */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Lexi AI Assistant</h2>
              <p className="text-xs text-muted-foreground">Your AI-powered legal practice tools</p>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 gap-2">
            {[
              { label: 'Lexi Task Assistant', desc: 'Chat with Lexi to manage tasks', tab: 'lexi_assistant', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { label: 'Lexi Admin Tools', desc: 'Conflict checker & invoice drafts', tab: 'lexi_admin_tools', color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: 'Document Drafts', desc: 'AI-generated document drafts', tab: 'lexi_document_drafts', color: 'bg-violet-50 text-violet-700 border-violet-200' },
              { label: 'Document Extractor', desc: 'Extract data from legal documents', tab: 'doc_extractor', color: 'bg-amber-50 text-amber-700 border-amber-200' },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => onNavigate(item.tab)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border hover:shadow-sm transition-all text-left group"
                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
              >
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.color}`}>AI</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Auto-Invoice Tools */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-50">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C8965A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Auto-Invoice Generation</h2>
              <p className="text-xs text-muted-foreground">Generate, schedule, and track invoices</p>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 gap-2">
            {[
              { label: 'Invoice Generator', desc: 'Create invoices from time logs & retainers', tab: 'invoice_generator', color: 'bg-amber-50 text-amber-700 border-amber-200' },
              { label: 'Invoice Scheduler', desc: 'Auto-generate invoices on a schedule', tab: 'retainer_invoice_scheduler', color: 'bg-orange-50 text-orange-700 border-orange-200' },
              { label: 'Matter Invoice Builder', desc: 'Build invoices from matter time entries', tab: 'matter_invoice_builder', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
              { label: 'Invoice Tracking', desc: 'Track sent, paid, and overdue invoices', tab: 'invoice_tracking', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => onNavigate(item.tab)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border hover:shadow-sm transition-all text-left group"
                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
              >
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.color}`}>
                  {item.tab === 'invoice_generator' ? 'NEW' : item.tab === 'retainer_invoice_scheduler' ? 'AUTO' : item.tab === 'matter_invoice_builder' ? 'BILL' : 'TRACK'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h2 className="text-sm font-semibold text-foreground">Recent Client Activity</h2>
          </div>
          <span className="text-xs text-muted-foreground">{activity.length} events</span>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                <div className="w-8 h-8 rounded-xl bg-secondary animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 bg-secondary animate-pulse rounded" />
                  <div className="h-3 w-48 bg-secondary animate-pulse rounded" />
                </div>
                <div className="h-3 w-10 bg-secondary animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No recent activity</p>
            <p className="text-xs text-muted-foreground">Client events will appear here as they happen.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {activity.slice(0, Math.ceil(activity.length / 2)).map((item) => (
                <div key={item.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-secondary/20 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[item.type]}`}>
                    {ACTIVITY_ICONS[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">{timeAgo(item.timestamp)}</span>
                    {item.badge && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {activity.slice(Math.ceil(activity.length / 2)).map((item) => (
                <div key={item.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-secondary/20 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[item.type]}`}>
                    {ACTIVITY_ICONS[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">{timeAgo(item.timestamp)}</span>
                    {item.badge && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
