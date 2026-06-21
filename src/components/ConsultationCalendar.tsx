'use client';

import React, { useState, useCallback } from 'react';

interface TimeSlot {
  time: string;
  label: string;
  available: boolean;
}

interface ConsultationCalendarProps {
  onDateTimeSelect?: (date: string, time: string) => void;
  selectedDate?: string;
  selectedTime?: string;
}

const TIME_SLOTS: TimeSlot[] = [
  { time: '09:00', label: '9:00 AM', available: true },
  { time: '09:30', label: '9:30 AM', available: true },
  { time: '10:00', label: '10:00 AM', available: true },
  { time: '10:30', label: '10:30 AM', available: false },
  { time: '11:00', label: '11:00 AM', available: true },
  { time: '11:30', label: '11:30 AM', available: true },
  { time: '13:00', label: '1:00 PM', available: true },
  { time: '13:30', label: '1:30 PM', available: false },
  { time: '14:00', label: '2:00 PM', available: true },
  { time: '14:30', label: '2:30 PM', available: true },
  { time: '15:00', label: '3:00 PM', available: true },
  { time: '15:30', label: '3:30 PM', available: false },
  { time: '16:00', label: '4:00 PM', available: true },
  { time: '16:30', label: '4:30 PM', available: true },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FULL[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_FULL[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay();
  return dow === 0 || dow === 6;
}

function isPast(year: number, month: number, day: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(year, month, day);
  return d < today;
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function ConsultationCalendar({
  onDateTimeSelect,
  selectedDate: externalDate,
  selectedTime: externalTime,
}: ConsultationCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [internalDate, setInternalDate] = useState('');
  const [internalTime, setInternalTime] = useState('');

  const selectedDate = externalDate ?? internalDate;
  const selectedTime = externalTime ?? internalTime;

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const handlePrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }, [viewMonth]);

  const handleNextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }, [viewMonth]);

  const handleDayClick = useCallback(
    (day: number) => {
      if (isWeekend(viewYear, viewMonth, day) || isPast(viewYear, viewMonth, day)) return;
      const ds = toDateString(viewYear, viewMonth, day);
      setInternalDate(ds);
      setInternalTime('');
      onDateTimeSelect?.(ds, '');
    },
    [viewYear, viewMonth, onDateTimeSelect]
  );

  const handleTimeClick = useCallback(
    (slot: TimeSlot) => {
      if (!slot.available) return;
      setInternalTime(slot.time);
      onDateTimeSelect?.(selectedDate, slot.time);
    },
    [selectedDate, onDateTimeSelect]
  );

  const canGoPrev = !(viewYear === today.getFullYear() && viewMonth === today.getMonth());

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedTimeSlot = TIME_SLOTS.find((s) => s.time === selectedTime);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-serif text-lg text-foreground">Pick a Date & Time</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Weekdays only · 30-min sessions · CST</p>
        </div>
        {selectedDate && selectedTime && (
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(53,94,59,0.1)', color: '#355E3B' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {formatDateShort(selectedDate)} · {selectedTimeSlot?.label}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-[1fr_auto] divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Calendar */}
        <div className="p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-accent/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous month"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-foreground">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:border-accent/50 transition-all"
              aria-label="Next month"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_OF_WEEK.map((d) => (
              <div
                key={d}
                className={`text-center text-[11px] font-semibold uppercase tracking-wider py-1 ${
                  d === 'Sun' || d === 'Sat' ? 'text-muted-foreground/40' : 'text-muted-foreground'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              const ds = toDateString(viewYear, viewMonth, day);
              const weekend = isWeekend(viewYear, viewMonth, day);
              const past = isPast(viewYear, viewMonth, day);
              const disabled = weekend || past;
              const isSelected = ds === selectedDate;
              const isToday =
                day === today.getDate() &&
                viewMonth === today.getMonth() &&
                viewYear === today.getFullYear();

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  disabled={disabled}
                  className={`
                    relative aspect-square rounded-lg text-sm font-medium transition-all duration-150 flex items-center justify-center
                    ${disabled ? 'text-muted-foreground/30 cursor-not-allowed' : 'cursor-pointer hover:bg-secondary/60'}
                    ${isSelected ? 'text-white shadow-sm' : ''}
                    ${isToday && !isSelected ? 'ring-1 ring-accent/50 text-accent font-semibold' : ''}
                    ${!disabled && !isSelected ? 'text-foreground' : ''}
                  `}
                  style={isSelected ? { background: '#355E3B' } : undefined}
                  aria-label={`${MONTHS[viewMonth]} ${day}, ${viewYear}`}
                  aria-pressed={isSelected}
                >
                  {day}
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t border-border flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: '#355E3B' }} />
              <span className="text-[11px] text-muted-foreground">Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm ring-1 ring-accent/50" />
              <span className="text-[11px] text-muted-foreground">Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-muted/30" />
              <span className="text-[11px] text-muted-foreground">Unavailable</span>
            </div>
          </div>
        </div>

        {/* Time slots */}
        <div className="p-5 md:w-52">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {selectedDate
              ? formatDateLong(selectedDate)
              : 'Select a date first'}
          </p>

          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30 mb-2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p className="text-xs text-muted-foreground/50">Pick a weekday to see available times</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
              {TIME_SLOTS.map((slot) => {
                const isSelected = slot.time === selectedTime;
                return (
                  <button
                    key={slot.time}
                    onClick={() => handleTimeClick(slot)}
                    disabled={!slot.available}
                    className={`
                      w-full px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150
                      ${!slot.available
                        ? 'text-muted-foreground/30 cursor-not-allowed line-through'
                        : isSelected
                          ? 'text-white shadow-sm'
                          : 'text-foreground border border-border hover:border-accent/50 hover:bg-secondary/40'
                      }
                    `}
                    style={isSelected ? { background: '#355E3B', border: 'none' } : undefined}
                    aria-pressed={isSelected}
                    aria-disabled={!slot.available}
                  >
                    <span className="flex items-center justify-between">
                      {slot.label}
                      {!slot.available && (
                        <span className="text-[10px] font-normal not-italic opacity-60">Booked</span>
                      )}
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation bar */}
      {selectedDate && selectedTime && (
        <div
          className="px-5 py-3.5 border-t border-border flex items-center justify-between gap-3"
          style={{ background: 'rgba(53,94,59,0.05)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(53,94,59,0.15)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                {formatDateFull(selectedDate)}
              </p>
              <p className="text-xs text-muted-foreground">{selectedTimeSlot?.label} CST · 30 minutes</p>
            </div>
          </div>
          <span
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(53,94,59,0.12)', color: '#355E3B' }}
          >
            Selected
          </span>
        </div>
      )}
    </div>
  );
}
