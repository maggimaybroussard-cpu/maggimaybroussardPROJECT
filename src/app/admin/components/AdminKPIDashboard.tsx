'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPIMetrics {
  revenueMTD: number;
  revenueLastMonth: number;
  revenueYTD: number;
  revenueGrowthPct: number;
  activeCases: number;
  newCasesThisMonth: number;
  closedThisMonth: number;
  avgCaseValue: number;
  overdueCount: number;
  overdueAmount: number;
  collectionRate: number;
  pendingAmount: number;
  newLeadsThisWeek: number;
  newLeadsThisMonth: number;
  conversionRate: number;
  avgDaysToConvert: number;
  unreadMessages: number;
  upcomingDeadlines: number;
  overdueDeadlines: number;
  activeRetainers: number;
  caseCompletionRate: number;
  quarterlyRevenue: number;
  quarterlyForecast: number;
  monthlyForecast: number;
  utilizationRate: number;
  totalBillableHours: number;
  avgCaseValueByService: ServiceValueItem[];
}

interface RevenuePoint {
  month: string;
  billed: number;
  collected: number;
  forecast?: number;
}

interface StageBreakdown {
  stage: string;
  label: string;
  count: number;
  color: string;
}

interface ServiceValueItem {
  service: string;
  avgValue: number;
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtK(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
}

function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

function growthLabel(pct: number) {
  if (pct > 0) return `+${Math.round(pct)}% vs last month`;
  if (pct < 0) return `${Math.round(pct)}% vs last month`;
  return 'No change vs last month';
}

const STAGE_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  consultation_booked: 'Consultation',
  proposal_sent: 'Proposal',
  active_client: 'Active',
  retainer_signed: 'Retainer',
  closed: 'Closed',
};

const STAGE_COLORS: Record<string, string> = {
  inquiry: '#94a3b8',
  consultation_booked: '#3b82f6',
  proposal_sent: '#f59e0b',
  active_client: '#10b981',
  retainer_signed: '#8b5cf6',
  closed: '#6b7280',
};

const SERVICE_COLORS = ['#355E3B', '#4a7c59', '#6b9e7a', '#8dbf9a', '#f59e0b', '#3b82f6', '#8b5cf6'];

// ─── Export Helpers ───────────────────────────────────────────────────────────

