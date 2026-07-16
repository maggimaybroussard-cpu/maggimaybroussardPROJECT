'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface MonthlyReportData {
  revenue_total: number;
  invoices_issued: number;
  invoices_paid: number;
  collection_rate: number;
  hours_billed: number;
  cases_opened: number;
  cases_closed: number;
  new_clients: number;
  avg_invoice_value: number;
  outstanding_balance: number;
  top_services: Array<{ service: string; count: number; revenue: number }>;
}

interface MonthlyReport {
  id: string;
  report_month: string;
  report_data: MonthlyReportData;
  pdf_url: string | null;
  email_sent: boolean;
  email_sent_at: string | null;
  generated_at: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fmtShort(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MonthlyReportDashboard() {
  const supabase = createClient();
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('monthly_business_reports')
        .select('*')
        .order('report_month', { ascending: false })
        .limit(12);
      setReports(data || []);
      if (data && data.length > 0 && !selectedReport) {
        setSelectedReport(data[0]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedReport]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const generateReport = async () => {
    setGenerating(true);
    setError(null);
    try {
      const startDate = `${reportMonth}-01`;
      const endDate = new Date(parseInt(reportMonth.split('-')[0]), parseInt(reportMonth.split('-')[1]), 0).toISOString().split('T')[0];

      const [invoicesRes, inquiriesRes, timeLogsRes] = await Promise.all([
        supabase.from('client_invoices').select('amount, amount_paid, status, created_at').gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59'),
        supabase.from('contact_inquiries').select('service, status, created_at').gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59'),
        supabase.from('retainer_time_logs').select('hours, work_date').gte('work_date', startDate).lte('work_date', endDate),
      ]);

      const invoices = invoicesRes.data || [];
      const inquiries = inquiriesRes.data || [];
      const timeLogs = timeLogsRes.data || [];

      const revenueTotal = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount_paid || 0), 0);
      const invoicesIssued = invoices.length;
      const invoicesPaid = invoices.filter(i => i.status === 'paid').length;
      const collectionRate = invoicesIssued > 0 ? Math.round((invoicesPaid / invoicesIssued) * 100) : 0;
      const hoursBilled = timeLogs.reduce((s, t) => s + (t.hours || 0), 0);
      const casesOpened = inquiries.filter(i => i.status === 'active' || i.status === 'new').length;
      const casesClosed = inquiries.filter(i => i.status === 'closed').length;
      const outstandingBalance = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.amount - i.amount_paid), 0);
      const avgInvoiceValue = invoicesIssued > 0 ? revenueTotal / Math.max(invoicesPaid, 1) : 0;

      // Service breakdown
      const serviceMap: Record<string, { count: number; revenue: number }> = {};
      inquiries.forEach(inq => {
        if (!serviceMap[inq.service]) serviceMap[inq.service] = { count: 0, revenue: 0 };
        serviceMap[inq.service].count++;
      });
      const topServices = Object.entries(serviceMap)
        .map(([service, data]) => ({ service, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const reportData: MonthlyReportData = {
        revenue_total: revenueTotal,
        invoices_issued: invoicesIssued,
        invoices_paid: invoicesPaid,
        collection_rate: collectionRate,
        hours_billed: Math.round(hoursBilled * 10) / 10,
        cases_opened: casesOpened,
        cases_closed: casesClosed,
        new_clients: inquiries.length,
        avg_invoice_value: avgInvoiceValue,
        outstanding_balance: outstandingBalance,
        top_services: topServices,
      };

      const { data: saved, error: saveErr } = await supabase
        .from('monthly_business_reports')
        .upsert({
          report_month: startDate,
          report_data: reportData,
          generated_at: new Date().toISOString(),
        }, { onConflict: 'report_month' })
        .select()
        .single();

      if (saveErr) throw saveErr;
      setSuccessMsg(`Report generated for ${fmtDate(startDate)}`);
      setSelectedReport(saved);
      await fetchReports();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const rd = selectedReport?.report_data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: '#4A3728' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div>
              <h2 className="font-serif text-xl text-foreground">Monthly Business Reports</h2>
              <p className="text-xs text-muted-foreground">Auto-generated on the 1st · Revenue, hours, cases, collection rate</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/40" />
            <button onClick={generateReport} disabled={generating}
              className="px-4 py-2 rounded-xl text-white text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              style={{ background: '#4A3728' }}>
              {generating ? (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Generating…</>
              ) : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {successMsg}
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Report List */}
        <div className="lg:col-span-1 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/40">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Report Archive</p>
          </div>
          {loading ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Loading…</div>
          ) : reports.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No reports yet. Generate your first report above.</div>
          ) : (
            <div className="divide-y divide-border">
              {reports.map(r => (
                <button key={r.id} onClick={() => setSelectedReport(r)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-secondary/30 ${selectedReport?.id === r.id ? 'bg-secondary/40' : ''}`}>
                  <p className="font-medium text-foreground text-sm">{fmtDate(r.report_month)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmt(r.report_data?.revenue_total || 0)} revenue</p>
                  <p className="text-xs text-muted-foreground/60">{fmtShort(r.generated_at)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Report Detail */}
        <div className="lg:col-span-3 space-y-4">
          {selectedReport && rd ? (
            <>
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-xl text-foreground">{fmtDate(selectedReport.report_month)} Report</h3>
                  <span className="text-xs text-muted-foreground">Generated {fmtShort(selectedReport.generated_at)}</span>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Revenue', value: fmt(rd.revenue_total), color: 'text-emerald-700' },
                    { label: 'Collection Rate', value: `${rd.collection_rate}%`, color: rd.collection_rate >= 80 ? 'text-emerald-700' : 'text-amber-600' },
                    { label: 'Hours Billed', value: `${rd.hours_billed}h`, color: 'text-blue-700' },
                    { label: 'Outstanding', value: fmt(rd.outstanding_balance), color: rd.outstanding_balance > 0 ? 'text-red-600' : 'text-emerald-700' },
                    { label: 'Invoices Issued', value: rd.invoices_issued.toString(), color: 'text-foreground' },
                    { label: 'Invoices Paid', value: rd.invoices_paid.toString(), color: 'text-emerald-700' },
                    { label: 'Cases Opened', value: rd.cases_opened.toString(), color: 'text-foreground' },
                    { label: 'Cases Closed', value: rd.cases_closed.toString(), color: 'text-foreground' },
                  ].map(kpi => (
                    <div key={kpi.label} className="p-3 rounded-xl bg-secondary/30 border border-border">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{kpi.label}</p>
                      <p className={`text-lg font-semibold ${kpi.color}`}>{kpi.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Services */}
              {rd.top_services && rd.top_services.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h4 className="font-semibold text-foreground mb-3 text-sm uppercase tracking-widest">Top Services This Month</h4>
                  <div className="space-y-2">
                    {rd.top_services.map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-secondary/60 flex items-center justify-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                          <span className="text-sm text-foreground">{s.service}</span>
                        </div>
                        <span className="text-sm font-semibold text-muted-foreground">{s.count} case{s.count !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Avg Invoice */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Avg Invoice Value</p>
                    <p className="text-2xl font-semibold text-foreground">{fmt(rd.avg_invoice_value)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">New Clients</p>
                    <p className="text-2xl font-semibold text-foreground">{rd.new_clients}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-12 text-center">
              <p className="text-muted-foreground text-sm">Select a report from the archive or generate a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
