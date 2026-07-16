'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AvailabilitySlot {
  id: string;
  booking_date: string;
  booking_time: string;
  duration_mins: number;
  is_blocked: boolean;
  booking_id: string | null;
  created_at: string;
}

interface WeeklyHour {
  day: number;
  startTime: string;
  endTime: string;
  duration: number;
  enabled: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEFAULT_WEEKLY_HOURS: WeeklyHour[] = [
  { day: 1, startTime: '09:00', endTime: '17:00', duration: 60, enabled: true },
  { day: 2, startTime: '09:00', endTime: '17:00', duration: 60, enabled: true },
  { day: 3, startTime: '09:00', endTime: '17:00', duration: 60, enabled: true },
  { day: 4, startTime: '09:00', endTime: '17:00', duration: 60, enabled: true },
  { day: 5, startTime: '09:00', endTime: '17:00', duration: 60, enabled: false },
  { day: 6, startTime: '10:00', endTime: '14:00', duration: 60, enabled: false },
  { day: 0, startTime: '10:00', endTime: '14:00', duration: 60, enabled: false },
];

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getWeekDates(offset = 0): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function ConsultationAvailabilityManager() {
  const supabase = createClient();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>(DEFAULT_WEEKLY_HOURS);
  const [activeTab, setActiveTab] = useState<'calendar' | 'weekly_hours' | 'block_date'>('calendar');
  const [blockDate, setBlockDate] = useState('');
  const [blockTime, setBlockTime] = useState('09:00');
  const [blockDuration, setBlockDuration] = useState(60);
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [blockMsg, setBlockMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [generatingSlots, setGeneratingSlots] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingHours, setSavingHours] = useState(false);
  const [saveHoursMsg, setSaveHoursMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setWeekDates(getWeekDates(weekOffset));
  }, [weekOffset]);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const dates = getWeekDates(weekOffset);
    const from = toDateStr(dates[0]);
    const to = toDateStr(dates[6]);
    const { data } = await supabase
      .from('consultation_availability_slots')
      .select('*')
      .gte('booking_date', from)
      .lte('booking_date', to)
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true });
    setSlots((data ?? []) as AvailabilitySlot[]);
    setLoading(false);
  }, [supabase, weekOffset]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin_weekly_hours');
      if (saved) setWeeklyHours(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleBlock = async (slot: AvailabilitySlot) => {
    const { error } = await supabase
      .from('consultation_availability_slots')
      .update({ is_blocked: !slot.is_blocked })
      .eq('id', slot.id);
    if (!error) {
      setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, is_blocked: !s.is_blocked } : s));
    }
  };

  const deleteSlot = async (slotId: string) => {
    const { error } = await supabase
      .from('consultation_availability_slots')
      .delete()
      .eq('id', slotId);
    if (!error) {
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    }
  };

  const addBlockedSlot = async () => {
    if (!blockDate || !blockTime) return;
    setBlocking(true);
    setBlockMsg(null);
    const { error } = await supabase
      .from('consultation_availability_slots')
      .upsert({
        booking_date: blockDate,
        booking_time: blockTime + ':00',
        duration_mins: blockDuration,
        is_blocked: true,
        booking_id: null,
      }, { onConflict: 'booking_date,booking_time,duration_mins' });
    if (error) {
      setBlockMsg({ type: 'error', text: error.message });
    } else {
      setBlockMsg({ type: 'success', text: `Slot blocked for ${blockDate} at ${formatTime(blockTime)}` });
      setBlockDate('');
      setBlockReason('');
      fetchSlots();
    }
    setBlocking(false);
  };

  const generateWeekSlots = async () => {
    setGeneratingSlots(true);
    setGenerateMsg(null);
    const dates = getWeekDates(weekOffset);
    const slotsToInsert: Array<{ booking_date: string; booking_time: string; duration_mins: number; is_blocked: boolean }> = [];

    dates.forEach((date) => {
      const dayOfWeek = date.getDay();
      const config = weeklyHours.find((h) => h.day === dayOfWeek);
      if (!config || !config.enabled) return;
      const [startH, startM] = config.startTime.split(':').map(Number);
      const [endH, endM] = config.endTime.split(':').map(Number);
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;
      for (let m = startMins; m + config.duration <= endMins; m += config.duration) {
        const h = Math.floor(m / 60).toString().padStart(2, '0');
        const min = (m % 60).toString().padStart(2, '0');
        slotsToInsert.push({
          booking_date: toDateStr(date),
          booking_time: `${h}:${min}:00`,
          duration_mins: config.duration,
          is_blocked: false,
        });
      }
    });

    if (slotsToInsert.length === 0) {
      setGenerateMsg({ type: 'error', text: 'No enabled days found. Enable at least one day in Office Hours.' });
      setGeneratingSlots(false);
      return;
    }

    const { error } = await supabase
      .from('consultation_availability_slots')
      .upsert(slotsToInsert, { onConflict: 'booking_date,booking_time,duration_mins' });

    if (error) {
      setGenerateMsg({ type: 'error', text: error.message });
    } else {
      setGenerateMsg({ type: 'success', text: `Generated ${slotsToInsert.length} availability slots for this week.` });
      fetchSlots();
    }
    setGeneratingSlots(false);
  };

  const updateWeeklyHour = (day: number, field: keyof WeeklyHour, value: string | number | boolean) => {
    setWeeklyHours((prev) => prev.map((h) => h.day === day ? { ...h, [field]: value } : h));
  };

  const saveWeeklyHours = async () => {
    setSavingHours(true);
    setSaveHoursMsg(null);
    try {
      localStorage.setItem('admin_weekly_hours', JSON.stringify(weeklyHours));
      setSaveHoursMsg({ type: 'success', text: 'Office hours saved. Use "Generate Slots" to apply to the calendar.' });
    } catch {
      setSaveHoursMsg({ type: 'error', text: 'Failed to save.' });
    }
    setSavingHours(false);
  };

  const slotsByDate: Record<string, AvailabilitySlot[]> = {};
  slots.forEach((s) => {
    if (!slotsByDate[s.booking_date]) slotsByDate[s.booking_date] = [];
    slotsByDate[s.booking_date].push(s);
  });

  const availableCount = slots.filter((s) => !s.is_blocked && !s.booking_id).length;
  const bookedCount = slots.filter((s) => !!s.booking_id).length;
  const blockedCount = slots.filter((s) => s.is_blocked).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Consultation Availability</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage open slots, block time off, and set weekly office hours.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSlots}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={generateWeekSlots}
            disabled={generatingSlots}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {generatingSlots ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Generate Slots
          </button>
        </div>
      </div>

      {generateMsg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${generateMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {generateMsg.text}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Available', value: availableCount, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: 'Booked', value: bookedCount, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Blocked', value: blockedCount, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4`}>
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { id: 'calendar', label: 'Weekly Calendar' },
          { id: 'weekly_hours', label: 'Office Hours' },
          { id: 'block_date', label: 'Block Time' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-700">
              {weekDates.length > 0 && `${weekDates[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </span>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-xs text-emerald-700 hover:underline font-medium">
                Today
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {weekDates.map((date, idx) => {
                const dateStr = toDateStr(date);
                const daySlots = slotsByDate[dateStr] ?? [];
                const todayStr = toDateStr(new Date());
                const isToday = todayStr === dateStr;
                return (
                  <div key={idx} className={`rounded-xl border p-2 min-h-[120px] ${isToday ? 'border-emerald-400 bg-emerald-50/30' : 'border-gray-100 bg-white'}`}>
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase">{DAY_SHORT[date.getDay()]}</p>
                      <p className={`text-sm font-bold ${isToday ? 'text-emerald-700' : 'text-gray-800'}`}>{date.getDate()}</p>
                    </div>
                    {daySlots.length === 0 ? (
                      <p className="text-xs text-gray-300 italic">No slots</p>
                    ) : (
                      <div className="space-y-1">
                        {daySlots.map((slot) => (
                          <div
                            key={slot.id}
                            className={`group relative flex items-center justify-between px-1.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                              slot.booking_id
                                ? 'bg-blue-100 text-blue-700 cursor-default'
                                : slot.is_blocked
                                ? 'bg-red-100 text-red-600 hover:bg-red-200' :'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            }`}
                            title={slot.booking_id ? 'Booked' : slot.is_blocked ? 'Blocked — click to unblock' : 'Available — click to block'}
                            onClick={() => !slot.booking_id && toggleBlock(slot)}
                          >
                            <span>{formatTime(slot.booking_time.slice(0, 5))}</span>
                            {!slot.booking_id && (
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteSlot(slot.id); }}
                                className="opacity-0 group-hover:opacity-100 ml-1 text-gray-400 hover:text-red-500 transition-opacity text-base leading-none"
                                title="Remove slot"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-gray-400 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-100" />Available</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-100" />Booked</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-100" />Blocked</span>
            <span className="text-gray-300">— Click an available/blocked slot to toggle</span>
          </p>
        </div>
      )}

      {/* Weekly Hours Tab */}
      {activeTab === 'weekly_hours' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Set your default office hours per day. Use "Generate Slots" to populate the calendar.</p>
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Day</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Open</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">End</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Slot Length</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {weeklyHours.map((h) => (
                  <tr key={h.day} className={h.enabled ? '' : 'opacity-50'}>
                    <td className="px-4 py-3 font-medium text-gray-800">{DAY_NAMES[h.day]}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => updateWeeklyHour(h.day, 'enabled', !h.enabled)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${h.enabled ? 'bg-emerald-600' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${h.enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={h.startTime}
                        onChange={(e) => updateWeeklyHour(h.day, 'startTime', e.target.value)}
                        disabled={!h.enabled}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={h.endTime}
                        onChange={(e) => updateWeeklyHour(h.day, 'endTime', e.target.value)}
                        disabled={!h.enabled}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={h.duration}
                        onChange={(e) => updateWeeklyHour(h.day, 'duration', Number(e.target.value))}
                        disabled={!h.enabled}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-40 bg-white"
                      >
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                        <option value={90}>90 min</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={saveWeeklyHours}
              disabled={savingHours}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {savingHours ? 'Saving…' : 'Save Office Hours'}
            </button>
            <button
              onClick={generateWeekSlots}
              disabled={generatingSlots}
              className="px-5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {generatingSlots ? 'Generating…' : 'Generate Slots for This Week'}
            </button>
          </div>
          {saveHoursMsg && (
            <p className={`text-sm ${saveHoursMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{saveHoursMsg.text}</p>
          )}
        </div>
      )}

      {/* Block Time Tab */}
      {activeTab === 'block_date' && (
        <div className="max-w-md space-y-4">
          <p className="text-sm text-gray-500">Block a specific date and time to prevent new bookings.</p>
          <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
              <input
                type="date"
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Time</label>
              <input
                type="time"
                value={blockTime}
                onChange={(e) => setBlockTime(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Duration</label>
              <select
                value={blockDuration}
                onChange={(e) => setBlockDuration(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reason (optional)</label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Court appearance, vacation…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={addBlockedSlot}
              disabled={blocking || !blockDate || !blockTime}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {blocking ? 'Blocking…' : 'Block This Slot'}
            </button>
            {blockMsg && (
              <p className={`text-sm ${blockMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{blockMsg.text}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