function buildCSV(metrics: KPIMetrics, revenueChart: RevenuePoint[], stageBreakdown: StageBreakdown[]): string {
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const rows: string[][] = [];

  rows.push([`Broussard Legal Services — KPI Report — ${monthLabel}`]);
  rows.push([]);
  rows.push(['REVENUE SUMMARY']);
  rows.push(['Metric', 'Value']);
  rows.push(['Revenue MTD', `$${metrics.revenueMTD.toFixed(2)}`]);
  rows.push(['Revenue Last Month', `$${metrics.revenueLastMonth.toFixed(2)}`]);
  rows.push(['Revenue YTD', `$${metrics.revenueYTD.toFixed(2)}`]);
  rows.push(['Revenue Growth %', `${metrics.revenueGrowthPct.toFixed(1)}%`]);
  rows.push(['Monthly Forecast', `$${metrics.monthlyForecast.toFixed(2)}`]);
  rows.push(['Quarterly Revenue', `$${metrics.quarterlyRevenue.toFixed(2)}`]);
  rows.push(['Quarterly Forecast', `$${metrics.quarterlyForecast.toFixed(2)}`]);
  rows.push([]);
  rows.push(['PRACTICE ANALYTICS']);
  rows.push(['Metric', 'Value']);
  rows.push(['Active Cases', String(metrics.activeCases)]);
  rows.push(['New Cases MTD', String(metrics.newCasesThisMonth)]);
  rows.push(['Closed MTD', String(metrics.closedThisMonth)]);
  rows.push(['Avg Case Value', `$${metrics.avgCaseValue.toFixed(2)}`]);
  rows.push(['Case Completion Rate', `${metrics.caseCompletionRate.toFixed(1)}%`]);
  rows.push(['Collection Rate', `${metrics.collectionRate.toFixed(1)}%`]);
  rows.push(['Overdue Invoices', String(metrics.overdueCount)]);
  rows.push(['Overdue Amount', `$${metrics.overdueAmount.toFixed(2)}`]);
  rows.push(['Pending Amount', `$${metrics.pendingAmount.toFixed(2)}`]);
  rows.push([]);
  rows.push(['LEAD & CONVERSION']);
  rows.push(['Metric', 'Value']);
  rows.push(['New Leads This Week', String(metrics.newLeadsThisWeek)]);
  rows.push(['New Leads MTD', String(metrics.newLeadsThisMonth)]);
  rows.push(['Conversion Rate', `${metrics.conversionRate.toFixed(1)}%`]);
  rows.push(['Avg Days to Convert', `${metrics.avgDaysToConvert.toFixed(0)} days`]);
  rows.push([]);
  rows.push(['ATTORNEY UTILIZATION']);
  rows.push(['Metric', 'Value']);
  rows.push(['Utilization Rate', `${metrics.utilizationRate.toFixed(1)}%`]);
  rows.push(['Billable Hours MTD', `${metrics.totalBillableHours.toFixed(1)} hrs`]);
  rows.push(['Active Retainers', String(metrics.activeRetainers)]);
  rows.push([]);
  rows.push(['MONTHLY REVENUE TREND']);
  rows.push(['Month', 'Billed', 'Collected', 'Forecast']);
  revenueChart.forEach((r) => rows.push([r.month, `$${r.billed}`, `$${r.collected}`, r.forecast ? `$${r.forecast}` : '']));
  rows.push([]);
  rows.push(['CASE PIPELINE']);
  rows.push(['Stage', 'Count']);
  stageBreakdown.forEach((s) => rows.push([s.label, String(s.count)]));
  rows.push([]);
  rows.push(['AVG CASE VALUE BY SERVICE']);
  rows.push(['Service', 'Avg Value', 'Count']);
  metrics.avgCaseValueByService.forEach((s) => rows.push([s.service, `$${s.avgValue.toFixed(2)}`, String(s.count)]));

  return rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function buildPDFHTML(metrics: KPIMetrics, revenueChart: RevenuePoint[], stageBreakdown: StageBreakdown[], reportType: string): string {
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  const fmtPct = (n: number) => `${Math.round(n)}%`;

  const sections: Record<string, string> = {
    monthly: `
      <h2>Revenue Summary — ${monthLabel}</h2>
      <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Revenue MTD</td><td>${fmt(metrics.revenueMTD)}</td></tr>
        <tr><td>Revenue Last Month</td><td>${fmt(metrics.revenueLastMonth)}</td></tr>
        <tr><td>Revenue YTD</td><td>${fmt(metrics.revenueYTD)}</td></tr>
        <tr><td>Growth vs Last Month</td><td>${metrics.revenueGrowthPct > 0 ? '+' : ''}${fmtPct(metrics.revenueGrowthPct)}</td></tr>
        <tr><td>Monthly Forecast</td><td>${fmt(metrics.monthlyForecast)}</td></tr>
        <tr><td>Collection Rate</td><td>${fmtPct(metrics.collectionRate)}</td></tr>
        <tr><td>Overdue Amount</td><td>${fmt(metrics.overdueAmount)}</td></tr>
      </table>`,
    revenue: `
      <h2>Revenue Summaries</h2>
      <table><tr><th>Month</th><th>Billed</th><th>Collected</th><th>Forecast</th></tr>
        ${revenueChart.map((r) => `<tr><td>${r.month}</td><td>${fmt(r.billed)}</td><td>${fmt(r.collected)}</td><td>${r.forecast ? fmt(r.forecast) : '—'}</td></tr>`).join('')}
      </table>
      <h2>Avg Case Value by Service</h2>
      <table><tr><th>Service</th><th>Avg Value</th><th>Cases</th></tr>
        ${metrics.avgCaseValueByService.map((s) => `<tr><td>${s.service}</td><td>${fmt(s.avgValue)}</td><td>${s.count}</td></tr>`).join('')}
      </table>`,
    practice: `
      <h2>Practice Analytics — ${monthLabel}</h2>
      <table><tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Active Cases</td><td>${metrics.activeCases}</td></tr>
        <tr><td>New Cases MTD</td><td>${metrics.newCasesThisMonth}</td></tr>
        <tr><td>Closed MTD</td><td>${metrics.closedThisMonth}</td></tr>
        <tr><td>Avg Case Value</td><td>${fmt(metrics.avgCaseValue)}</td></tr>
        <tr><td>Case Completion Rate</td><td>${fmtPct(metrics.caseCompletionRate)}</td></tr>
        <tr><td>Conversion Rate</td><td>${fmtPct(metrics.conversionRate)}</td></tr>
        <tr><td>Utilization Rate</td><td>${fmtPct(metrics.utilizationRate)}</td></tr>
        <tr><td>Billable Hours MTD</td><td>${metrics.totalBillableHours.toFixed(1)} hrs</td></tr>
        <tr><td>Active Retainers</td><td>${metrics.activeRetainers}</td></tr>
      </table>
      <h2>Case Pipeline</h2>
      <table><tr><th>Stage</th><th>Count</th></tr>
        ${stageBreakdown.map((s) => `<tr><td>${s.label}</td><td>${s.count}</td></tr>`).join('')}
      </table>`,
  };

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Broussard Legal Services — KPI Report</title>
    <style>
      body { font-family: Georgia, serif; color: #1a1a1a; margin: 40px; }
      h1 { color: #355E3B; border-bottom: 2px solid #355E3B; padding-bottom: 8px; }
      h2 { color: #355E3B; margin-top: 28px; font-size: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
      th { background: #355E3B; color: white; padding: 8px 12px; text-align: left; }
      td { padding: 7px 12px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f9fafb; }
      .footer { margin-top: 40px; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 12px; }
    </style>
  </head><body>
    <h1>Broussard Legal Services</h1>
    <p style="color:#6b7280;font-size:13px;">Generated: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    ${sections[reportType] || sections.monthly}
    <div class="footer">Broussard Legal Services · Confidential Business Report · broussardlegalservices.com</div>
  </body></html>`;
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  metrics: KPIMetrics;
  revenueChart: RevenuePoint[];
  stageBreakdown: StageBreakdown[];
}

function ExportModal({ open, onClose, metrics, revenueChart, stageBreakdown }: ExportModalProps) {
  const [reportType, setReportType] = useState<'monthly' | 'revenue' | 'practice'>('monthly');
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [emailTo, setEmailTo] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [emailMsg, setEmailMsg] = useState('');

  const REPORT_LABELS: Record<string, string> = {
    monthly: 'Monthly Business Report',
    revenue: 'Revenue Summary',
    practice: 'Practice Analytics',
  };

  const handleDownloadCSV = () => {
    const csv = buildCSV(metrics, revenueChart, stageBreakdown);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BLS_KPI_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    const html = buildPDFHTML(metrics, revenueChart, stageBreakdown, reportType);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => {
        win.print();
        URL.revokeObjectURL(url);
      };
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim() || !emailTo.includes('@')) {
      setEmailStatus('error');
      setEmailMsg('Please enter a valid email address.');
      return;
    }
    setSendingEmail(true);
    setEmailStatus('idle');
    try {
      const now = new Date();
      const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const csvContent = buildCSV(metrics, revenueChart, stageBreakdown);
      const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

      const res = await fetch('/api/admin/send-resend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: `Broussard Legal Services — ${REPORT_LABELS[reportType]} — ${monthLabel}`,
          html: `
            <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;">
              <div style="background:#355E3B;padding:24px 32px;border-radius:8px 8px 0 0;">
                <h1 style="color:white;margin:0;font-size:20px;">Broussard Legal Services</h1>
                <p style="color:#a7d9b4;margin:4px 0 0;font-size:13px;">${REPORT_LABELS[reportType]} — ${monthLabel}</p>
              </div>
              <div style="padding:24px 32px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <h2 style="color:#355E3B;font-size:15px;margin-top:0;">Key Metrics Snapshot</h2>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                  <tr style="background:#355E3B;color:white;"><th style="padding:8px 12px;text-align:left;">Metric</th><th style="padding:8px 12px;text-align:right;">Value</th></tr>
                  <tr><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;">Revenue MTD</td><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;">${fmt(metrics.revenueMTD)}</td></tr>
                  <tr style="background:#f3f4f6;"><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;">Revenue YTD</td><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(metrics.revenueYTD)}</td></tr>
                  <tr><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;">Active Cases</td><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${metrics.activeCases}</td></tr>
                  <tr style="background:#f3f4f6;"><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;">Collection Rate</td><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${Math.round(metrics.collectionRate)}%</td></tr>
                  <tr><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;">Conversion Rate</td><td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${Math.round(metrics.conversionRate)}%</td></tr>
                  <tr style="background:#f3f4f6;"><td style="padding:7px 12px;">Utilization Rate</td><td style="padding:7px 12px;text-align:right;">${Math.round(metrics.utilizationRate)}%</td></tr>
                </table>
                <p style="font-size:12px;color:#6b7280;margin-top:20px;">A full CSV report is attached to this email for detailed analysis.</p>
                <p style="font-size:11px;color:#9ca3af;margin-top:16px;border-top:1px solid #e5e7eb;padding-top:12px;">Broussard Legal Services · Confidential · broussardlegalservices.com</p>
              </div>
            </div>`,
          attachments: [
            {
              filename: `BLS_KPI_${reportType}_${now.toISOString().split('T')[0]}.csv`,
              content: Buffer.from(csvContent).toString('base64'),
              type: 'text/csv',
            },
          ],
        }),
      });

      if (!res.ok) throw new Error('Email send failed');
      setEmailStatus('success');
      setEmailMsg(`Report sent to ${emailTo.trim()}`);
    } catch {
      setEmailStatus('error');
      setEmailMsg('Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <h3 className="text-base font-bold text-foreground">Export KPI Report</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Report Type */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">Report Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['monthly', 'revenue', 'practice'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    reportType === type
                      ? 'bg-primary text-white border-primary' :'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {type === 'monthly' ? '📊 Monthly' : type === 'revenue' ? '💰 Revenue' : '📈 Practice'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{REPORT_LABELS[reportType]}</p>
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">Export Format</label>
            <div className="grid grid-cols-2 gap-2">
              {(['csv', 'pdf'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                    exportFormat === fmt
                      ? 'bg-primary/10 text-primary border-primary/40' :'bg-card text-muted-foreground border-border hover:border-primary/30'
                  }`}
                >
                  <span className="text-base">{fmt === 'csv' ? '📋' : '📄'}</span>
                  {fmt.toUpperCase()}
                  <span className="text-xs font-normal opacity-70">{fmt === 'csv' ? 'Spreadsheet' : 'Printable'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Download Button */}
          <button
            onClick={exportFormat === 'csv' ? handleDownloadCSV : handleDownloadPDF}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download {exportFormat.toUpperCase()}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">or send via email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email Send */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Send Report To</label>
              <input
                type="email"
                placeholder="attorney@broussardlegalservices.com"
                value={emailTo}
                onChange={(e) => { setEmailTo(e.target.value); setEmailStatus('idle'); }}
                className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              />
            </div>
            {emailStatus === 'success' && (
              <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{emailMsg}</p>
            )}
            {emailStatus === 'error' && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{emailMsg}</p>
            )}
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail || !emailTo.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sendingEmail ? (
                <>
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Sending…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                  Send Report via Email
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  subPositive?: boolean;
  icon: React.ReactNode;
  iconBg: string;
  loading: boolean;
  alert?: boolean;
  onClick?: () => void;
}

function KPICard({ label, value, sub, subPositive, icon, iconBg, loading, alert, onClick }: KPICardProps) {
  return (
    <button
      onClick={onClick}
      className={`group bg-card border rounded-2xl p-5 text-left transition-all duration-200 hover:shadow-sm w-full ${
        alert ? 'border-red-200 hover:border-red-300' : 'border-border hover:border-primary/30'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        {sub && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            subPositive === true ? 'bg-emerald-50 text-emerald-700' :
            subPositive === false ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {sub}
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-20 bg-muted/60 animate-pulse rounded-lg mt-1" />
      ) : (
        <p className={`text-2xl font-bold tracking-tight ${alert ? 'text-red-700' : 'text-foreground'}`}>{value}</p>
      )}
      <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
    </button>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface AdminKPIDashboardProps {
  onNavigate?: (tab: string) => void;
}

export default function AdminKPIDashboard({ onNavigate }: AdminKPIDashboardProps) {
  const [metrics, setMetrics] = useState<KPIMetrics>({
    revenueMTD: 0, revenueLastMonth: 0, revenueYTD: 0, revenueGrowthPct: 0,
    activeCases: 0, newCasesThisMonth: 0, closedThisMonth: 0, avgCaseValue: 0,
    overdueCount: 0, overdueAmount: 0, collectionRate: 0, pendingAmount: 0,
    newLeadsThisWeek: 0, newLeadsThisMonth: 0, conversionRate: 0, avgDaysToConvert: 0,
    unreadMessages: 0, upcomingDeadlines: 0, overdueDeadlines: 0, activeRetainers: 0,
    caseCompletionRate: 0, quarterlyRevenue: 0, quarterlyForecast: 0, monthlyForecast: 0,
    utilizationRate: 0, totalBillableHours: 0, avgCaseValueByService: [],
  });
  const [revenueChart, setRevenueChart] = useState<RevenuePoint[]>([]);
  const [stageBreakdown, setStageBreakdown] = useState<StageBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activeSection, setActiveSection] = useState<'overview' | 'forecasts' | 'utilization'>('overview');
  const [exportOpen, setExportOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const todayStr = now.toISOString().split('T')[0];
      const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString();

      const [
        invoicesAllRes,
        activeCasesRes,
        newCasesMTDRes,
        closedMTDRes,
        newLeadsWeekRes,
        newLeadsMTDRes,
        unreadMsgRes,
        upcomingTasksRes,
        overdueTasksRes,
        activeRetainersRes,
        allCasesRes,
        billableHoursRes,
        totalCasesRes,
      ] = await Promise.all([
        supabase.from('client_invoices').select('amount, amount_paid, status, created_at, inquiry_id'),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true })
          .in('booking_stage', ['active_client', 'consultation_booked', 'proposal_sent', 'retainer_signed']),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true })
          .gte('created_at', startOfMonth),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true })
          .eq('booking_stage', 'closed').gte('updated_at', startOfMonth),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true })
          .gte('created_at', weekAgo),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true })
          .gte('created_at', startOfMonth),
        supabase.from('portal_messages').select('id', { count: 'exact', head: true })
          .eq('sender_role', 'client').eq('read_by_admin', false),
        supabase.from('admin_tasks').select('id', { count: 'exact', head: true })
          .not('status', 'eq', 'done').gte('due_date', todayStr).lte('due_date', sevenDaysOut),
        supabase.from('admin_tasks').select('id', { count: 'exact', head: true })
          .not('status', 'eq', 'done').lt('due_date', todayStr),
        supabase.from('retainer_subscriptions').select('id', { count: 'exact', head: true })
          .in('status', ['active', 'trialing']),
        supabase.from('contact_inquiries').select('booking_stage, created_at, updated_at, status, service'),
        supabase.from('billable_time_logs').select('hours, created_at').gte('created_at', startOfMonth).limit(500),
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true }),
      ]);

      const allInvoices = invoicesAllRes.data || [];

      // Revenue calculations
      const paidInvoices = allInvoices.filter((i) => i.status === 'paid');
      const revenueMTD = paidInvoices
        .filter((i) => i.created_at >= startOfMonth)
        .reduce((s, i) => s + (i.amount_paid ?? i.amount ?? 0), 0);
      const revenueLastMonth = paidInvoices
        .filter((i) => i.created_at >= startOfLastMonth && i.created_at <= endOfLastMonth)
        .reduce((s, i) => s + (i.amount_paid ?? i.amount ?? 0), 0);
      const revenueYTD = paidInvoices
        .filter((i) => i.created_at >= startOfYear)
        .reduce((s, i) => s + (i.amount_paid ?? i.amount ?? 0), 0);
      const revenueGrowthPct = revenueLastMonth > 0
        ? ((revenueMTD - revenueLastMonth) / revenueLastMonth) * 100
        : 0;

      // Quarterly revenue
      const quarterlyRevenue = paidInvoices
        .filter((i) => i.created_at >= quarterStart)
        .reduce((s, i) => s + (i.amount_paid ?? i.amount ?? 0), 0);

      // Monthly forecast: project current month based on days elapsed
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthlyForecast = dayOfMonth > 0 ? Math.round((revenueMTD / dayOfMonth) * daysInMonth) : 0;

      // Quarterly forecast: project based on months elapsed in quarter
      const monthsIntoQuarter = (now.getMonth() % 3) + (dayOfMonth / daysInMonth);
      const quarterlyForecast = monthsIntoQuarter > 0 ? Math.round((quarterlyRevenue / monthsIntoQuarter) * 3) : 0;

      // Invoice metrics
      const overdueInvoices = allInvoices.filter((i) => i.status === 'overdue');
      const overdueAmount = overdueInvoices.reduce((s, i) => s + Math.max(0, i.amount - (i.amount_paid ?? 0)), 0);
      const pendingInvoices = allInvoices.filter((i) => ['sent', 'pending'].includes(i.status));
      const pendingAmount = pendingInvoices.reduce((s, i) => s + Math.max(0, i.amount - (i.amount_paid ?? 0)), 0);
      const totalBilled = allInvoices.reduce((s, i) => s + (i.amount ?? 0), 0);
      const totalCollected = allInvoices.reduce((s, i) => s + (i.amount_paid ?? 0), 0);
      const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

      // Avg case value
      const activeCaseCount = activeCasesRes.count ?? 0;
      const avgCaseValue = activeCaseCount > 0 ? totalBilled / activeCaseCount : 0;

      // Case completion rate
      const totalCases = totalCasesRes.count ?? 1;
      const closedMTD = closedMTDRes.count ?? 0;
      const caseCompletionRate = totalCases > 0 ? (closedMTD / Math.max(totalCases, 1)) * 100 : 0;

      // Conversion rate
      const newLeadsMTD = newLeadsMTDRes.count ?? 0;
      const conversionRate = newLeadsMTD > 0 ? (closedMTD / newLeadsMTD) * 100 : 0;

      // Billable hours & utilization
      const billableHoursData = billableHoursRes.data || [];
      const totalBillableHours = billableHoursData.reduce((s: number, r: { hours: number }) => s + (r.hours || 0), 0);
      // Assume 160 available hours/month (standard full-time equivalent)
      const utilizationRate = Math.min(100, (totalBillableHours / 160) * 100);

      // Avg case value by service
      const allCases = allCasesRes.data || [];
      const serviceMap: Record<string, { total: number; count: number }> = {};
      allCases.forEach((c) => {
        const svc = c.service || 'General';
        if (!serviceMap[svc]) serviceMap[svc] = { total: 0, count: 0 };
        serviceMap[svc].count++;
      });
      // Distribute invoice amounts by service proportionally
      const totalCaseCount = allCases.length || 1;
      Object.keys(serviceMap).forEach((svc) => {
        const proportion = serviceMap[svc].count / totalCaseCount;
        serviceMap[svc].total = totalBilled * proportion;
      });
      const avgCaseValueByService: ServiceValueItem[] = Object.entries(serviceMap)
        .map(([service, data]) => ({
          service: service.length > 20 ? service.substring(0, 18) + '…' : service,
          avgValue: data.count > 0 ? Math.round(data.total / data.count) : 0,
          count: data.count,
        }))
        .sort((a, b) => b.avgValue - a.avgValue)
        .slice(0, 7);

      // Revenue chart (last 6 months + 2 forecast months)
      const chartData: RevenuePoint[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short' });
        const monthInvoices = allInvoices.filter((inv) => {
          const d = new Date(inv.created_at);
          return d >= monthStart && d <= monthEnd;
        });
        const billed = monthInvoices.reduce((s, inv) => s + (inv.amount ?? 0), 0);
        const collected = monthInvoices.filter((inv) => inv.status === 'paid').reduce((s, inv) => s + (inv.amount_paid ?? inv.amount ?? 0), 0);
        chartData.push({ month: monthLabel, billed, collected });
      }
      // Add 2 forecast months
      for (let i = 1; i <= 2; i++) {
        const forecastMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const label = forecastMonth.toLocaleDateString('en-US', { month: 'short' }) + ' (F)';
        const avgMonthly = revenueYTD / Math.max(now.getMonth() + 1, 1);
        const growthFactor = 1 + (revenueGrowthPct / 100) * 0.5;
        chartData.push({ month: label, billed: 0, collected: 0, forecast: Math.round(avgMonthly * growthFactor) });
      }

      // Stage breakdown
      const stageCounts: Record<string, number> = {};
      allCases.forEach((c) => {
        const stage = c.booking_stage || 'inquiry';
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      });
      const breakdown: StageBreakdown[] = Object.entries(stageCounts).map(([stage, count]) => ({
        stage,
        label: STAGE_LABELS[stage] || stage,
        count,
        color: STAGE_COLORS[stage] || '#94a3b8',
      })).sort((a, b) => b.count - a.count);

      setMetrics({
        revenueMTD, revenueLastMonth, revenueYTD, revenueGrowthPct,
        activeCases: activeCaseCount,
        newCasesThisMonth: newCasesMTDRes.count ?? 0,
        closedThisMonth: closedMTD,
        avgCaseValue,
        overdueCount: overdueInvoices.length,
        overdueAmount, collectionRate, pendingAmount,
        newLeadsThisWeek: newLeadsWeekRes.count ?? 0,
        newLeadsThisMonth: newLeadsMTD,
        conversionRate, avgDaysToConvert: 0,
        unreadMessages: unreadMsgRes.count ?? 0,
        upcomingDeadlines: upcomingTasksRes.count ?? 0,
        overdueDeadlines: overdueTasksRes.count ?? 0,
        activeRetainers: activeRetainersRes.count ?? 0,
        caseCompletionRate, quarterlyRevenue, quarterlyForecast, monthlyForecast,
        utilizationRate, totalBillableHours, avgCaseValueByService,
      });
      setRevenueChart(chartData);
      setStageBreakdown(breakdown);
      setLastRefreshed(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sections = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'forecasts' as const, label: 'Revenue Forecasts' },
    { id: 'utilization' as const, label: 'Utilization & Rates' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Practice KPIs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Last refreshed {lastRefreshed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Section Tabs */}
          <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeSection === s.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        metrics={metrics}
        revenueChart={revenueChart}
        stageBreakdown={stageBreakdown}
      />

      {/* ── OVERVIEW SECTION ── */}
      {activeSection === 'overview' && (
        <>
          {/* Revenue KPIs */}
          <div>
            <SectionHeader
              title="Revenue"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label="Revenue MTD"
                value={fmtK(metrics.revenueMTD)}
                sub={growthLabel(metrics.revenueGrowthPct)}
                subPositive={metrics.revenueGrowthPct >= 0}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                iconBg="bg-emerald-50 text-emerald-700"
                loading={loading}
              />
              <KPICard
                label="Revenue YTD"
                value={fmtK(metrics.revenueYTD)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
                iconBg="bg-blue-50 text-blue-700"
                loading={loading}
              />
              <KPICard
                label="Collection Rate"
                value={fmtPct(metrics.collectionRate)}
                sub={metrics.collectionRate >= 80 ? 'Healthy' : metrics.collectionRate >= 60 ? 'Moderate' : 'Needs attention'}
                subPositive={metrics.collectionRate >= 80}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
                iconBg="bg-purple-50 text-purple-700"
                loading={loading}
              />
              <KPICard
                label="Pending Invoices"
                value={fmtK(metrics.pendingAmount)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
                iconBg="bg-amber-50 text-amber-700"
                loading={loading}
                onClick={() => onNavigate?.('invoices')}
              />
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Revenue Trend (6 months + 2-month forecast)</h3>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-primary inline-block rounded" /> Billed</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Collected</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block rounded border-dashed" /> Forecast</span>
              </div>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="h-48 bg-muted/30 animate-pulse rounded-xl" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={revenueChart} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="billedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#355E3B" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#355E3B" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} />
                    <Tooltip
                      formatter={(value: number, name: string) => [fmtK(value), name === 'billed' ? 'Billed' : name === 'collected' ? 'Collected' : 'Forecast']}
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="billed" stroke="#355E3B" strokeWidth={2} fill="url(#billedGrad)" />
                    <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} fill="url(#collectedGrad)" />
                    <Area type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" fill="url(#forecastGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Cases + Leads KPIs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <SectionHeader
                title="Cases"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
              />
              <div className="grid grid-cols-2 gap-3">
                <KPICard
                  label="Active Cases"
                  value={String(metrics.activeCases)}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
                  iconBg="bg-emerald-50 text-emerald-700"
                  loading={loading}
                  onClick={() => onNavigate?.('cases')}
                />
                <KPICard
                  label="Case Completion Rate"
                  value={fmtPct(metrics.caseCompletionRate)}
                  sub={metrics.caseCompletionRate >= 15 ? 'On track' : 'Below avg'}
                  subPositive={metrics.caseCompletionRate >= 15}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                  iconBg="bg-blue-50 text-blue-700"
                  loading={loading}
                />
                <KPICard
                  label="Avg Case Value"
                  value={fmtK(metrics.avgCaseValue)}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                  iconBg="bg-purple-50 text-purple-700"
                  loading={loading}
                />
                <KPICard
                  label="Active Retainers"
                  value={String(metrics.activeRetainers)}
                  icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                  iconBg="bg-amber-50 text-amber-700"
                  loading={loading}
                  onClick={() => onNavigate?.('retainer_subscriptions')}
                />
              </div>
            </div>

            {/* Stage Breakdown */}
            <div>
              <SectionHeader
                title="Pipeline Breakdown"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
              />
              <div className="bg-card border border-border rounded-2xl p-4">
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-8 bg-muted/40 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : stageBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No case data</p>
                ) : (
                  <div className="space-y-2.5">
                    {stageBreakdown.map((item) => {
                      const total = stageBreakdown.reduce((s, i) => s + i.count, 0);
                      const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                      return (
                        <div key={item.stage}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                              <span className="text-xs font-medium text-foreground">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground">{item.count}</span>
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: item.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Alerts + Operations KPIs */}
          <div>
            <SectionHeader
              title="Alerts & Operations"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label="Overdue Invoices"
                value={String(metrics.overdueCount)}
                sub={metrics.overdueCount > 0 ? fmtK(metrics.overdueAmount) + ' owed' : undefined}
                subPositive={false}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
                iconBg={metrics.overdueCount > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-500'}
                loading={loading}
                alert={metrics.overdueCount > 0}
                onClick={() => onNavigate?.('invoices')}
              />
              <KPICard
                label="Unread Messages"
                value={String(metrics.unreadMessages)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
                iconBg={metrics.unreadMessages > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-500'}
                loading={loading}
                alert={metrics.unreadMessages > 5}
                onClick={() => onNavigate?.('messages')}
              />
              <KPICard
                label="Upcoming Deadlines"
                value={String(metrics.upcomingDeadlines)}
                sub="Next 7 days"
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                iconBg="bg-amber-50 text-amber-700"
                loading={loading}
                onClick={() => onNavigate?.('tasks')}
              />
              <KPICard
                label="Overdue Tasks"
                value={String(metrics.overdueDeadlines)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                iconBg={metrics.overdueDeadlines > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-500'}
                loading={loading}
                alert={metrics.overdueDeadlines > 0}
                onClick={() => onNavigate?.('tasks')}
              />
            </div>
          </div>

          {/* Leads KPIs */}
          <div>
            <SectionHeader
              title="Lead Pipeline"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label="New Leads (Week)"
                value={String(metrics.newLeadsThisWeek)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
                iconBg="bg-blue-50 text-blue-700"
                loading={loading}
                onClick={() => onNavigate?.('inquiries')}
              />
              <KPICard
                label="New Leads (Month)"
                value={String(metrics.newLeadsThisMonth)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                iconBg="bg-violet-50 text-violet-700"
                loading={loading}
                onClick={() => onNavigate?.('inquiries')}
              />
              <KPICard
                label="Conversion Rate"
                value={fmtPct(metrics.conversionRate)}
                sub={metrics.conversionRate >= 20 ? 'Strong' : metrics.conversionRate >= 10 ? 'Average' : 'Low'}
                subPositive={metrics.conversionRate >= 20}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
                iconBg="bg-emerald-50 text-emerald-700"
                loading={loading}
              />
              <KPICard
                label="Closed This Month"
                value={String(metrics.closedThisMonth)}
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
                iconBg="bg-slate-100 text-slate-600"
                loading={loading}
              />
            </div>
          </div>
        </>
      )}

      {/* ── FORECASTS SECTION ── */}
      {activeSection === 'forecasts' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Monthly Forecast</span>
              </div>
              {loading ? <div className="h-8 w-24 bg-muted/60 animate-pulse rounded-lg" /> : (
                <p className="text-3xl font-bold text-foreground">{fmtK(metrics.monthlyForecast)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Projected end-of-month revenue based on current pace</p>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Actual MTD</span>
                <span className="font-semibold text-foreground">{fmtK(metrics.revenueMTD)}</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Quarterly Forecast</span>
              </div>
              {loading ? <div className="h-8 w-24 bg-muted/60 animate-pulse rounded-lg" /> : (
                <p className="text-3xl font-bold text-foreground">{fmtK(metrics.quarterlyForecast)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Projected quarter-end revenue at current run rate</p>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Actual QTD</span>
                <span className="font-semibold text-foreground">{fmtK(metrics.quarterlyRevenue)}</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Annual Run Rate</span>
              </div>
              {loading ? <div className="h-8 w-24 bg-muted/60 animate-pulse rounded-lg" /> : (
                <p className="text-3xl font-bold text-foreground">{fmtK(metrics.revenueYTD / Math.max(new Date().getMonth() + 1, 1) * 12)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Annualized based on YTD average monthly revenue</p>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">YTD Actual</span>
                <span className="font-semibold text-foreground">{fmtK(metrics.revenueYTD)}</span>
              </div>
            </div>
          </div>

          {/* Avg Case Value by Service */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Avg Case Value by Service Type</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Revenue distributed across practice areas</p>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="h-48 bg-muted/30 animate-pulse rounded-xl" />
              ) : metrics.avgCaseValueByService.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No service data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={metrics.avgCaseValueByService} margin={{ top: 5, right: 5, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="service" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} />
                    <Tooltip
                      formatter={(value: number) => [fmtK(value), 'Avg Case Value']}
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px' }}
                    />
                    <Bar dataKey="avgValue" radius={[6, 6, 0, 0]}>
                      {metrics.avgCaseValueByService.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={SERVICE_COLORS[index % SERVICE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Case Completion Rate Detail */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Case Completion Rate</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Cases closed this month vs. total active</p>
              </div>
              {loading ? <div className="h-8 w-16 bg-muted/60 animate-pulse rounded-lg" /> : (
                <span className={`text-2xl font-bold ${metrics.caseCompletionRate >= 15 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {fmtPct(metrics.caseCompletionRate)}
                </span>
              )}
            </div>
            <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, metrics.caseCompletionRate * 3)}%`,
                  background: metrics.caseCompletionRate >= 15 ? '#10b981' : '#f59e0b',
                }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>Closed this month: <strong className="text-foreground">{metrics.closedThisMonth}</strong></span>
              <span>Active cases: <strong className="text-foreground">{metrics.activeCases}</strong></span>
            </div>
          </div>
        </>
      )}

      {/* ── UTILIZATION SECTION ── */}
      {activeSection === 'utilization' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Utilization Rate</span>
              </div>
              {loading ? <div className="h-8 w-20 bg-muted/60 animate-pulse rounded-lg" /> : (
                <p className={`text-3xl font-bold ${metrics.utilizationRate >= 70 ? 'text-emerald-600' : metrics.utilizationRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {fmtPct(metrics.utilizationRate)}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Billable hours vs. 160hr capacity this month</p>
              <div className="mt-3 h-2 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${metrics.utilizationRate}%`,
                    background: metrics.utilizationRate >= 70 ? '#10b981' : metrics.utilizationRate >= 50 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Billable Hours MTD</span>
              </div>
              {loading ? <div className="h-8 w-20 bg-muted/60 animate-pulse rounded-lg" /> : (
                <p className="text-3xl font-bold text-foreground">{metrics.totalBillableHours.toFixed(1)}<span className="text-base font-normal text-muted-foreground ml-1">hrs</span></p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Total logged billable hours this month</p>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Target capacity</span>
                <span className="font-semibold text-foreground">160 hrs</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Effective Hourly Rate</span>
              </div>
              {loading ? <div className="h-8 w-20 bg-muted/60 animate-pulse rounded-lg" /> : (
                <p className="text-3xl font-bold text-foreground">
                  {metrics.totalBillableHours > 0 ? fmtK(metrics.revenueMTD / metrics.totalBillableHours) : '$—'}
                  <span className="text-base font-normal text-muted-foreground ml-1">/hr</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Revenue MTD ÷ billable hours logged</p>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Standard rate</span>
                <span className="font-semibold text-foreground">$75/hr</span>
              </div>
            </div>
          </div>

          {/* Utilization Benchmark */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Attorney Utilization Benchmarks</h3>
            <div className="space-y-4">
              {[
                { label: 'Billable Hours Target', current: metrics.totalBillableHours, target: 160, unit: 'hrs', color: '#355E3B' },
                { label: 'Collection Rate Target', current: metrics.collectionRate, target: 90, unit: '%', color: '#3b82f6' },
                { label: 'Case Completion Target', current: metrics.caseCompletionRate, target: 20, unit: '%', color: '#8b5cf6' },
                { label: 'Conversion Rate Target', current: metrics.conversionRate, target: 25, unit: '%', color: '#f59e0b' },
              ].map((item) => {
                const pct = Math.min(100, (item.current / item.target) * 100);
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">
                        {loading ? '—' : `${item.current.toFixed(item.unit === 'hrs' ? 1 : 0)}${item.unit} / ${item.target}${item.unit}`}
                      </span>
                    </div>
                    <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
                      {loading ? (
                        <div className="h-full w-1/3 bg-muted/60 animate-pulse rounded-full" />
                      ) : (
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: item.color }}
                        />
                      )}
                    </div>
                    {!loading && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {pct >= 100 ? '✓ Target met' : `${Math.round(100 - pct)}% below target`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Retainer Efficiency */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Active Retainers"
              value={String(metrics.activeRetainers)}
              sub="Monthly recurring"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
              iconBg="bg-emerald-50 text-emerald-700"
              loading={loading}
              onClick={() => onNavigate?.('retainer_subscriptions')}
            />
            <KPICard
              label="Retainer Revenue Est."
              value={fmtK(metrics.activeRetainers * 1500)}
              sub="At avg $1,500/mo"
              subPositive={true}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
              iconBg="bg-blue-50 text-blue-700"
              loading={loading}
            />
            <KPICard
              label="Avg Case Value"
              value={fmtK(metrics.avgCaseValue)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>}
              iconBg="bg-purple-50 text-purple-700"
              loading={loading}
            />
            <KPICard
              label="New Cases MTD"
              value={String(metrics.newCasesThisMonth)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
              iconBg="bg-amber-50 text-amber-700"
              loading={loading}
            />
          </div>
        </>
      )}
    </div>
  );
}