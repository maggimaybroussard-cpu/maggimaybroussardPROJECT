'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RetainerSubscription {
  id: string;
  customer_name: string;
  customer_email: string;
  plan_name: string;
  amount: number;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  inquiry_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface CaseInquiry {
  id: string;
  name: string;
  email: string;
  service: string;
  status: string;
  booking_stage: string | null;
}

interface Engagement {
  id: string;
  inquiry_id: string;
  title: string;
  matter_number: string | null;
  engagement_type: string;
  retainer_tier: string;
  status: string;
  hourly_rate: number | null;
  flat_fee: number | null;
  retainer_amount: number | null;
  start_date: string | null;
  end_date: string | null;
}

interface TimeLog {
  id: string;
  retainer_subscription_id: string;
  inquiry_id: string | null;
  engagement_id: string | null;
  hours: number;
  description: string | null;
  work_date: string;
  logged_by: string | null;
  logged_at: string | null;
  created_at: string;
  work_type?: string;
  case_task?: string | null;
  invoice_id?: string | null;
  billed_at?: string | null;
  hourly_rate?: number | null;
  retainer_subscriptions?: {
    customer_name: string;
    plan_name: string;
  } | null;
}

interface ClientInvoice {
  id: string;
  invoice_number: string;
  status: string;
  amount: number;
  inquiry_id: string | null;
  line_items: InvoiceLineItem[];
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  date?: string;
  work_type?: string;
  time_log_id?: string;
}

interface LogForm {
  retainer_subscription_id: string;
  inquiry_id: string;
  engagement_id: string;
  hours: string;
  work_type: string;
  case_task: string;
  description: string;
  work_date: string;
  hourly_rate: string;
}

// ─── Constants (moved before MobileLogCard) ───────────────────────────────────

