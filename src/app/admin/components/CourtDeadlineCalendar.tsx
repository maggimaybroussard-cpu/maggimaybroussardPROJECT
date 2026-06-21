'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface DeadlineEvent {
  id: string;
  title: string;
  date: string;
  type: 'deadline' | 'sol' | 'hearing' | 'filing' | 'other';
  matterName: string;
  clientEmail?: string;
  notes?: string;
  inquiryId?: string;
  daysUntil: number;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  deadline: { label: 'Deadline', color: 'text-red-700', dot: 'bg-red-500', bg: 'bg-red-50 border-red-200' },
  sol: { label: 'SOL', color: 'text-orange-700', dot: 'bg-orange-500', bg: 'bg-orange-50 border-orange-200' },
  hearing: { label: 'Hearing', color: 'text-blue-700', dot: 'bg-blue-500', bg: 'bg-blue-50 border-blue-200' },
  filing: { label: 'Filing', color: 'text-purple-700', dot: 'bg-purple-500', bg: 'bg-purple-50 border-purple-200' },
  other: { label: 'Other', color: 'text-gray-700', dot: 'bg-gray-400', bg: 'bg-gray-50 border-gray-200' },
};

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function exportToCSV(rows: Record<string, unknown>[], filename: string) {
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
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToPDF(events: DeadlineEvent[]) {
  const overdue = events.filter(e => e.daysUntil < 0);
  const upcoming = events.filter(e => e.daysUntil >= 0 && e.daysUntil <= 30);
  const future = events.filter(e => e.daysUntil > 30);

  const renderRows = (items: DeadlineEvent[]) => items.map(e => `
    <tr>
      <td>${e.title}</td>
      <td>${e.matterName}</td>
      <td>${TYPE_CONFIG[e.type]?.label || e.type}</td>
      <td>${fmtDate(e.date)}</td>
      <td style="color:${e.daysUntil < 0 ? '#b91c1c' : e.daysUntil <= 7 ? '#92400e' : '#065f46'}">
        ${e.daysUntil < 0 ? `${Math.abs(e.daysUntil)}d overdue` : e.daysUntil === 0 ? 'Today' : `in ${e.daysUntil}d`}
      </td>
      <td>${e.notes || '—'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Court Deadline Calendar</title>
  <style>
    body { font-family: Georgia, serif; color: #1a1a1a; padding: 32px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    p.sub { color: #666; font-size: 13px; margin-bottom: 24px; }
    h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    .kpis { display: flex; gap: 16px; margin-bottom: 24px; }
    .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 12px 16px; flex: 1; }
    .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
    .kpi-value { font-size: 20px; font-weight: 600; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
    th { background: #f5f5f5; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; border-bottom: 2px solid #ddd; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 24px; font-size: 11px; color: #999; }
  </style></head><body>
  <h1>Court Deadline Calendar</h1>
  <p class="sub">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">Total Deadlines</div><div class="kpi-value">${events.length}</div></div>
    <div class="kpi" style="border-color:#fca5a5;"><div class="kpi-label">Overdue</div><div class="kpi-value" style="color:#b91c1c;">${overdue.length}</div></div>
    <div class="kpi" style="border-color:#fcd34d;"><div class="kpi-label">Due in 30 Days</div><div class="kpi-value" style="color:#92400e;">${upcoming.length}</div></div>
    <div class="kpi" style="border-color:#6ee7b7;"><div class="kpi-label">Future</div><div class="kpi-value" style="color:#065f46;">${future.length}</div></div>
  </div>
  ${overdue.length > 0 ? `<h2 style="color:#b91c1c;">⚠ Overdue (${overdue.length})</h2>
  <table><thead><tr><th>Title</th><th>Matter</th><th>Type</th><th>Date</th><th>Status</th><th>Notes</th></tr></thead><tbody>${renderRows(overdue)}</tbody></table>` : ''}
  ${upcoming.length > 0 ? `<h2 style="color:#92400e;">📅 Due in 30 Days (${upcoming.length})</h2>
  <table><thead><tr><th>Title</th><th>Matter</th><th>Type</th><th>Date</th><th>Status</th><th>Notes</th></tr></thead><tbody>${renderRows(upcoming)}</tbody></table>` : ''}
  ${future.length > 0 ? `<h2>Future Deadlines (${future.length})</h2>
  <table><thead><tr><th>Title</th><th>Matter</th><th>Type</th><th>Date</th><th>Status</th><th>Notes</th></tr></thead><tbody>${renderRows(future)}</tbody></table>` : ''}
  <div class="footer">Broussard Legal Services</div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMonthYear(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CourtDeadlineCalendar() {
  const [events, setEvents] = useState<DeadlineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', type: 'deadline', matterName: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [today] = useState(new Date());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from('court_deadlines').select('*').order('deadline_date', { ascending: true });

      if (err) throw err;

      const mapped: DeadlineEvent[] = (data || []).map((row: {
        id: string;
        title: string;
        deadline_date: string;
        deadline_type: string;
        matter_name: string;
        client_email?: string;
        notes?: string;
        inquiry_id?: string;
      }) => ({
        id: row.id,
        title: row.title,
        date: row.deadline_date,
        type: row.deadline_type as DeadlineEvent['type'],
        matterName: row.matter_name,
        clientEmail: row.client_email,
        notes: row.notes,
        inquiryId: row.inquiry_id,
        daysUntil: getDaysUntil(row.deadline_date),
      }));

      setEvents(mapped);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load deadlines');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.matterName) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.from('court_deadlines').insert({
        title: newEvent.title,
        deadline_date: newEvent.date,
        deadline_type: newEvent.type,
        matter_name: newEvent.matterName,
        notes: newEvent.notes || null,
      });
      if (err) throw err;
      setShowAddModal(false);
      setNewEvent({ title: '', date: '', type: 'deadline', matterName: '', notes: '' });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this deadline?')) return;
    const supabase = createClient();
    await supabase.from('court_deadlines').delete().eq('id', id);
    fetchData();
  };

  const filtered = events.filter(e => typeFilter === 'all' || e.type === typeFilter);

  // Calendar grid
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const calendarDays: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const eventsForDay = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filtered.filter(e => e.date.startsWith(dateStr));
  };

  const upcoming = filtered.filter(e => e.daysUntil >= 0 && e.daysUntil <= 30).sort((a, b) => a.daysUntil - b.daysUntil);
  const overdue = filtered.filter(e => e.daysUntil < 0).sort((a, b) => b.daysUntil - a.daysUntil);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Court Deadline Calendar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">All matter deadlines, SOL dates, and hearing dates</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl border border-border overflow-hidden">
            {(['calendar', 'list'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} className={`px-3 py-2 text-xs font-semibold capitalize transition-all ${viewMode === v ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}>{v}</button>
            ))}
          </div>
          <button
            onClick={() => exportToCSV(filtered.map(e => ({
              'Title': e.title,
              'Matter': e.matterName,
              'Type': TYPE_CONFIG[e.type]?.label || e.type,
              'Date': e.date,
              'Days Until': e.daysUntil,
              'Status': e.daysUntil < 0 ? 'Overdue' : e.daysUntil === 0 ? 'Today' : 'Upcoming',
              'Client Email': e.clientEmail || '',
              'Notes': e.notes || '',
            })), `court-deadlines-${new Date().toISOString().split('T')[0]}.csv`)}
            disabled={filtered.length === 0}
            className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
          <button
            onClick={() => exportToPDF(filtered)}
            disabled={filtered.length === 0}
            className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            PDF
          </button>
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90 flex items-center gap-2" style={{ background: '#355E3B', color: '#fff' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Deadline
          </button>
        </div>
      </div>

      {/* Alerts */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-2">⚠️ {overdue.length} Overdue Deadline{overdue.length !== 1 ? 's' : ''}</p>
          <div className="flex flex-wrap gap-2">
            {overdue.slice(0, 3).map(e => (
              <span key={e.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">{e.title} ({Math.abs(e.daysUntil)}d ago)</span>
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-700 mb-2">📅 {upcoming.length} Upcoming in 30 Days</p>
          <div className="flex flex-wrap gap-2">
            {upcoming.slice(0, 4).map(e => (
              <span key={e.id} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{e.title} (in {e.daysUntil}d)</span>
            ))}
          </div>
        </div>
      )}

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        {['all', 'deadline', 'sol', 'hearing', 'filing', 'other'].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${typeFilter === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
            {t === 'all' ? 'All Types' : TYPE_CONFIG[t]?.label || t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      ) : viewMode === 'calendar' ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }} className="p-2 rounded-lg hover:bg-secondary transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h3 className="font-serif text-lg text-foreground">{fmtMonthYear(calYear, calMonth)}</h3>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }} className="p-2 rounded-lg hover:bg-secondary transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="border-b border-r border-border min-h-[80px] bg-secondary/10" />;
              const dayEvents = eventsForDay(day);
              const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
              const isSelected = selectedDay === day;
              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`border-b border-r border-border min-h-[80px] p-1.5 cursor-pointer transition-all ${isSelected ? 'bg-primary/5' : 'hover:bg-secondary/30'}`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>{day}</div>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className={`text-[9px] px-1 py-0.5 rounded truncate font-medium ${TYPE_CONFIG[e.type]?.bg || 'bg-gray-50 border-gray-200'} border`}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <div className="text-[9px] text-muted-foreground px-1">+{dayEvents.length - 2} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Selected day detail */}
          {selectedDay && eventsForDay(selectedDay).length > 0 && (
            <div className="border-t border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{fmtDate(`${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`)}</p>
              <div className="flex flex-col gap-2">
                {eventsForDay(selectedDay).map(e => (
                  <div key={e.id} className={`flex items-start justify-between gap-3 p-3 rounded-xl border ${TYPE_CONFIG[e.type]?.bg}`}>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{e.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{e.matterName} · <span className={`font-medium ${TYPE_CONFIG[e.type]?.color}`}>{TYPE_CONFIG[e.type]?.label}</span></p>
                      {e.notes && <p className="text-xs text-muted-foreground mt-1">{e.notes}</p>}
                    </div>
                    <button onClick={() => handleDelete(e.id)} className="text-muted-foreground/40 hover:text-red-500 transition-colors shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">No deadlines found. Add your first deadline above.</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(e => (
                <div key={e.id} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-secondary/20 transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${TYPE_CONFIG[e.type]?.dot}`} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{e.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{e.matterName} · {fmtDate(e.date)}</p>
                      {e.notes && <p className="text-xs text-muted-foreground/70 mt-0.5">{e.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${TYPE_CONFIG[e.type]?.bg} ${TYPE_CONFIG[e.type]?.color}`}>{TYPE_CONFIG[e.type]?.label}</span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${e.daysUntil < 0 ? 'bg-red-100 text-red-700' : e.daysUntil <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {e.daysUntil < 0 ? `${Math.abs(e.daysUntil)}d overdue` : e.daysUntil === 0 ? 'Today' : `${e.daysUntil}d`}
                    </span>
                    <button onClick={() => handleDelete(e.id)} className="text-muted-foreground/40 hover:text-red-500 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif text-xl text-foreground">Add Deadline</h3>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Title *</label>
                <input value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Motion to Dismiss Deadline" className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Date *</label>
                <input type="date" value={newEvent.date} onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Type *</label>
                <select value={newEvent.type} onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="deadline">Deadline</option>
                  <option value="sol">Statute of Limitations</option>
                  <option value="hearing">Hearing</option>
                  <option value="filing">Filing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Matter / Client Name *</label>
                <input value={newEvent.matterName} onChange={e => setNewEvent(p => ({ ...p, matterName: e.target.value }))} placeholder="e.g. Smith v. Jones" className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Notes</label>
                <textarea value={newEvent.notes} onChange={e => setNewEvent(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Optional notes…" className="w-full px-3 py-2.5 rounded-xl border border-border bg-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-all">Cancel</button>
              <button onClick={handleAdd} disabled={saving || !newEvent.title || !newEvent.date || !newEvent.matterName} className="flex-1 py-2.5 rounded-xl text-sm font-semibold uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-50" style={{ background: '#355E3B', color: '#fff' }}>
                {saving ? 'Saving…' : 'Add Deadline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
