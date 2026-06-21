'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ConsultationBooking {
  id: string;
  client_name: string;
  client_email: string;
  booking_date: string;
  booking_time: string;
  timezone: string;
  duration_minutes: number;
  booking_type: string;
  status: string;
  notes: string | null;
  meeting_location: string | null;
  calendly_meeting_location: string | null;
}

interface PrepDocument {
  id: string;
  file_name: string;
  public_url: string | null;
  description: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
}

const BOOKING_TYPE_LABELS: Record<string, string> = {
  initial_consultation: 'Initial Consultation',
  case_checkin: 'Case Check-In',
  follow_up: 'Follow-Up',
  document_review: 'Document Review',
};

const CHECKLIST_ITEMS = [
  { id: 'quiet', label: 'Find a quiet, private space for the call' },
  { id: 'device', label: 'Test your camera and microphone beforehand' },
  { id: 'docs', label: 'Gather any relevant documents or correspondence' },
  { id: 'notes', label: 'Write down your key questions and concerns' },
  { id: 'timeline', label: 'Prepare a brief timeline of events' },
  { id: 'internet', label: 'Ensure a stable internet connection' },
  { id: 'early', label: 'Join the meeting 2–3 minutes early' },
];

const AGENDA_ITEMS = [
  { time: '0–5 min', title: 'Introductions & Overview', desc: 'Brief introductions and overview of your situation.' },
  { time: '5–20 min', title: 'Case Discussion', desc: 'Detailed discussion of your legal matter, facts, and timeline.' },
  { time: '20–30 min', title: 'Legal Strategy & Options', desc: 'Review of applicable law and potential paths forward.' },
  { time: '30–40 min', title: 'Next Steps & Engagement', desc: 'Discussion of how we can work together and what comes next.' },
  { time: '40–45 min', title: 'Q&A', desc: 'Open time for any remaining questions.' },
];

function formatDate(date: string, time: string, tz: string): string {
  try {
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    const dt = new Date(y, m - 1, d, h, min);
    return dt.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  } catch {
    return date;
  }
}

