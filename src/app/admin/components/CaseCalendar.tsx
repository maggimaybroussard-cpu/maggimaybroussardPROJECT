'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'deadline' | 'consultation' | 'court' | 'intake' | 'retainer';
  status?: string;
  client?: string;
  description?: string;
}

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  deadline: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  consultation: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  court: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  intake: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  retainer: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
};

const EVENT_LABELS: Record<string, string> = {
  deadline: 'Deadline',
  consultation: 'Consultation',
  court: 'Court Date',
  intake: 'Intake',
  retainer: 'Retainer',
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CaseCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [filterType, setFilterType] = useState<string>('all');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startOfMonth = new Date(year, month, 1).toISOString();
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const [tasksRes, consultationsRes, intakesRes, retainersRes] = await Promise.all([
        supabase.from('admin_tasks')
          .select('id, title, due_date, status, description')
          .gte('due_date', startOfMonth.split('T')[0])
          .lte('due_date', endOfMonth.split('T')[0])
          .limit(100),
        supabase.from('contact_inquiries')
          .select('id, name, calendly_start_time, calendly_event_name, booking_stage')
          .not('calendly_start_time', 'is', null)
          .gte('calendly_start_time', startOfMonth)
          .lte('calendly_start_time', endOfMonth)
          .limit(100),
        supabase.from('contact_inquiries')
          .select('id, name, created_at, service')
          .eq('booking_stage', 'inquiry')
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth)
          .limit(50),
        supabase.from('retainer_subscriptions')
          .select('id, client_name, next_billing_date, status')
          .not('next_billing_date', 'is', null)
          .gte('next_billing_date', startOfMonth.split('T')[0])
          .lte('next_billing_date', endOfMonth.split('T')[0])
          .in('status', ['active', 'trialing'])
          .limit(50),
      ]);

      const calEvents: CalendarEvent[] = [];

      // Tasks / Deadlines
      (tasksRes.data || []).forEach((t) => {
        calEvents.push({
          id: `task-${t.id}`,
          title: t.title || 'Task',
          date: t.due_date,
          type: 'deadline',
          status: t.status,
          description: t.description,
        });
      });

      // Consultations
      (consultationsRes.data || []).forEach((c) => {
        if (c.calendly_start_time) {
          calEvents.push({
            id: `consult-${c.id}`,
            title: c.calendly_event_name || 'Consultation',
            date: c.calendly_start_time.split('T')[0],
            type: 'consultation',
            client: c.name,
          });
        }
      });

      // Intakes
      (intakesRes.data || []).forEach((i) => {
        calEvents.push({
          id: `intake-${i.id}`,
          title: `New Intake: ${i.name}`,
          date: i.created_at.split('T')[0],
          type: 'intake',
          client: i.name,
          description: i.service,
        });
      });

      // Retainer renewals
      (retainersRes.data || []).forEach((r) => {
        if (r.next_billing_date) {
          calEvents.push({
            id: `retainer-${r.id}`,
            title: `Retainer Renewal`,
            date: r.next_billing_date,
            type: 'retainer',
            client: r.client_name,
          });
        }
      });

      setEvents(calEvents);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.date === dateStr && (filterType === 'all' || e.type === filterType));
  };

  const selectedDayEvents = selectedDay
    ? events.filter((e) => e.date === selectedDay && (filterType === 'all' || e.type === filterType))
    : [];

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredEvents = filterType === 'all' ? events : events.filter((e) => e.type === filterType);
  const sortedEvents = [...filteredEvents].sort((a, b) => a.date.localeCompare(b.date));

  const eventCounts = {
    all: events.length,
    deadline: events.filter((e) => e.type === 'deadline').length,
    consultation: events.filter((e) => e.type === 'consultation').length,
    intake: events.filter((e) => e.type === 'intake').length,
    retainer: events.filter((e) => e.type === 'retainer').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Case Calendar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Deadlines, consultations, intakes & retainer renewals</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'month' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              List
            </button>
          </div>
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'deadline', 'consultation', 'intake', 'retainer'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filterType === type
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-muted-foreground hover:border-primary/30'
            }`}
          >
            {type !== 'all' && (
              <span className={`w-1.5 h-1.5 rounded-full ${filterType === type ? 'bg-white' : EVENT_COLORS[type]?.dot}`} />
            )}
            {type === 'all' ? 'All Events' : EVENT_LABELS[type]}
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs ${filterType === type ? 'bg-white/20' : 'bg-muted/50'}`}>
              {eventCounts[type as keyof typeof eventCounts] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {viewMode === 'month' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
            {/* Navigation */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-foreground">{MONTHS[month]} {year}</h3>
                <button onClick={goToToday} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                  Today
                </button>
              </div>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {DAYS_OF_WEEK.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            {loading ? (
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="h-16 bg-muted/20 animate-pulse rounded-lg" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {/* Empty cells before first day */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-border/50 bg-secondary/10" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayEvents = getEventsForDay(day);
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDay;
                  const isWeekend = (firstDayOfMonth + i) % 7 === 0 || (firstDayOfMonth + i) % 7 === 6;

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                      className={`min-h-[80px] border-b border-r border-border/50 p-1.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/8 border-primary/20' : isWeekend ?'bg-secondary/20 hover:bg-secondary/40': 'hover:bg-secondary/30'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 ${
                        isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                      }`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className={`px-1.5 py-0.5 rounded text-xs truncate ${EVENT_COLORS[ev.type]?.bg} ${EVENT_COLORS[ev.type]?.text}`}
                          >
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-muted-foreground pl-1">+{dayEvents.length - 2} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Side Panel */}
          <div className="space-y-4">
            {/* Selected Day Events */}
            {selectedDay ? (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h4>
                  <button onClick={() => setSelectedDay(null)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                {selectedDayEvents.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">No events on this day</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {selectedDayEvents.map((ev) => (
                      <div key={ev.id} className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${EVENT_COLORS[ev.type]?.dot}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                            {ev.client && <p className="text-xs text-muted-foreground mt-0.5">{ev.client}</p>}
                            {ev.description && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{ev.description}</p>}
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_COLORS[ev.type]?.bg} ${EVENT_COLORS[ev.type]?.text}`}>
                              {EVENT_LABELS[ev.type]}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">Click a day to see events</p>
              </div>
            )}

            {/* Upcoming Events */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h4 className="text-sm font-semibold text-foreground">Upcoming This Month</h4>
              </div>
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted/30 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {sortedEvents.filter((e) => e.date >= todayStr).slice(0, 8).map((ev) => (
                    <div key={ev.id} className="px-4 py-2.5 flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${EVENT_COLORS[ev.type]?.dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{ev.title}</p>
                        {ev.client && <p className="text-xs text-muted-foreground truncate">{ev.client}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                  {sortedEvents.filter((e) => e.date >= todayStr).length === 0 && (
                    <div className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">No upcoming events</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <h3 className="text-sm font-semibold text-foreground">{MONTHS[month]} {year}</h3>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            <span className="text-xs text-muted-foreground">{sortedEvents.length} events</span>
          </div>
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-muted/30 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : sortedEvents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No events this month</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sortedEvents.map((ev) => {
                const isToday = ev.date === todayStr;
                const isPast = ev.date < todayStr;
                return (
                  <div key={ev.id} className={`px-5 py-3.5 flex items-center gap-4 ${isPast ? 'opacity-60' : ''}`}>
                    <div className="w-12 text-center flex-shrink-0">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest">
                        {new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </p>
                      <p className={`text-xl font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                        {new Date(ev.date + 'T12:00:00').getDate()}
                      </p>
                    </div>
                    <div className={`w-1 h-10 rounded-full flex-shrink-0 ${EVENT_COLORS[ev.type]?.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                      {ev.client && <p className="text-xs text-muted-foreground mt-0.5">{ev.client}</p>}
                      {ev.description && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{ev.description}</p>}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${EVENT_COLORS[ev.type]?.bg} ${EVENT_COLORS[ev.type]?.text}`}>
                      {EVENT_LABELS[ev.type]}
                    </span>
                    {isToday && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground flex-shrink-0">Today</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
