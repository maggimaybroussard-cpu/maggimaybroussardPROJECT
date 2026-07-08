'use client';

import React, { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageType = 'consultation_reminder' | 'case_update' | 'payment_reminder' | 'client_notification' | 'custom';
type ReminderType = '24hr' | '1hr';

interface SendResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

interface SendLog {
  id: string;
  to: string;
  type: MessageType;
  status: 'sent' | 'failed';
  messageSid?: string;
  error?: string;
  sentAt: string;
  preview: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeLabel(type: MessageType): string {
  const map: Record<MessageType, string> = {
    consultation_reminder: 'Consultation Reminder',
    case_update: 'Case Update',
    payment_reminder: 'Payment Reminder',
    client_notification: 'Client Notification',
    custom: 'Custom Message',
  };
  return map[type];
}

function typeIcon(type: MessageType): string {
  const map: Record<MessageType, string> = {
    consultation_reminder: '📅',
    case_update: '⚖️',
    payment_reminder: '💳',
    client_notification: '🔔',
    custom: '✉️',
  };
  return map[type];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhatsAppDashboard() {
  const [activeTab, setActiveTab] = useState<'compose' | 'logs' | 'setup'>('compose');
  const [messageType, setMessageType] = useState<MessageType>('consultation_reminder');
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Shared fields
  const [to, setTo] = useState('');
  const [clientName, setClientName] = useState('');

  // Consultation reminder fields
  const [appointmentType, setAppointmentType] = useState('Paralegal Consultation');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [reminderType, setReminderType] = useState<ReminderType>('24hr');

  // Case update fields
  const [caseName, setCaseName] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [portalLink, setPortalLink] = useState('');

  // Payment reminder fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);

  // Client notification fields
  const [subject, setSubject] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [actionLink, setActionLink] = useState('');
  const [actionLabel, setActionLabel] = useState('');

  // Custom message
  const [customMessage, setCustomMessage] = useState('');

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  const buildPayload = () => {
    const base = { type: messageType, to, clientName };
    switch (messageType) {
      case 'consultation_reminder':
        return { ...base, appointmentType, appointmentDate, appointmentTime, meetingLink, reminderType };
      case 'case_update':
        return { ...base, caseName, updateMessage, portalLink };
      case 'payment_reminder':
        return { ...base, invoiceNumber, amount, dueDate, paymentLink, isOverdue };
      case 'client_notification':
        return { ...base, subject, message: notificationMessage, actionLink, actionLabel };
      case 'custom':
        return { type: messageType, to, message: customMessage };
    }
  };

  const handleSend = async () => {
    if (!to) { showToast('error', 'Phone number is required'); return; }
    if (!/^\+[1-9]\d{7,14}$/.test(to)) { showToast('error', 'Phone must be E.164 format (e.g. +15041234567)'); return; }
    if (messageType !== 'custom' && !clientName) { showToast('error', 'Client name is required'); return; }

    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data: SendResult = await res.json();

      const logEntry: SendLog = {
        id: Date.now().toString(),
        to,
        type: messageType,
        status: data.success ? 'sent' : 'failed',
        messageSid: data.messageSid,
        error: data.error,
        sentAt: new Date().toISOString(),
        preview: messageType === 'custom' ? customMessage.slice(0, 60) : `${typeLabel(messageType)} → ${clientName}`,
      };
      setLogs(prev => [logEntry, ...prev]);

      if (data.success) {
        showToast('success', `WhatsApp message sent! SID: ${data.messageSid}`);
      } else {
        showToast('error', data.error ?? 'Failed to send WhatsApp message');
      }
    } catch {
      showToast('error', 'Network error — could not reach WhatsApp API');
    } finally {
      setSending(false);
    }
  };

  const tabs = [
    { id: 'compose' as const, label: 'Compose', icon: '💬' },
    { id: 'logs' as const, label: `Logs${logs.length > 0 ? ` (${logs.length})` : ''}`, icon: '📋' },
    { id: 'setup' as const, label: 'Setup Guide', icon: '⚙️' },
  ];

  const messageTypes: { value: MessageType; label: string; icon: string }[] = [
    { value: 'consultation_reminder', label: 'Consultation Reminder', icon: '📅' },
    { value: 'case_update', label: 'Case Update', icon: '⚖️' },
    { value: 'payment_reminder', label: 'Payment Reminder', icon: '💳' },
    { value: 'client_notification', label: 'Client Notification', icon: '🔔' },
    { value: 'custom', label: 'Custom Message', icon: '✉️' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white text-xl font-bold shadow">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">WhatsApp Business</h2>
          <p className="text-sm text-gray-500">Send messages via Twilio WhatsApp channel</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Twilio Connected
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Compose Tab ── */}
      {activeTab === 'compose' && (
        <div className="space-y-5">
          {/* Message Type Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Message Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {messageTypes.map(mt => (
                <button
                  key={mt.value}
                  onClick={() => setMessageType(mt.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    messageType === mt.value
                      ? 'border-green-500 bg-green-50 text-green-700' :'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span>{mt.icon}</span>
                  <span className="truncate">{mt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recipient */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="+15041234567"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <p className="mt-1 text-xs text-gray-400">E.164 format required</p>
            </div>
            {messageType !== 'custom' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            )}
          </div>

          {/* Type-specific fields */}
          {messageType === 'consultation_reminder' && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Consultation Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Type</label>
                  <input type="text" value={appointmentType} onChange={e => setAppointmentType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Type</label>
                  <select value={reminderType} onChange={e => setReminderType(e.target.value as ReminderType)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                    <option value="24hr">24 Hours Before</option>
                    <option value="1hr">1 Hour Before</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link (optional)</label>
                  <input type="url" value={meetingLink} onChange={e => setMeetingLink(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
              </div>
            </div>
          )}

          {messageType === 'case_update' && (
            <div className="space-y-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Case Update Details</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Case Name</label>
                <input type="text" value={caseName} onChange={e => setCaseName(e.target.value)}
                  placeholder="Johnson v. Smith"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Update Message</label>
                <textarea value={updateMessage} onChange={e => setUpdateMessage(e.target.value)}
                  rows={3} placeholder="Your case has been updated..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Portal Link (optional)</label>
                <input type="url" value={portalLink} onChange={e => setPortalLink(e.target.value)}
                  placeholder="https://broussardlegalservices.com/portal/cases"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
            </div>
          )}

          {messageType === 'payment_reminder' && (
            <div className="space-y-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Payment Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                  <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="INV-2024-001"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input type="text" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="$1,500.00"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Link (optional)</label>
                  <input type="url" value={paymentLink} onChange={e => setPaymentLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isOverdue} onChange={e => setIsOverdue(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-400" />
                <span className="text-sm text-gray-700">Mark as overdue (urgent tone)</span>
              </label>
            </div>
          )}

          {messageType === 'client_notification' && (
            <div className="space-y-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Notification Details</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="Important Update Regarding Your Case"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea value={notificationMessage} onChange={e => setNotificationMessage(e.target.value)}
                  rows={3} placeholder="Your message here..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action Link (optional)</label>
                  <input type="url" value={actionLink} onChange={e => setActionLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action Label (optional)</label>
                  <input type="text" value={actionLabel} onChange={e => setActionLabel(e.target.value)}
                    placeholder="View in Portal"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </div>
              </div>
            </div>
          )}

          {messageType === 'custom' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom Message</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message Body</label>
                <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)}
                  rows={5} placeholder="Type your WhatsApp message here. Supports *bold* and _italic_ formatting."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
                <p className="mt-1 text-xs text-gray-400">WhatsApp supports *bold*, _italic_, and ~strikethrough~ formatting</p>
              </div>
            </div>
          )}

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-semibold rounded-xl transition-colors shadow-sm"
          >
            {sending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending via WhatsApp...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Send WhatsApp Message
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Logs Tab ── */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-sm">No messages sent yet in this session</p>
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className={`flex items-start gap-3 p-4 rounded-xl border ${log.status === 'sent' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <span className="text-xl mt-0.5">{typeIcon(log.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{typeLabel(log.type)}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${log.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {log.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{log.to} · {log.preview}</p>
                  {log.messageSid && <p className="text-xs text-gray-400 mt-0.5 font-mono">SID: {log.messageSid}</p>}
                  {log.error && <p className="text-xs text-red-500 mt-0.5">{log.error}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(log.sentAt).toLocaleTimeString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Setup Guide Tab ── */}
      {activeTab === 'setup' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ WhatsApp Business Setup Required</p>
            <p className="text-xs text-amber-700">Before sending WhatsApp messages, complete the Twilio WhatsApp configuration below.</p>
          </div>

          {[
            {
              step: 1,
              title: 'Enable WhatsApp in Twilio Console',
              desc: 'Go to Twilio Console → Messaging → Try it out → Send a WhatsApp message. Join the sandbox or apply for a WhatsApp Business number.',
              link: 'https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn',
              linkLabel: 'Open Twilio WhatsApp Console →',
            },
            {
              step: 2,
              title: 'Set TWILIO_WHATSAPP_NUMBER in .env',
              desc: 'Add your WhatsApp-enabled Twilio number (e.g. +14155238886 for sandbox, or your approved business number) as TWILIO_WHATSAPP_NUMBER in your environment variables.',
              code: 'TWILIO_WHATSAPP_NUMBER=+14155238886',
            },
            {
              step: 3,
              title: 'Client Opt-In (Required by WhatsApp)',
              desc: 'Clients must send "join <sandbox-keyword>" to your Twilio WhatsApp number first (sandbox), or opt in via your approved business profile. WhatsApp requires explicit consent before you can message users.',
            },
            {
              step: 4,
              title: 'Apply for WhatsApp Business API (Production)',
              desc: 'For production use, apply for a WhatsApp Business Account through Twilio. This removes sandbox restrictions and allows proactive messaging to opted-in clients.',
              link: 'https://www.twilio.com/whatsapp',
              linkLabel: 'Apply for WhatsApp Business →',
            },
          ].map(item => (
            <div key={item.step} className="flex gap-4 p-4 bg-white border border-gray-200 rounded-xl">
              <div className="w-7 h-7 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {item.step}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800 mb-1">{item.title}</p>
                <p className="text-xs text-gray-500 mb-2">{item.desc}</p>
                {item.code && (
                  <code className="block text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded-lg font-mono">{item.code}</code>
                )}
                {item.link && (
                  <a href={item.link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium mt-1">
                    {item.linkLabel}
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <p className="text-xs font-semibold text-gray-600 mb-2">API Endpoint Reference</p>
            <code className="block text-xs bg-gray-800 text-green-400 px-3 py-2 rounded-lg font-mono whitespace-pre">{`POST /api/whatsapp/send
{
  "type": "consultation_reminder" | "case_update" | "payment_reminder" | "client_notification" | "custom",
  "to": "+15041234567",
  "clientName": "Jane Smith",
  // ...type-specific fields
}`}</code>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          <span>{toast.type === 'success' ? '✓' : '✗'}</span>
          {toast.message}
        </div>
      )}
    </div>
  );
}
