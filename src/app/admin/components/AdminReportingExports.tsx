'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportRow {
  [key: string]: string | number | null;
}

interface ExportConfig {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  columns: string[];
  query: () => Promise<ReportRow[]>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function exportToCSV(rows: ReportRow[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminReportingExports() {
  const supabase = createClient();

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ReportRow[] | null>(null);
  const [previewLabel, setPreviewLabel] = useState('');
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const EXPORT_CONFIGS: ExportConfig[] = [
    {
      id: 'cases_summary',
      label: 'Cases Summary',
      description: 'All cases with status, service type, booking stage, and creation date',
      category: 'Cases',
      columns: ['name', 'email', 'firm', 'service', 'status', 'booking_stage', 'created_at'],
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      ),
      query: async () => {
        const { data } = await supabase
          .from('contact_inquiries')
          .select('name, email, firm, service, status, booking_stage, created_at')
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo + 'T23:59:59')
          .order('created_at', { ascending: false });
        return (data || []).map((r) => ({
          name: r.name,
          email: r.email,
          firm: r.firm || '',
          service: r.service,
          status: r.status,
          booking_stage: r.booking_stage || '',
          created_at: r.created_at?.split('T')[0] || '',
        }));
      },
    },
    {
      id: 'revenue_by_matter',
      label: 'Revenue by Matter',
      description: 'Invoice totals, collected amounts, and outstanding balances per case',
      category: 'Billing',
      columns: ['case_name', 'service', 'total_invoiced', 'total_paid', 'outstanding', 'invoice_count'],
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
      query: async () => {
        const { data } = await supabase
          .from('client_invoices')
          .select('inquiry_id, amount, payment_status, contact_inquiries(name, service)')
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo + 'T23:59:59');
        const grouped: Record<string, { case_name: string; service: string; total_invoiced: number; total_paid: number; invoice_count: number }> = {};
        for (const inv of data || []) {
          const ci = inv.contact_inquiries as { name: string; service: string } | null;
          const key = inv.inquiry_id || 'unknown';
          if (!grouped[key]) {
            grouped[key] = { case_name: ci?.name || 'Unknown', service: ci?.service || '', total_invoiced: 0, total_paid: 0, invoice_count: 0 };
          }
          grouped[key].total_invoiced += inv.amount || 0;
          grouped[key].invoice_count += 1;
          if (inv.payment_status === 'paid') grouped[key].total_paid += inv.amount || 0;
        }
        return Object.values(grouped).map((r) => ({
          case_name: r.case_name,
          service: r.service,
          total_invoiced: formatCurrency(r.total_invoiced),
          total_paid: formatCurrency(r.total_paid),
          outstanding: formatCurrency(r.total_invoiced - r.total_paid),
          invoice_count: r.invoice_count,
        }));
      },
    },
    {
      id: 'invoices_all',
      label: 'All Invoices',
      description: 'Complete invoice list with amounts, due dates, payment status, and client info',
      category: 'Billing',
      columns: ['invoice_number', 'client_name', 'client_email', 'amount', 'due_date', 'payment_status', 'created_at'],
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
      query: async () => {
        const { data } = await supabase
          .from('client_invoices')
          .select('invoice_number, customer_name, customer_email, amount, due_date, payment_status, created_at')
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo + 'T23:59:59')
          .order('created_at', { ascending: false });
        return (data || []).map((r) => ({
          invoice_number: r.invoice_number || '',
          client_name: r.customer_name || '',
          client_email: r.customer_email || '',
          amount: formatCurrency(r.amount || 0),
          due_date: r.due_date || '',
          payment_status: r.payment_status || '',
          created_at: r.created_at?.split('T')[0] || '',
        }));
      },
    },
    {
      id: 'overdue_invoices',
      label: 'Overdue Invoices',
      description: 'All unpaid invoices past their due date with days overdue',
      category: 'Billing',
      columns: ['invoice_number', 'client_name', 'client_email', 'amount', 'due_date', 'days_overdue'],
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      query: async () => {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
          .from('client_invoices')
          .select('invoice_number, customer_name, customer_email, amount, due_date')
          .in('payment_status', ['pending', 'unpaid', 'overdue'])
          .lt('due_date', today)
          .order('due_date', { ascending: true });
        return (data || []).map((r) => {
          const due = new Date(r.due_date || today);
          const now = new Date();
          const days = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          return {
            invoice_number: r.invoice_number || '',
            client_name: r.customer_name || '',
            client_email: r.customer_email || '',
            amount: formatCurrency(r.amount || 0),
            due_date: r.due_date || '',
            days_overdue: days,
          };
        });
      },
    },
    {
      id: 'billable_hours',
      label: 'Billable Hours Log',
      description: 'All logged billable hours by attorney, case, and task type with amounts',
      category: 'Time & Billing',
      columns: ['case_name', 'attorney', 'task_description', 'hours', 'hourly_rate', 'amount', 'logged_date'],
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      query: async () => {
        const { data } = await supabase
          .from('retainer_time_logs')
          .select('hours_logged, hourly_rate, work_description, logged_date, logged_by, contact_inquiries(name)')
          .gte('logged_date', dateFrom)
          .lte('logged_date', dateTo)
          .order('logged_date', { ascending: false });
        return (data || []).map((r) => {
          const ci = r.contact_inquiries as { name: string } | null;
          const hours = r.hours_logged || 0;
          const rate = r.hourly_rate || 0;
          return {
            case_name: ci?.name || 'Unknown',
            attorney: r.logged_by || '',
            task_description: r.work_description || '',
            hours: hours,
            hourly_rate: formatCurrency(rate),
            amount: formatCurrency(hours * rate),
            logged_date: r.logged_date || '',
          };
        });
      },
    },
    {
      id: 'court_deadlines',
      label: 'Court Deadlines',
      description: 'All upcoming and past court deadlines, SOL dates, and hearing dates',
      category: 'Cases',
      columns: ['case_name', 'deadline_title', 'deadline_type', 'deadline_date', 'status', 'days_until'],
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
      query: async () => {
        const { data } = await supabase
          .from('court_deadlines')
          .select('title, deadline_type, deadline_date, status, contact_inquiries(name)')
          .gte('deadline_date', dateFrom)
          .lte('deadline_date', dateTo)
          .order('deadline_date', { ascending: true });
        const today = new Date();
        return (data || []).map((r) => {
          const ci = r.contact_inquiries as { name: string } | null;
          const dl = new Date(r.deadline_date || today);
          const days = Math.floor((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return {
            case_name: ci?.name || 'Unknown',
            deadline_title: r.title || '',
            deadline_type: r.deadline_type || '',
            deadline_date: r.deadline_date || '',
            status: r.status || '',
            days_until: days >= 0 ? `${days} days` : `${Math.abs(days)} days ago`,
          };
        });
      },
    },
    {
      id: 'tasks_report',
      label: 'Tasks Report',
      description: 'All admin tasks with status, priority, assignee, and due dates',
      category: 'Operations',
      columns: ['title', 'case_name', 'assigned_to', 'priority', 'status', 'due_date', 'created_at'],
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
      query: async () => {
        const { data } = await supabase
          .from('admin_tasks')
          .select('title, assigned_to, priority, status, due_date, created_at, contact_inquiries(name)')
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo + 'T23:59:59')
          .order('due_date', { ascending: true });
        return (data || []).map((r) => {
          const ci = r.contact_inquiries as { name: string } | null;
          return {
            title: r.title || '',
            case_name: ci?.name || '',
            assigned_to: r.assigned_to || '',
            priority: r.priority || '',
            status: r.status || '',
            due_date: r.due_date || '',
            created_at: r.created_at?.split('T')[0] || '',
          };
        });
      },
    },
    {
      id: 'client_list',
      label: 'Client List',
      description: 'All clients with contact info, service type, and current status',
      category: 'Clients',
      columns: ['name', 'email', 'firm', 'service', 'status', 'booking_stage', 'created_at'],
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      query: async () => {
        const { data } = await supabase
          .from('contact_inquiries')
          .select('name, email, firm, service, status, booking_stage, created_at')
          .eq('booking_stage', 'active_client')
          .order('created_at', { ascending: false });
        return (data || []).map((r) => ({
          name: r.name,
          email: r.email,
          firm: r.firm || '',
          service: r.service,
          status: r.status,
          booking_stage: r.booking_stage || '',
          created_at: r.created_at?.split('T')[0] || '',
        }));
      },
    },
    {
      id: 'payments_report',
      label: 'Payments Report',
      description: 'All Stripe payments with amounts, status, and customer details',
      category: 'Billing',
      columns: ['customer_name', 'customer_email', 'amount', 'currency', 'payment_status', 'payment_type', 'created_at'],
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
      ),
      query: async () => {
        const { data } = await supabase
          .from('payments')
          .select('customer_name, customer_email, amount, currency, payment_status, payment_type, created_at')
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo + 'T23:59:59')
          .order('created_at', { ascending: false });
        return (data || []).map((r) => ({
          customer_name: r.customer_name || '',
          customer_email: r.customer_email || '',
          amount: formatCurrency((r.amount || 0) / 100),
          currency: (r.currency || 'usd').toUpperCase(),
          payment_status: r.payment_status || '',
          payment_type: r.payment_type || '',
          created_at: r.created_at?.split('T')[0] || '',
        }));
      },
    },
    {
      id: 'nps_responses',
      label: 'NPS Survey Responses',
      description: 'Client satisfaction scores, feedback, and referral intent from post-matter surveys',
      category: 'Analytics',
      columns: ['client_name', 'client_email', 'score', 'feedback', 'would_refer', 'submitted_at'],
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
      query: async () => {
        const { data } = await supabase
          .from('nps_responses')
          .select('score, feedback, would_refer, submitted_at, nps_survey_requests(contact_inquiries(name, email))')
          .gte('submitted_at', dateFrom)
          .lte('submitted_at', dateTo + 'T23:59:59')
          .order('submitted_at', { ascending: false });
        return (data || []).map((r) => {
          const req = r.nps_survey_requests as { contact_inquiries: { name: string; email: string } | null } | null;
          const ci = req?.contact_inquiries;
          return {
            client_name: ci?.name || 'Anonymous',
            client_email: ci?.email || '',
            score: r.score ?? '',
            feedback: r.feedback || '',
            would_refer: r.would_refer ? 'Yes' : 'No',
            submitted_at: r.submitted_at?.split('T')[0] || '',
          };
        });
      },
    },
    {
      id: 'intake_templates_applied',
      label: 'Intake Templates Applied',
      description: 'Log of all intake templates applied to cases with tasks and deadlines created',
      category: 'Operations',
      columns: ['template_name', 'case_name', 'tasks_created', 'deadlines_created', 'applied_at'],
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
      query: async () => {
        const { data } = await supabase
          .from('intake_template_applications')
          .select('tasks_created, deadlines_created, applied_at, intake_templates(name), contact_inquiries(name)')
          .gte('applied_at', dateFrom)
          .lte('applied_at', dateTo + 'T23:59:59')
          .order('applied_at', { ascending: false });
        return (data || []).map((r) => {
          const tmpl = r.intake_templates as { name: string } | null;
          const ci = r.contact_inquiries as { name: string } | null;
          return {
            template_name: tmpl?.name || '',
            case_name: ci?.name || '',
            tasks_created: r.tasks_created || 0,
            deadlines_created: r.deadlines_created || 0,
            applied_at: r.applied_at?.split('T')[0] || '',
          };
        });
      },
    },
    {
      id: 'audit_log',
      label: 'Audit Log Export',
      description: 'Admin action log — document uploads, invoice sends, case updates, and logins',
      category: 'Compliance',
      columns: ['action', 'entity_type', 'entity_id', 'performed_by', 'ip_address', 'created_at'],
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
        </svg>
      ),
      query: async () => {
        const { data } = await supabase
          .from('audit_logs')
          .select('action, entity_type, entity_id, performed_by, ip_address, created_at')
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo + 'T23:59:59')
          .order('created_at', { ascending: false })
          .limit(500);
        return (data || []).map((r) => ({
          action: r.action || '',
          entity_type: r.entity_type || '',
          entity_id: r.entity_id || '',
          performed_by: r.performed_by || '',
          ip_address: r.ip_address || '',
          created_at: r.created_at?.split('T')[0] || '',
        }));
      },
    },
  ];

  const categories = ['all', ...Array.from(new Set(EXPORT_CONFIGS.map((c) => c.category)))];
  const filtered = activeCategory === 'all' ? EXPORT_CONFIGS : EXPORT_CONFIGS.filter((c) => c.category === activeCategory);

  const handleExport = async (config: ExportConfig) => {
    setLoadingId(config.id);
    try {
      const rows = await config.query();
      if (rows.length === 0) {
        alert(`No data found for "${config.label}" in the selected date range.`);
      } else {
        exportToCSV(rows, config.id);
      }
    } catch {
      alert('Export failed. Please try again.');
    }
    setLoadingId(null);
  };

  const handlePreview = async (config: ExportConfig) => {
    setPreviewLoading(true);
    setPreviewLabel(config.label);
    setPreviewColumns(config.columns);
    setPreviewData(null);
    try {
      const rows = await config.query();
      setPreviewData(rows.slice(0, 10));
    } catch {
      setPreviewData([]);
    }
    setPreviewLoading(false);
  };

  const CATEGORY_COLORS: Record<string, string> = {
    'Cases': 'bg-blue-100 text-blue-700',
    'Billing': 'bg-emerald-100 text-emerald-700',
    'Time & Billing': 'bg-amber-100 text-amber-700',
    'Operations': 'bg-purple-100 text-purple-700',
    'Clients': 'bg-indigo-100 text-indigo-700',
    'Analytics': 'bg-pink-100 text-pink-700',
    'Compliance': 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Date Range Filter</h3>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Last 30d', days: 30 },
              { label: 'Last 90d', days: 90 },
              { label: 'YTD', days: -1 },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  const to = new Date();
                  const from = new Date();
                  if (preset.days === -1) {
                    from.setMonth(0); from.setDate(1);
                  } else {
                    from.setDate(from.getDate() - preset.days);
                  }
                  setDateFrom(from.toISOString().split('T')[0]);
                  setDateTo(to.toISOString().split('T')[0]);
                }}
                className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeCategory === cat
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {cat === 'all' ? 'All Reports' : cat}
          </button>
        ))}
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((config) => (
          <div key={config.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:shadow-sm transition-all">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-secondary/60 flex items-center justify-center flex-shrink-0 text-muted-foreground">
                {config.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <h3 className="text-sm font-semibold text-foreground">{config.label}</h3>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${CATEGORY_COLORS[config.category] || 'bg-gray-100 text-gray-700'}`}>
                    {config.category}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
            </div>

            {/* Columns preview */}
            <div className="flex flex-wrap gap-1">
              {config.columns.slice(0, 4).map((col) => (
                <span key={col} className="px-1.5 py-0.5 rounded bg-secondary/40 text-xs text-muted-foreground font-mono">
                  {col}
                </span>
              ))}
              {config.columns.length > 4 && (
                <span className="px-1.5 py-0.5 rounded bg-secondary/40 text-xs text-muted-foreground">
                  +{config.columns.length - 4} more
                </span>
              )}
            </div>

            <div className="flex gap-2 mt-auto pt-2 border-t border-border/50">
              <button
                onClick={() => handlePreview(config)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
              >
                Preview
              </button>
              <button
                onClick={() => handleExport(config)}
                disabled={loadingId === config.id}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-1.5"
                style={{ background: '#355E3B', color: '#fff' }}
              >
                {loadingId === config.id ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Exporting…
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Export CSV
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Panel */}
      {(previewData !== null || previewLoading) && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg text-foreground">{previewLabel} — Preview</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Showing first 10 rows</p>
            </div>
            <button
              onClick={() => setPreviewData(null)}
              className="text-muted-foreground/50 hover:text-foreground transition-colors p-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          {previewLoading ? (
            <div className="flex items-center justify-center py-10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-primary mr-2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span className="text-sm text-muted-foreground">Loading preview…</span>
            </div>
          ) : previewData && previewData.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No data found for the selected date range.</div>
          ) : previewData && previewData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    {previewColumns.map((col) => (
                      <th key={col} className="text-left px-4 py-2.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold whitespace-nowrap">
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}>
                      {previewColumns.map((col) => (
                        <td key={col} className="px-4 py-2.5 text-foreground/80 whitespace-nowrap max-w-[200px] truncate">
                          {String(row[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