const WORK_TYPES = [
  { value: 'research', label: 'Legal Research', icon: '🔍', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'drafting', label: 'Drafting', icon: '✍️', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'calls', label: 'Client Calls', icon: '📞', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'review', label: 'Document Review', icon: '📋', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'filing', label: 'Court Filing', icon: '⚖️', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'discovery', label: 'Discovery', icon: '🗂️', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { value: 'other', label: 'Other', icon: '📌', color: 'bg-gray-100 text-gray-600 border-gray-200' },
];

const CASE_TASKS = [
  'Initial Case Review',
  'Legal Research',
  'Document Drafting',
  'Client Communication',
  'Court Filing Preparation',
  'Discovery Review',
  'Deposition Preparation',
  'Contract Review',
  'Regulatory Compliance',
  'Settlement Negotiation',
  'Case Strategy Meeting',
  'Evidence Review',
  'Witness Preparation',
  'Brief Writing',
  'Other',
];

// Retainer tier → hours allowance mapping
const TIER_HOURS: Record<string, number> = {
  essential: 5,
  standard: 10,
  premium: 20,
  enterprise: 40,
  none: 0,
};

function getTierHours(tier: string, retainerAmount: number | null, subAmount: number): number {
  const t = (tier ?? '').toLowerCase();
  if (TIER_HOURS[t] !== undefined && TIER_HOURS[t] > 0) return TIER_HOURS[t];
  // Fall back to subscription amount heuristic
  const amt = retainerAmount ?? subAmount;
  if (amt >= 2000) return 20;
  if (amt >= 1500) return 15;
  if (amt >= 1000) return 10;
  if (amt >= 500) return 5;
  return 10;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function workTypeMeta(wt: string | null | undefined) {
  return WORK_TYPES.find(w => w.value === wt) ?? WORK_TYPES[WORK_TYPES.length - 1];
}

// ─── Mobile Time Log Card ─────────────────────────────────────────────────────

interface MobileLogCardProps {
  log: TimeLog;
  engagements: Engagement[];
  deletingId: string | null;
  onDelete: (id: string) => void;
  onAddToInvoice: (log: TimeLog) => void;
}

function MobileLogCard({ log, engagements, deletingId, onDelete, onAddToInvoice }: MobileLogCardProps) {
  const rawDesc = log.description ?? '';
  const typeMatch = rawDesc.match(/^\[([^\]]+)\]/);
  const workTypeLabel = typeMatch?.[1] ?? null;
  const cleanDesc = typeMatch ? rawDesc.replace(typeMatch[0], '').trim() : rawDesc;
  const wtMeta = WORK_TYPES.find(w => w.label === workTypeLabel) ?? WORK_TYPES[WORK_TYPES.length - 1];
  const isBilled = !!log.billed_at;
  const engagementRecord = log.engagement_id ? engagements.find(e => e.id === log.engagement_id) : null;
  const clientName = (log.retainer_subscriptions as { customer_name: string; plan_name: string } | null)?.customer_name ?? '—';
  const planName = (log.retainer_subscriptions as { customer_name: string; plan_name: string } | null)?.plan_name ?? '';

  return (
    <div className={`px-4 py-3.5 border-b border-gray-50 last:border-0 ${isBilled ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-semibold text-gray-800 truncate">{clientName}</span>
            {isBilled ? (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium shrink-0">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Billed
              </span>
            ) : (
              <button
                onClick={() => onAddToInvoice(log)}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0"
                style={{ borderColor: '#C8965A', color: '#C8965A' }}
              >
                + Invoice
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400">{planName}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-gray-800 leading-none">{Number(log.hours).toFixed(2)}<span className="text-xs font-normal text-gray-400 ml-0.5">h</span></p>
          {log.hourly_rate && Number(log.hourly_rate) > 0 && (
            <p className="text-[10px] text-gray-400 mt-0.5">${(Number(log.hours) * Number(log.hourly_rate)).toFixed(0)}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-[10px] text-gray-500">{fmtDate(log.work_date)}</span>
        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${wtMeta.color}`}>
          {wtMeta.icon} {wtMeta.label}
        </span>
        {log.case_task && (
          <span className="text-[10px] text-gray-600 font-medium bg-gray-100 px-1.5 py-0.5 rounded-full">{log.case_task}</span>
        )}
      </div>

      {engagementRecord && (
        <p className="text-[10px] text-gray-500 mb-1.5 truncate">
          📁 {engagementRecord.title}{engagementRecord.matter_number ? ` #${engagementRecord.matter_number}` : ''}
        </p>
      )}

      {cleanDesc && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{cleanDesc}</p>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => onDelete(log.id)}
          disabled={deletingId === log.id}
          className="text-[10px] text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50 px-2 py-1"
        >
          {deletingId === log.id ? '…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCSV(logs: TimeLog[], engagements: Engagement[], cases: CaseInquiry[], dateFrom: string, dateTo: string) {
  const headers = ['Date', 'Client', 'Case', 'Engagement', 'Case Task', 'Work Type', 'Description', 'Hours', 'Rate', 'Amount', 'Billed'];
  const rows = logs.map(log => {
    const rawDesc = log.description ?? '';
    const typeMatch = rawDesc.match(/^\[([^\]]+)\]/);
    const workTypeLabel = typeMatch?.[1] ?? 'Other';
    const cleanDesc = typeMatch ? rawDesc.replace(typeMatch[0], '').trim() : rawDesc;
    const clientName = (log.retainer_subscriptions as { customer_name: string; plan_name: string } | null)?.customer_name ?? '';
    const caseRecord = cases.find(c => c.id === log.inquiry_id);
    const engagement = engagements.find(e => e.id === log.engagement_id);
    const rate = log.hourly_rate ?? 0;
    const amount = rate > 0 ? (Number(log.hours) * rate).toFixed(2) : '';
    return [
      log.work_date,
      clientName,
      caseRecord ? `${caseRecord.service}` : '',
      engagement ? engagement.title : '',
      log.case_task ?? '',
      workTypeLabel,
      `"${cleanDesc.replace(/"/g, '""')}"`,
      Number(log.hours).toFixed(2),
      rate > 0 ? `$${rate}` : '',
      amount,
      log.billed_at ? 'Yes' : 'No',
    ];
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const rangeLabel = dateFrom && dateTo ? `_${dateFrom}_to_${dateTo}` : '';
  link.href = url;
  link.download = `billable-hours${rangeLabel}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Retainer Hours Bar ───────────────────────────────────────────────────────

function RetainerBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const remaining = Math.max(total - used, 0);
  const color = pct >= 90 ? '#dc2626' : pct >= 75 ? '#d97706' : '#355E3B';

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium" style={{ color }}>
          {used.toFixed(1)} / {total} hrs used
        </span>
        <span className="text-gray-500">{remaining.toFixed(1)} hrs remaining</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {pct >= 75 && (
        <p className="text-xs mt-1" style={{ color }}>
          {pct >= 90 ? '⚠️ Critical — retainer nearly depleted' : '⚡ 75%+ consumed this period'}
        </p>
      )}
    </div>
  );
}

// ─── Client Summary Table ─────────────────────────────────────────────────────

interface ClientSummaryRow {
  clientName: string;
  planName: string;
  email: string;
  totalHours: number;
  retainerHours: number;
  byWorkType: Record<string, number>;
}

function ClientSummarySection({ logs, subscriptions }: { logs: TimeLog[]; subscriptions: RetainerSubscription[] }) {
  const summaryRows = useMemo<ClientSummaryRow[]>(() => {
    const map: Record<string, ClientSummaryRow> = {};
    logs.forEach(log => {
      const subId = log.retainer_subscription_id;
      const sub = subscriptions.find(s => s.id === subId);
      const clientName = (log.retainer_subscriptions as { customer_name: string; plan_name: string } | null)?.customer_name
        ?? sub?.customer_name ?? 'Unknown';
      const planName = (log.retainer_subscriptions as { customer_name: string; plan_name: string } | null)?.plan_name
        ?? sub?.plan_name ?? '';
      const email = sub?.customer_email ?? '';
      const rawDesc = log.description ?? '';
      const typeMatch = rawDesc.match(/^\[([^\]]+)\]/);
      const workTypeLabel = typeMatch?.[1] ?? 'Other';

      if (!map[subId]) {
        map[subId] = {
          clientName,
          planName,
          email,
          totalHours: 0,
          retainerHours: sub ? getTierHours('none', null, Number(sub.amount)) : 0,
          byWorkType: {},
        };
      }
      map[subId].totalHours += Number(log.hours);
      map[subId].byWorkType[workTypeLabel] = (map[subId].byWorkType[workTypeLabel] ?? 0) + Number(log.hours);
    });
    return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
  }, [logs, subscriptions]);

  if (summaryRows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        <p className="text-2xl mb-2">📊</p>
        <p>No data in selected date range.</p>
      </div>
    );
  }

  const grandTotal = summaryRows.reduce((s, r) => s + r.totalHours, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Client</th>
            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden sm:table-cell">Plan</th>
            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden md:table-cell">Top Work Types</th>
            <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">Billed Hrs</th>
            <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap hidden sm:table-cell">Retainer Hrs</th>
            <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">Utilization</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {summaryRows.map((row, i) => {
            const pct = row.retainerHours > 0 ? Math.min((row.totalHours / row.retainerHours) * 100, 999) : 0;
            const pctColor = pct >= 100 ? 'text-red-600' : pct >= 75 ? 'text-amber-600' : 'text-emerald-700';
            const topTypes = Object.entries(row.byWorkType)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3);
            return (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-xs font-semibold text-gray-800">{row.clientName}</p>
                  <p className="text-xs text-gray-400">{row.email}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 hidden sm:table-cell">{row.planName}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {topTypes.map(([label, hrs]) => {
                      const wt = WORK_TYPES.find(w => w.label === label) ?? WORK_TYPES[WORK_TYPES.length - 1];
                      return (
                        <span key={label} className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border ${wt.color}`}>
                          {wt.icon} {hrs.toFixed(1)}h
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-bold text-gray-800">{row.totalHours.toFixed(2)}</span>
                  <span className="text-xs text-gray-400 ml-0.5">h</span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-500 hidden sm:table-cell">
                  {row.retainerHours}h
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs font-semibold ${pctColor}`}>{pct.toFixed(0)}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50">
            <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-gray-600">Total ({summaryRows.length} client{summaryRows.length !== 1 ? 's' : ''})</td>
            <td className="px-4 py-3 text-right">
              <span className="text-sm font-bold text-gray-900">{grandTotal.toFixed(2)}</span>
              <span className="text-xs text-gray-400 ml-0.5">h</span>
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Engagement Consumption Table ─────────────────────────────────────────────

interface EngagementRow {
  engagement: Engagement;
  caseRecord: CaseInquiry | null;
  subscription: RetainerSubscription | null;
  hoursLogged: number;
  hoursAllowance: number;
  byWorkType: Record<string, number>;
  unbilledHours: number;
}

function EngagementConsumptionSection({
  logs,
  engagements,
  cases,
  subscriptions,
}: {
  logs: TimeLog[];
  engagements: Engagement[];
  cases: CaseInquiry[];
  subscriptions: RetainerSubscription[];
}) {
  const rows = useMemo<EngagementRow[]>(() => {
    const map: Record<string, EngagementRow> = {};

    // Initialize rows for all active engagements
    engagements.forEach(eng => {
      const caseRecord = cases.find(c => c.id === eng.inquiry_id) ?? null;
      const subscription = subscriptions.find(s => s.inquiry_id === eng.inquiry_id) ?? null;
      const hoursAllowance = getTierHours(eng.retainer_tier, eng.retainer_amount, Number(subscription?.amount ?? 0));
      map[eng.id] = {
        engagement: eng,
        caseRecord,
        subscription,
        hoursLogged: 0,
        hoursAllowance,
        byWorkType: {},
        unbilledHours: 0,
      };
    });

    // Accumulate hours from logs
    logs.forEach(log => {
      if (!log.engagement_id || !map[log.engagement_id]) return;
      const row = map[log.engagement_id];
      const hrs = Number(log.hours);
      row.hoursLogged += hrs;
      if (!log.billed_at) row.unbilledHours += hrs;
      const rawDesc = log.description ?? '';
      const typeMatch = rawDesc.match(/^\[([^\]]+)\]/);
      const label = typeMatch?.[1] ?? 'Other';
      row.byWorkType[label] = (row.byWorkType[label] ?? 0) + hrs;
    });

    return Object.values(map)
      .filter(r => r.hoursLogged > 0 || r.engagement.status === 'active')
      .sort((a, b) => b.hoursLogged - a.hoursLogged);
  }, [logs, engagements, cases, subscriptions]);

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        <p className="text-2xl mb-2">⚖️</p>
        <p>No engagements found.</p>
        <p className="text-xs mt-1">Create engagements in Case Management, then log hours against them here.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-50">
      {rows.map(row => {
        const pct = row.hoursAllowance > 0 ? Math.min((row.hoursLogged / row.hoursAllowance) * 100, 100) : 0;
        const barColor = pct >= 90 ? '#dc2626' : pct >= 75 ? '#d97706' : '#355E3B';
        const remaining = Math.max(row.hoursAllowance - row.hoursLogged, 0);
        const tierLabel = row.engagement.retainer_tier !== 'none'
          ? row.engagement.retainer_tier.charAt(0).toUpperCase() + row.engagement.retainer_tier.slice(1)
          : null;
        const topTypes = Object.entries(row.byWorkType).sort((a, b) => b[1] - a[1]).slice(0, 3);

        return (
          <div key={row.engagement.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              {/* Left: engagement info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-gray-800 truncate">{row.engagement.title}</span>
                  {row.engagement.matter_number && (
                    <span className="text-xs text-gray-400 font-mono">#{row.engagement.matter_number}</span>
                  )}
                  {tierLabel && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {tierLabel}
                    </span>
                  )}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    row.engagement.status === 'active' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>
                    {row.engagement.status}
                  </span>
                </div>
                {row.caseRecord && (
                  <p className="text-xs text-gray-500 mb-2">
                    {row.caseRecord.service} · {row.caseRecord.name}
                  </p>
                )}

                {/* Hours bar */}
                {row.hoursAllowance > 0 ? (
                  <div className="max-w-xs">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium" style={{ color: barColor }}>
                        {row.hoursLogged.toFixed(1)}h / {row.hoursAllowance}h
                      </span>
                      <span className="text-gray-400">{remaining.toFixed(1)}h left</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: barColor }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">{row.hoursLogged.toFixed(1)}h</span> logged (no retainer cap)
                  </p>
                )}

                {/* Work type breakdown */}
                {topTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {topTypes.map(([label, hrs]) => {
                      const wt = WORK_TYPES.find(w => w.label === label) ?? WORK_TYPES[WORK_TYPES.length - 1];
                      return (
                        <span key={label} className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border ${wt.color}`}>
                          {wt.icon} {hrs.toFixed(1)}h
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: stats */}
              <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-1 shrink-0">
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-800">{row.hoursLogged.toFixed(1)}<span className="text-xs font-normal text-gray-400 ml-0.5">h</span></p>
                  <p className="text-xs text-gray-400">total logged</p>
                </div>
                {row.unbilledHours > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-semibold text-amber-600">{row.unbilledHours.toFixed(1)}<span className="text-xs font-normal ml-0.5">h</span></p>
                    <p className="text-xs text-gray-400">unbilled</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Add to Invoice Modal ─────────────────────────────────────────────────────

interface AddToInvoiceModalProps {
  log: TimeLog;
  invoices: ClientInvoice[];
  onClose: () => void;
  onSuccess: (logId: string, invoiceId: string) => void;
}

function AddToInvoiceModal({ log, invoices, onClose, onSuccess }: AddToInvoiceModalProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawDesc = log.description ?? '';
  const typeMatch = rawDesc.match(/^\[([^\]]+)\]/);
  const workTypeLabel = typeMatch?.[1] ?? 'Other';
  const cleanDesc = typeMatch ? rawDesc.replace(typeMatch[0], '').trim() : rawDesc;
  const clientName = (log.retainer_subscriptions as { customer_name: string; plan_name: string } | null)?.customer_name ?? 'Client';
  const rate = log.hourly_rate ?? 0;
  const lineAmount = rate > 0 ? Number(log.hours) * rate : 0;

  const eligibleInvoices = invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled');

  const handleSubmit = async () => {
    if (!selectedInvoiceId) { setError('Please select an invoice.'); return; }
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const invoice = invoices.find(inv => inv.id === selectedInvoiceId);
      if (!invoice) throw new Error('Invoice not found.');

      const lineItemDesc = [
        log.case_task ? `[${log.case_task}]` : '',
        workTypeLabel,
        cleanDesc,
        `(${fmtDate(log.work_date)})`,
      ].filter(Boolean).join(' ');

      const newLineItem: InvoiceLineItem = {
        description: lineItemDesc,
        quantity: Number(log.hours),
        unit_price: rate > 0 ? rate : 0,
        amount: lineAmount,
        date: log.work_date,
        work_type: workTypeLabel,
        time_log_id: log.id,
      };

      const existingItems: InvoiceLineItem[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];
      const updatedItems = [...existingItems, newLineItem];
      const newTotal = updatedItems.reduce((s, item) => s + (item.amount ?? 0), 0);

      const { error: updateErr } = await supabase
        .from('client_invoices')
        .update({
          line_items: updatedItems,
          amount: newTotal > 0 ? newTotal : invoice.amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedInvoiceId);

      if (updateErr) throw new Error(updateErr.message);

      await supabase
        .from('retainer_time_logs')
        .update({ invoice_id: selectedInvoiceId, billed_at: new Date().toISOString() })
        .eq('id', log.id);

      onSuccess(log.id, selectedInvoiceId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add to invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between" style={{ background: 'rgba(53,94,59,0.04)' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#355E3B' }}>Add to Invoice</p>
            <p className="text-xs text-gray-500 mt-0.5">{clientName} · {Number(log.hours).toFixed(2)} hrs · {fmtDate(log.work_date)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
            <p className="text-xs font-semibold text-gray-600 mb-2">Line Item Preview</p>
            <div className="space-y-1.5">
              {log.case_task && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Task</span>
                  <span className="font-medium text-gray-800">{log.case_task}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Work Type</span>
                <span className="font-medium text-gray-800">{workTypeLabel}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Hours</span>
                <span className="font-medium text-gray-800">{Number(log.hours).toFixed(2)} hrs</span>
              </div>
              {rate > 0 && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Rate</span>
                    <span className="font-medium text-gray-800">${rate}/hr</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-gray-200 pt-1.5 mt-1.5">
                    <span className="font-semibold text-gray-700">Line Total</span>
                    <span className="font-bold text-gray-900">${lineAmount.toFixed(2)}</span>
                  </div>
                </>
              )}
              {cleanDesc && (
                <p className="text-xs text-gray-500 italic mt-1">{cleanDesc}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Select Invoice *</label>
            {eligibleInvoices.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No open invoices found for this client. Create an invoice first in Invoice Management.
              </p>
            ) : (
              <select
                value={selectedInvoiceId}
                onChange={e => setSelectedInvoiceId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#355E3B' } as React.CSSProperties}
              >
                <option value="">— Select invoice —</option>
                {eligibleInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} · {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)} · ${inv.amount.toFixed(2)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || eligibleInvoices.length === 0}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: '#355E3B' }}
            >
              {submitting ? 'Adding…' : 'Add to Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Live Timer Widget ────────────────────────────────────────────────────────

function LiveTimerWidget({ onTimerStop }: { onTimerStop: (hours: number) => void }) {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const start = () => {
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsed(accumulatedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    setRunning(true);
    setPaused(false);
  };

  const pause = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    accumulatedRef.current += Math.floor((Date.now() - startTimeRef.current) / 1000);
    setPaused(true);
    setRunning(false);
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const totalSecs = paused ? accumulatedRef.current : accumulatedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000);
    const hours = parseFloat((totalSecs / 3600).toFixed(2));
    onTimerStop(hours);
    setElapsed(0);
    accumulatedRef.current = 0;
    setRunning(false);
    setPaused(false);
  };

  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setElapsed(0);
    accumulatedRef.current = 0;
    setRunning(false);
    setPaused(false);
  };

  const fmt = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const pct = Math.min((elapsed % 3600) / 3600 * 100, 100);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${running ? 'bg-emerald-500 animate-pulse' : paused ? 'bg-amber-400' : 'bg-gray-300'}`} />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Live Timer</p>
        </div>
        {elapsed > 0 && (
          <span className="text-xs text-muted-foreground">
            {paused ? '⏸ Paused' : running ? '● Recording' : ''}
          </span>
        )}
      </div>

      <div className="flex items-center gap-6">
        {/* Clock display */}
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="4" className="text-border" />
            <circle
              cx="40" cy="40" r="34" fill="none"
              stroke={running ? '#355E3B' : paused ? '#d97706' : '#d1d5db'}
              strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-mono font-bold text-foreground">{fmt(elapsed)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1">
          <p className="text-2xl font-mono font-bold text-foreground mb-3">{fmt(elapsed)}</p>
          <div className="flex flex-wrap gap-2">
            {!running && !paused && (
              <button
                onClick={start}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all"
                style={{ background: '#355E3B' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Start Timer
              </button>
            )}
            {running && (
              <button
                onClick={pause}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                Pause
              </button>
            )}
            {paused && (
              <button
                onClick={start}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Resume
              </button>
            )}
            {(running || paused) && elapsed > 0 && (
              <button
                onClick={stop}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
                Stop & Log
              </button>
            )}
            {elapsed > 0 && !running && (
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-border text-muted-foreground hover:text-foreground transition-all"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-.18-4.36" /></svg>
                Reset
              </button>
            )}
          </div>
          {elapsed > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              ≈ <strong>{(elapsed / 3600).toFixed(2)} hrs</strong> — Stop timer to auto-fill the hours field below
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BillableHoursLogger() {
  const [subscriptions, setSubscriptions] = useState<RetainerSubscription[]>([]);
  const [cases, setCases] = useState<CaseInquiry[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterSub, setFilterSub] = useState<string>('all');
  const [filterEngagement, setFilterEngagement] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBilled, setFilterBilled] = useState<'all' | 'billed' | 'unbilled'>('all');
  const [activeTab, setActiveTab] = useState<'log' | 'summary' | 'engagements'>('log');
  const [addToInvoiceLog, setAddToInvoiceLog] = useState<TimeLog | null>(null);
  const [timerHours, setTimerHours] = useState<number | null>(null);
  const [showLogForm, setShowLogForm] = useState(false);

  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState<string>(firstOfMonth);
  const [dateTo, setDateTo] = useState<string>(today);

  const [form, setForm] = useState<LogForm>({
    retainer_subscription_id: '',
    inquiry_id: '',
    engagement_id: '',
    hours: '',
    work_type: 'research',
    case_task: '',
    description: '',
    work_date: today,
    hourly_rate: '',
  });

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const [subsResult, casesResult, engagementsResult, timeLogsResult, invoicesResult] = await Promise.all([
        supabase
          .from('retainer_subscriptions')
          .select('id, customer_name, customer_email, plan_name, amount, status, current_period_start, current_period_end, inquiry_id, metadata')
          .eq('status', 'active')
          .order('customer_name'),
        supabase
          .from('contact_inquiries')
          .select('id, name, email, service, status, booking_stage')
          .not('status', 'eq', 'closed')
          .order('name'),
        supabase
          .from('engagements')
          .select('id, inquiry_id, title, matter_number, engagement_type, retainer_tier, status, hourly_rate, flat_fee, retainer_amount, start_date, end_date')
          .eq('status', 'active')
          .order('title'),
        supabase
          .from('retainer_time_logs')
          .select('*, retainer_subscriptions(customer_name, plan_name)')
          .order('work_date', { ascending: false })
          .order('logged_at', { ascending: false })
          .limit(500),
        supabase
          .from('client_invoices')
          .select('id, invoice_number, status, amount, inquiry_id, line_items')
          .in('status', ['pending', 'sent', 'overdue'])
          .order('created_at', { ascending: false }),
      ]);

      if (subsResult.error) throw new Error(subsResult.error.message);
      if (timeLogsResult.error) throw new Error(timeLogsResult.error.message);

      setSubscriptions(subsResult.data ?? []);
      setCases((casesResult.data ?? []) as CaseInquiry[]);
      setEngagements((engagementsResult.data ?? []) as Engagement[]);
      setLogs(timeLogsResult.data ?? []);
      setInvoices(invoicesResult.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Engagements filtered by selected case ───────────────────────────────────

  const filteredEngagements = useMemo(() => {
    if (!form.inquiry_id) return engagements;
    return engagements.filter(e => e.inquiry_id === form.inquiry_id);
  }, [engagements, form.inquiry_id]);

  // ── Auto-fill hourly rate from engagement ──────────────────────────────────

  useEffect(() => {
    if (!form.engagement_id) return;
    const eng = engagements.find(e => e.id === form.engagement_id);
    if (eng?.hourly_rate && !form.hourly_rate) {
      setForm(p => ({ ...p, hourly_rate: String(eng.hourly_rate) }));
    }
    // Auto-fill retainer subscription from case
    if (eng?.inquiry_id && !form.retainer_subscription_id) {
      const sub = subscriptions.find(s => s.inquiry_id === eng.inquiry_id);
      if (sub) setForm(p => ({ ...p, retainer_subscription_id: sub.id }));
    }
  }, [form.engagement_id, engagements, subscriptions, form.hourly_rate, form.retainer_subscription_id]);

  // ── Auto-fill inquiry_id from subscription ─────────────────────────────────

  useEffect(() => {
    if (!form.retainer_subscription_id || form.inquiry_id) return;
    const sub = subscriptions.find(s => s.id === form.retainer_subscription_id);
    if (sub?.inquiry_id) {
      setForm(p => ({ ...p, inquiry_id: sub.inquiry_id! }));
    }
  }, [form.retainer_subscription_id, subscriptions, form.inquiry_id]);

  // ── Computed hours per subscription (current period) ────────────────────────

  const hoursPerSub = useCallback((subId: string): number => {
    const sub = subscriptions.find(s => s.id === subId);
    if (!sub) return 0;
    const periodStart = sub.current_period_start ? new Date(sub.current_period_start) : null;
    return logs
      .filter(l => {
        if (l.retainer_subscription_id !== subId) return false;
        if (periodStart) {
          const wd = new Date(l.work_date);
          return wd >= periodStart;
        }
        return true;
      })
      .reduce((sum, l) => sum + Number(l.hours), 0);
  }, [logs, subscriptions]);

  // ── Computed hours per engagement ──────────────────────────────────────────

  const hoursPerEngagement = useCallback((engId: string): number => {
    return logs
      .filter(l => l.engagement_id === engId)
      .reduce((sum, l) => sum + Number(l.hours), 0);
  }, [logs]);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.retainer_subscription_id) { setError('Please select a retainer / case.'); return; }
    if (!form.hours || isNaN(Number(form.hours)) || Number(form.hours) <= 0) {
      setError('Please enter a valid number of hours.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id ?? null;

      const sub = subscriptions.find(s => s.id === form.retainer_subscription_id);
      const engagement = engagements.find(e => e.id === form.engagement_id);

      const descriptionWithType = form.description
        ? `[${workTypeMeta(form.work_type).label}] ${form.description}`
        : `[${workTypeMeta(form.work_type).label}]`;

      const { error: insertErr } = await supabase.from('retainer_time_logs').insert({
        retainer_subscription_id: form.retainer_subscription_id,
        inquiry_id: form.inquiry_id || sub?.inquiry_id || null,
        engagement_id: form.engagement_id || null,
        user_id: userId,
        hours: Number(form.hours),
        description: descriptionWithType,
        work_date: form.work_date,
        logged_by: 'Maggi May Broussard',
        case_task: form.case_task || null,
        work_type: form.work_type || null,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      });

      if (insertErr) throw new Error(insertErr.message);

      const engLabel = engagement ? ` — ${engagement.title}` : '';
      setSuccessMsg(`✓ ${form.hours} hr(s) logged for ${sub?.customer_name ?? 'client'}${form.case_task ? ` — ${form.case_task}` : ''}${engLabel}.`);
      setForm(prev => ({ ...prev, hours: '', description: '', work_date: today, case_task: '' }));
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log hours.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (logId: string) => {
    setDeletingId(logId);
    try {
      const supabase = createClient();
      const { error: delErr } = await supabase.from('retainer_time_logs').delete().eq('id', logId);
      if (delErr) throw new Error(delErr.message);
      setLogs(prev => prev.filter(l => l.id !== logId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleInvoiceAddSuccess = (logId: string, invoiceId: string) => {
    setLogs(prev => prev.map(l => l.id === logId ? { ...l, invoice_id: invoiceId, billed_at: new Date().toISOString() } : l));
    setAddToInvoiceLog(null);
    setSuccessMsg('✓ Time entry added to invoice as a line item.');
  };

  const handleTimerStop = useCallback((hours: number) => {
    setTimerHours(hours);
    setForm(prev => ({ ...prev, hours: String(hours) }));
    setActiveTab('log');
    setSuccessMsg(`⏱ Timer stopped — ${hours} hrs auto-filled. Complete the form below to log.`);
  }, []);

  // ── Filtered logs ──────────────────────────────────────────────────────────

  const filteredLogs = useMemo(() => logs.filter(l => {
    const matchSub = filterSub === 'all' || l.retainer_subscription_id === filterSub;
    const matchEng = filterEngagement === 'all' || l.engagement_id === filterEngagement;
    const wt = l.description?.match(/^\[([^\]]+)\]/)?.[1];
    const matchType = filterType === 'all' || (wt && wt.toLowerCase().includes(filterType.toLowerCase()));
    const matchFrom = !dateFrom || l.work_date >= dateFrom;
    const matchTo = !dateTo || l.work_date <= dateTo;
    const matchBilled = filterBilled === 'all' || (filterBilled === 'billed' ? !!l.billed_at : !l.billed_at);
    return matchSub && matchEng && matchType && matchFrom && matchTo && matchBilled;
  }), [logs, filterSub, filterEngagement, filterType, dateFrom, dateTo, filterBilled]);

  const totalFilteredHours = filteredLogs.reduce((s, l) => s + Number(l.hours), 0);
  const unbilledCount = logs.filter(l => !l.billed_at).length;

  const applyPreset = (preset: 'this_month' | 'last_month' | 'last_30' | 'all') => {
    const n = new Date();
    if (preset === 'this_month') {
      setDateFrom(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`);
      setDateTo(n.toISOString().split('T')[0]);
    } else if (preset === 'last_month') {
      const lm = new Date(n.getFullYear(), n.getMonth() - 1, 1);
      const lmEnd = new Date(n.getFullYear(), n.getMonth(), 0);
      setDateFrom(lm.toISOString().split('T')[0]);
      setDateTo(lmEnd.toISOString().split('T')[0]);
    } else if (preset === 'last_30') {
      const d30 = new Date(n);
      d30.setDate(d30.getDate() - 30);
      setDateFrom(d30.toISOString().split('T')[0]);
      setDateTo(n.toISOString().split('T')[0]);
    } else {
      setDateFrom('');
      setDateTo('');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#355E3B' }} />
        <span className="ml-3 text-sm text-gray-500">Loading billable hours data…</span>
      </div>
    );
  }

  // Selected engagement for depletion preview
  const selectedEngagement = form.engagement_id ? engagements.find(e => e.id === form.engagement_id) : null;
  const selectedSub = form.retainer_subscription_id ? subscriptions.find(s => s.id === form.retainer_subscription_id) : null;

  return (
    <div className="space-y-4 md:space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Billable Hours Logger</h2>
          <p className="text-sm text-gray-500 mt-0.5 hidden sm:block">Log work against cases and engagements — track retainer allowance consumption</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {unbilledCount > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              {unbilledCount} unbilled {unbilledCount === 1 ? 'entry' : 'entries'}
            </span>
          )}
          {/* Mobile: Log Hours toggle button */}
          <button
            onClick={() => setShowLogForm(v => !v)}
            className="xl:hidden inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white font-semibold transition-all"
            style={{ background: '#355E3B' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {showLogForm ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>}
            </svg>
            {showLogForm ? 'Close Form' : 'Log Hours'}
          </button>
          <button
            onClick={() => exportToCSV(filteredLogs, engagements, cases, dateFrom, dateTo)}
            disabled={filteredLogs.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button
            onClick={fetchData}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <span className="mt-0.5">⚠</span>
          <span>{error}</span>
          <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError(null)}>✕</button>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
          <span>{successMsg}</span>
          <button className="ml-auto text-emerald-400 hover:text-emerald-600" onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}

      {/* ── Date Range Filter Bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-semibold text-gray-600">Date Range</span>
            <div className="flex items-center gap-2 flex-wrap ml-auto sm:ml-0">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 w-full sm:w-auto"
                style={{ '--tw-ring-color': '#355E3B' } as React.CSSProperties}
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 w-full sm:w-auto"
                style={{ '--tw-ring-color': '#355E3B' } as React.CSSProperties}
              />
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { label: 'This Month', preset: 'this_month' as const },
              { label: 'Last Month', preset: 'last_month' as const },
              { label: 'Last 30', preset: 'last_30' as const },
              { label: 'All Time', preset: 'all' as const },
            ].map(({ label, preset }) => (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors whitespace-nowrap"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {(dateFrom || dateTo) && (
          <p className="text-xs text-gray-400 mt-2">
            Showing <span className="font-medium text-gray-600">{filteredLogs.length}</span> entries ·{' '}
            <span className="font-medium text-gray-600">{totalFilteredHours.toFixed(2)} hrs</span> in range
          </p>
        )}
      </div>

      {/* ── Mobile: Collapsible Log Form ── */}
      {showLogForm && (
        <div className="xl:hidden bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs" style={{ background: '#355E3B' }}>+</span>
            Log Hours
          </h3>
          <LiveTimerWidget onTimerStop={handleTimerStop} />
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Case *</label>
              <select
                value={form.inquiry_id}
                onChange={e => setForm(p => ({
                  ...p,
                  inquiry_id: e.target.value,
                  engagement_id: '',
                  retainer_subscription_id: subscriptions.find(s => s.inquiry_id === e.target.value)?.id ?? p.retainer_subscription_id,
                }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#355E3B' } as React.CSSProperties}
              >
                <option value="">— Select case —</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.name} · {c.service}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Engagement</label>
              <select
                value={form.engagement_id}
                onChange={e => setForm(p => ({ ...p, engagement_id: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#355E3B' } as React.CSSProperties}
              >
                <option value="">— Select engagement (optional) —</option>
                {filteredEngagements.map(eng => (
                  <option key={eng.id} value={eng.id}>{eng.title}{eng.matter_number ? ` #${eng.matter_number}` : ''}</option>
                ))}
              </select>
            </div>
            {selectedEngagement && (() => {
              const sub = selectedSub ?? subscriptions.find(s => s.inquiry_id === selectedEngagement.inquiry_id);
              const total = getTierHours(selectedEngagement.retainer_tier, selectedEngagement.retainer_amount, Number(sub?.amount ?? 0));
              const used = hoursPerEngagement(selectedEngagement.id);
              return (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-xs font-medium text-gray-600 mb-1.5">Engagement Allowance</p>
                  {total > 0 ? <RetainerBar used={used} total={total} /> : <p className="text-xs text-gray-500">{used.toFixed(1)}h logged (no cap)</p>}
                </div>
              );
            })()}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Retainer Subscription *</label>
              <select
                value={form.retainer_subscription_id}
                onChange={e => setForm(p => ({ ...p, retainer_subscription_id: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#355E3B' } as React.CSSProperties}
                required
              >
                <option value="">— Select retainer —</option>
                {subscriptions.map(s => (
                  <option key={s.id} value={s.id}>{s.customer_name} · {s.plan_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Case Task</label>
              <select
                value={form.case_task}
                onChange={e => setForm(p => ({ ...p, case_task: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': '#355E3B' } as React.CSSProperties}
              >
                <option value="">— Select task (optional) —</option>
                {CASE_TASKS.map(task => <option key={task} value={task}>{task}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Work Type *</label>
              <div className="grid grid-cols-2 gap-1.5">
                {WORK_TYPES.map(wt => (
                  <button
                    key={wt.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, work_type: wt.value }))}
                    className={`text-xs px-2.5 py-2.5 rounded-lg border font-medium transition-all text-left flex items-center gap-1.5 ${
                      form.work_type === wt.value ? `${wt.color} ring-2 ring-offset-1` : 'bg-white border-gray-200 text-gray-600'
                    }`}
                    style={form.work_type === wt.value ? { '--tw-ring-color': '#355E3B' } as React.CSSProperties : {}}
                  >
                    <span>{wt.icon}</span><span>{wt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hours *</label>
                <div className="relative">
                  <input
                    type="number" min="0.1" max="24" step="0.25"
                    value={form.hours}
                    onChange={e => setForm(p => ({ ...p, hours: e.target.value }))}
                    placeholder="e.g. 1.5"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:ring-2"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">hrs</span>
                </div>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {[0.25, 0.5, 1, 1.5, 2, 3].map(h => (
                    <button key={h} type="button" onClick={() => setForm(p => ({ ...p, hours: String(h) }))}
                      className="text-xs px-1.5 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rate ($/hr)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                  <input
                    type="number" min="0" step="5"
                    value={form.hourly_rate}
                    onChange={e => setForm(p => ({ ...p, hourly_rate: e.target.value }))}
                    placeholder="150"
                    className="w-full text-sm border border-gray-200 rounded-lg pl-6 pr-3 py-2.5 focus:outline-none focus:ring-2"
                  />
                </div>
                {form.hours && form.hourly_rate && Number(form.hourly_rate) > 0 && (
                  <p className="text-xs text-emerald-700 mt-1 font-medium">= ${(Number(form.hours) * Number(form.hourly_rate)).toFixed(2)}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Work Date *</label>
              <input
                type="date" value={form.work_date}
                onChange={e => setForm(p => ({ ...p, work_date: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of work performed…"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 resize-none"
              />
            </div>
            <button
              type="submit" disabled={submitting}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: '#355E3B' }}
            >
              {submitting ? 'Logging…' : 'Log Hours'}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">

        {/* ── Log Entry Form (desktop) ── */}
        <div className="hidden xl:block xl:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs" style={{ background: '#355E3B' }}>+</span>
              Log Hours
            </h3>

            {/* Live Timer */}
            <LiveTimerWidget onTimerStop={handleTimerStop} />

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Case selector */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Case *</label>
                <select
                  value={form.inquiry_id}
                  onChange={e => setForm(p => ({
                    ...p,
                    inquiry_id: e.target.value,
                    engagement_id: '',
                    retainer_subscription_id: subscriptions.find(s => s.inquiry_id === e.target.value)?.id ?? p.retainer_subscription_id,
                  }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#355E3B' } as React.CSSProperties}
                >
                  <option value="">— Select case —</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.service}
                    </option>
                  ))}
                </select>
              </div>

              {/* Engagement selector */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Engagement</label>
                <select
                  value={form.engagement_id}
                  onChange={e => setForm(p => ({ ...p, engagement_id: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#355E3B' } as React.CSSProperties}
                >
                  <option value="">— Select engagement (optional) —</option>
                  {filteredEngagements.map(eng => (
                    <option key={eng.id} value={eng.id}>
                      {eng.title}{eng.matter_number ? ` #${eng.matter_number}` : ''}
                    </option>
                  ))}
                </select>
                {form.inquiry_id && filteredEngagements.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No active engagements for this case. Create one in Case Management.</p>
                )}
              </div>

              {/* Engagement depletion preview */}
              {selectedEngagement && (() => {
                const sub = selectedSub ?? subscriptions.find(s => s.inquiry_id === selectedEngagement.inquiry_id);
                const total = getTierHours(selectedEngagement.retainer_tier, selectedEngagement.retainer_amount, Number(sub?.amount ?? 0));
                const used = hoursPerEngagement(selectedEngagement.id);
                return (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-xs font-medium text-gray-600 mb-1.5">
                      Engagement Allowance
                      {selectedEngagement.retainer_tier !== 'none' && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {selectedEngagement.retainer_tier.charAt(0).toUpperCase() + selectedEngagement.retainer_tier.slice(1)}
                        </span>
                      )}
                    </p>
                    {total > 0 ? (
                      <RetainerBar used={used} total={total} />
                    ) : (
                      <p className="text-xs text-gray-500">{used.toFixed(1)}h logged (no retainer cap on this engagement)</p>
                    )}
                  </div>
                );
              })()}

              {/* Retainer subscription (fallback / override) */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Retainer Subscription *</label>
                <select
                  value={form.retainer_subscription_id}
                  onChange={e => setForm(p => ({ ...p, retainer_subscription_id: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#355E3B' } as React.CSSProperties}
                  required
                >
                  <option value="">— Select retainer —</option>
                  {subscriptions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.customer_name} · {s.plan_name}
                    </option>
                  ))}
                </select>
                {subscriptions.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No active retainer subscriptions found.</p>
                )}
              </div>

              {/* Retainer depletion preview (when no engagement selected) */}
              {!selectedEngagement && form.retainer_subscription_id && (() => {
                const sub = subscriptions.find(s => s.id === form.retainer_subscription_id);
                if (!sub) return null;
                const total = getTierHours('none', null, Number(sub.amount));
                const used = hoursPerSub(sub.id);
                return (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-xs font-medium text-gray-600 mb-2">Current Period Usage</p>
                    <RetainerBar used={used} total={total} />
                    {sub.current_period_end && (
                      <p className="text-xs text-gray-400 mt-1.5">Period ends {fmtDate(sub.current_period_end)}</p>
                    )}
                  </div>
                );
              })()}

              {/* Case Task */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Case Task</label>
                <select
                  value={form.case_task}
                  onChange={e => setForm(p => ({ ...p, case_task: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': '#355E3B' } as React.CSSProperties}
                >
                  <option value="">— Select task (optional) —</option>
                  {CASE_TASKS.map(task => (
                    <option key={task} value={task}>{task}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Used as the line item label on invoices</p>
              </div>

              {/* Work Type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Work Type *</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {WORK_TYPES.map(wt => (
                    <button
                      key={wt.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, work_type: wt.value }))}
                      className={`text-xs px-2.5 py-2 rounded-lg border font-medium transition-all text-left flex items-center gap-1.5 ${
                        form.work_type === wt.value
                          ? `${wt.color} ring-2 ring-offset-1`
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                      style={form.work_type === wt.value ? { '--tw-ring-color': '#355E3B' } as React.CSSProperties : {}}
                    >
                      <span>{wt.icon}</span>
                      <span>{wt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hours + Rate row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hours *</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0.1"
                      max="24"
                      step="0.25"
                      value={form.hours}
                      onChange={e => setForm(p => ({ ...p, hours: e.target.value }))}
                      placeholder="e.g. 1.5"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:border-transparent"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">hrs</span>
                  </div>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {[0.25, 0.5, 1, 1.5, 2, 3].map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, hours: String(h) }))}
                        className="text-xs px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hourly Rate</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={form.hourly_rate}
                      onChange={e => setForm(p => ({ ...p, hourly_rate: e.target.value }))}
                      placeholder="e.g. 150"
                      className="w-full text-sm border border-gray-200 rounded-lg pl-6 pr-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent"
                    />
                  </div>
                  {form.hours && form.hourly_rate && Number(form.hourly_rate) > 0 && (
                    <p className="text-xs text-emerald-700 mt-1 font-medium">
                      = ${(Number(form.hours) * Number(form.hourly_rate)).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {/* Work Date */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Work Date *</label>
                <input
                  type="date"
                  value={form.work_date}
                  onChange={e => setForm(p => ({ ...p, work_date: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of work performed…"
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:border-transparent resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: '#355E3B' }}
              >
                {submitting ? 'Logging…' : 'Log Hours'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="xl:col-span-2 space-y-4 md:space-y-5">

          {/* Retainer Depletion Cards */}
          {subscriptions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Retainer Depletion — Current Period</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {subscriptions.map(sub => {
                  const total = getTierHours('none', null, Number(sub.amount));
                  const used = hoursPerSub(sub.id);
                  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
                  const subEngagements = engagements.filter(e => e.inquiry_id === sub.inquiry_id);
                  return (
                    <div key={sub.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-sm text-gray-800">{sub.customer_name}</p>
                          <p className="text-xs text-gray-500">{sub.plan_name}</p>
                          {subEngagements.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">{subEngagements.length} engagement{subEngagements.length !== 1 ? 's' : ''}</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                          pct >= 90 ? 'bg-red-50 text-red-700 border-red-200' :
                          pct >= 75 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {pct >= 90 ? 'Critical' : pct >= 75 ? 'Warning' : 'Healthy'}
                        </span>
                      </div>
                      <RetainerBar used={used} total={total} />
                      <div className="flex justify-between mt-2 text-xs text-gray-400">
                        <span className="truncate mr-2">{sub.customer_email}</span>
                        {sub.current_period_end && <span className="shrink-0">Ends {fmtDate(sub.current_period_end)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Tabs ── */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

            {/* Tab Bar */}
            <div className="border-b border-gray-100 flex overflow-x-auto no-scrollbar">
              {([
                { id: 'log', label: 'Time Log' },
                { id: 'engagements', label: 'By Engagement' },
                { id: 'summary', label: 'Summary' },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 sm:flex-none px-4 py-3 text-xs font-semibold transition-colors border-b-2 whitespace-nowrap ${
                    activeTab === tab.id ? 'border-current text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                  style={activeTab === tab.id ? { borderColor: '#355E3B', color: '#355E3B' } : {}}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Log History Tab ── */}
            {activeTab === 'log' && (
              <>
                <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2">
                  <p className="text-xs text-gray-500">
                    {filteredLogs.length} entries · {totalFilteredHours.toFixed(2)} hrs total
                  </p>
                  <div className="sm:ml-auto flex gap-2 flex-wrap">
                    <select
                      value={filterBilled}
                      onChange={e => setFilterBilled(e.target.value as 'all' | 'billed' | 'unbilled')}
                      className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none"
                    >
                      <option value="all">All Entries</option>
                      <option value="unbilled">Unbilled Only</option>
                      <option value="billed">Billed Only</option>
                    </select>
                    <select
                      value={filterSub}
                      onChange={e => setFilterSub(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none"
                    >
                      <option value="all">All Clients</option>
                      {subscriptions.map(s => (
                        <option key={s.id} value={s.id}>{s.customer_name}</option>
                      ))}
                    </select>
                    <select
                      value={filterEngagement}
                      onChange={e => setFilterEngagement(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none hidden sm:block"
                    >
                      <option value="all">All Engagements</option>
                      {engagements.map(eng => (
                        <option key={eng.id} value={eng.id}>{eng.title}</option>
                      ))}
                    </select>
                    <select
                      value={filterType}
                      onChange={e => setFilterType(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none hidden sm:block"
                    >
                      <option value="all">All Work Types</option>
                      {WORK_TYPES.map(wt => (
                        <option key={wt.value} value={wt.label}>{wt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {filteredLogs.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400">
                    <p className="text-2xl mb-2">🕐</p>
                    <p>No time entries found.</p>
                    <p className="text-xs mt-1">Adjust filters or log your first billable hours.</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile card list */}
                    <div className="md:hidden divide-y divide-gray-50">
                      {filteredLogs.map(log => (
                        <MobileLogCard
                          key={log.id}
                          log={log}
                          engagements={engagements}
                          deletingId={deletingId}
                          onDelete={handleDelete}
                          onAddToInvoice={setAddToInvoiceLog}
                        />
                      ))}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">Date</th>
                            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">Client</th>
                            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap hidden lg:table-cell">Engagement</th>
                            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">Task / Type</th>
                            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden xl:table-cell">Description</th>
                            <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">Hours</th>
                            <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">Invoice</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredLogs.map(log => {
                            const rawDesc = log.description ?? '';
                            const typeMatch = rawDesc.match(/^\[([^\]]+)\]/);
                            const workTypeLabel = typeMatch?.[1] ?? null;
                            const cleanDesc = typeMatch ? rawDesc.replace(typeMatch[0], '').trim() : rawDesc;
                            const wtMeta = WORK_TYPES.find(w => w.label === workTypeLabel) ?? WORK_TYPES[WORK_TYPES.length - 1];
                            const isBilled = !!log.billed_at;
                            const engagementRecord = log.engagement_id ? engagements.find(e => e.id === log.engagement_id) : null;

                            return (
                              <tr key={log.id} className={`hover:bg-gray-50 transition-colors ${isBilled ? 'opacity-70' : ''}`}>
                                <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                                  {fmtDate(log.work_date)}
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-xs font-medium text-gray-800 whitespace-nowrap">
                                    {(log.retainer_subscriptions as { customer_name: string; plan_name: string } | null)?.customer_name ?? '—'}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {(log.retainer_subscriptions as { customer_name: string; plan_name: string } | null)?.plan_name ?? ''}
                                  </p>
                                </td>
                                <td className="px-4 py-3 hidden lg:table-cell">
                                  {engagementRecord ? (
                                    <div>
                                      <p className="text-xs font-medium text-gray-700 truncate max-w-[120px]">{engagementRecord.title}</p>
                                      {engagementRecord.matter_number && (
                                        <p className="text-xs text-gray-400 font-mono">#{engagementRecord.matter_number}</p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-300 italic">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {log.case_task && (
                                    <p className="text-xs font-semibold text-gray-700 mb-1">{log.case_task}</p>
                                  )}
                                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${wtMeta.color}`}>
                                    {wtMeta.icon} {wtMeta.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-600 max-w-xs hidden xl:table-cell">
                                  <span className="line-clamp-2">{cleanDesc || <span className="text-gray-300 italic">No description</span>}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-sm font-semibold text-gray-800">{Number(log.hours).toFixed(2)}</span>
                                  <span className="text-xs text-gray-400 ml-0.5">h</span>
                                  {log.hourly_rate && Number(log.hourly_rate) > 0 && (
                                    <p className="text-xs text-gray-400">${(Number(log.hours) * Number(log.hourly_rate)).toFixed(0)}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {isBilled ? (
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium whitespace-nowrap">
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                      Billed
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => setAddToInvoiceLog(log)}
                                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium transition-colors hover:bg-amber-50 whitespace-nowrap"
                                      style={{ borderColor: '#C8965A', color: '#C8965A' }}
                                      title="Add to invoice"
                                    >
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                      </svg>
                                      Invoice
                                    </button>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => handleDelete(log.id)}
                                    disabled={deletingId === log.id}
                                    className="text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                                    title="Delete entry"
                                  >
                                    {deletingId === log.id ? '…' : '✕'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── By Engagement Tab ── */}
            {activeTab === 'engagements' && (
              <>
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs text-gray-500">
                    Hours consumed per engagement against retainer allowance — visible to clients in their portal
                  </p>
                </div>
                <EngagementConsumptionSection
                  logs={logs}
                  engagements={engagements}
                  cases={cases}
                  subscriptions={subscriptions}
                />
              </>
            )}

            {/* ── Client Summary Tab ── */}
            {activeTab === 'summary' && (
              <>
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Billable hours by client for reconciliation
                    {(dateFrom || dateTo) && (
                      <span className="ml-1 font-medium text-gray-700 hidden sm:inline">
                        · {dateFrom ? fmtDate(dateFrom) : '—'} to {dateTo ? fmtDate(dateTo) : '—'}
                      </span>
                    )}
                  </p>
                  <button
                    onClick={() => exportToCSV(filteredLogs, engagements, cases, dateFrom, dateTo)}
                    disabled={filteredLogs.length === 0}
                    className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1 disabled:opacity-40 shrink-0"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </button>
                </div>
                <ClientSummarySection logs={filteredLogs} subscriptions={subscriptions} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Add to Invoice Modal ── */}
      {addToInvoiceLog && (
        <AddToInvoiceModal
          log={addToInvoiceLog}
          invoices={invoices}
          onClose={() => setAddToInvoiceLog(null)}
          onSuccess={handleInvoiceAddSuccess}
        />
      )}
    </div>
  );
}