function formatTime(time: string): string {
  try {
    const [h, min] = time.split(':').map(Number);
    const dt = new Date(2000, 0, 1, h, min);
    return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return time;
  }
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMeetLink(booking: ConsultationBooking): string | null {
  const loc = booking.calendly_meeting_location || booking.meeting_location || '';
  if (loc.includes('meet.google.com') || loc.startsWith('https://')) return loc;
  if (loc.toLowerCase().includes('google meet')) return null;
  return null;
}

export default function ConsultationPrepPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = React.use(params);
  const [booking, setBooking] = useState<ConsultationBooking | null>(null);
  const [docs, setDocs] = useState<PrepDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const supabase = createClient();

        const { data: bookingData, error: bookingErr } = await supabase
          .from('consultation_bookings')
          .select('id, client_name, client_email, booking_date, booking_time, timezone, duration_minutes, booking_type, status, notes, meeting_location, calendly_meeting_location')
          .eq('prep_access_token', token)
          .single();

        if (bookingErr || !bookingData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setBooking(bookingData as ConsultationBooking);

        const { data: docsData } = await supabase
          .from('consultation_prep_documents')
          .select('id, file_name, public_url, description, mime_type, file_size, created_at')
          .eq('booking_id', bookingData.id)
          .order('created_at', { ascending: true });

        setDocs((docsData as PrepDocument[]) ?? []);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#355E3B] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading your consultation details…</p>
        </div>
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link Not Found</h1>
          <p className="text-sm text-gray-500">This prep page link is invalid or has expired. Please check your confirmation email or contact us.</p>
        </div>
      </div>
    );
  }

  const meetLink = getMeetLink(booking);
  const completedCount = checkedItems.size;
  const totalItems = CHECKLIST_ITEMS.length;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#355E3B] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-900">Broussard Legal Services</span>
          </div>
          <span className="text-xs text-gray-400 font-medium">Consultation Prep</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Welcome Banner */}
        <div className="bg-[#355E3B] rounded-2xl p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-green-200 mb-1">You're all set</p>
          <h1 className="text-2xl font-semibold mb-1">Hi, {booking.client_name.split(' ')[0]}!</h1>
          <p className="text-green-100 text-sm">Your consultation is confirmed. Here's everything you need to prepare.</p>
        </div>

        {/* Consultation Details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">Consultation Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f0f7f1] flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Date</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(booking.booking_date, booking.booking_time, booking.timezone)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f0f7f1] flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Time</p>
                <p className="text-sm font-semibold text-gray-900">{formatTime(booking.booking_time)} <span className="text-gray-400 font-normal">({booking.timezone?.replace('America/', '') ?? 'CT'})</span></p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f0f7f1] flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Type</p>
                <p className="text-sm font-semibold text-gray-900">{BOOKING_TYPE_LABELS[booking.booking_type] ?? booking.booking_type}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f0f7f1] flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Duration</p>
                <p className="text-sm font-semibold text-gray-900">{booking.duration_minutes} minutes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Google Meet Link */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">Join Your Call</h2>
          {meetLink ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Google Meet</p>
                  <p className="text-xs text-gray-400 truncate">{meetLink}</p>
                </div>
              </div>
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#355E3B] text-white text-sm font-semibold rounded-xl hover:bg-[#2d4f32] transition-colors flex-shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Join Meeting
              </a>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">Meeting link coming soon</p>
                <p className="text-xs text-amber-600 mt-0.5">Your Google Meet link will be sent to {booking.client_email} before the call.</p>
              </div>
            </div>
          )}
        </div>

        {/* Call Agenda */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">Call Agenda</h2>
          <div className="space-y-0">
            {AGENDA_ITEMS.map((item, i) => (
              <div key={i} className="flex gap-4 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-[#f0f7f1] border-2 border-[#355E3B] flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-[#355E3B]">{i + 1}</span>
                  </div>
                  {i < AGENDA_ITEMS.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                </div>
                <div className="pb-4 last:pb-0 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-[#355E3B]">{item.time}</span>
                    <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                  </div>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prep Documents */}
        {docs.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">Prep Documents</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#f0f7f1] text-[#355E3B]">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all group">
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{doc.file_name}</p>
                    {doc.description && <p className="text-xs text-gray-400 truncate">{doc.description}</p>}
                    {doc.file_size && <p className="text-xs text-gray-300">{formatBytes(doc.file_size)}</p>}
                  </div>
                  {doc.public_url && (
                    <a
                      href={doc.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#355E3B] border border-[#355E3B]/20 rounded-lg hover:bg-[#f0f7f1] transition-colors flex-shrink-0"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pre-Call Checklist */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400">Pre-Call Checklist</h2>
            <span className="text-xs font-semibold text-gray-400">{completedCount}/{totalItems} done</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full mb-5 overflow-hidden">
            <div
              className="h-full bg-[#355E3B] rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / totalItems) * 100}%` }}
            />
          </div>
          <div className="space-y-2">
            {CHECKLIST_ITEMS.map((item) => {
              const checked = checkedItems.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    checked
                      ? 'bg-[#f0f7f1] border-[#355E3B]/20'
                      : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    checked ? 'bg-[#355E3B] border-[#355E3B]' : 'border-gray-300'
                  }`}>
                    {checked && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${checked ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
          {completedCount === totalItems && (
            <div className="mt-4 p-3 bg-[#f0f7f1] rounded-xl border border-[#355E3B]/20 text-center">
              <p className="text-sm font-semibold text-[#355E3B]">You're fully prepared! See you at the call. 🎉</p>
            </div>
          )}
        </div>

        {/* How to Prepare */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4">How to Prepare</h2>
          <div className="space-y-4">
            {[
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                ),
                title: 'Gather Your Documents',
                desc: 'Bring any contracts, correspondence, court documents, or evidence relevant to your matter.',
              },
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                ),
                title: 'Write Down Your Questions',
                desc: 'List your top 3–5 questions in priority order so we cover what matters most to you.',
              },
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                ),
                title: 'Know Your Timeline',
                desc: 'Be ready to share key dates — when events occurred, deadlines you\'re aware of, and any urgency.',
              },
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                ),
                title: 'Identify All Parties',
                desc: 'Know the names and roles of everyone involved — opposing parties, witnesses, or other attorneys.',
              },
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#f0f7f1] flex items-center justify-center flex-shrink-0">
                  {tip.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{tip.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center pb-8">
          <p className="text-xs text-gray-400">Questions before your call? Email us at <a href="mailto:info@broussardlegalservices.com" className="text-[#355E3B] font-medium hover:underline">info@broussardlegalservices.com</a></p>
        </div>
      </main>
    </div>
  );
}
