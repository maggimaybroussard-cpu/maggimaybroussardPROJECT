'use client';

import React, { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportType = 'time_logs' | 'invoices' | 'both';

interface ExportResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  exportedSheets: string[];
  message: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function GoogleSheetsIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="18" height="20" rx="2" fill="#0F9D58" fillOpacity="0.12" stroke="#0F9D58" strokeWidth="1.5"/>
      <path d="M7 8h10M7 12h10M7 16h6" stroke="#0F9D58" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="14" y="13" width="5" height="5" rx="0.5" fill="#0F9D58" fillOpacity="0.3" stroke="#0F9D58" strokeWidth="1"/>
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GoogleSheetsExportDashboard() {
  const [exportType, setExportType] = useState<ExportType>('both');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [existingSpreadsheetId, setExistingSpreadsheetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/admin/google-sheets-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exportType,
          spreadsheetId: existingSpreadsheetId.trim() || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Export failed');
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const exportOptions: { value: ExportType; label: string; desc: string; icon: string }[] = [
    { value: 'both', label: 'Time Logs + Invoices', desc: 'Export both datasets into separate sheets', icon: '📊' },
    { value: 'time_logs', label: 'Time Logs Only', desc: 'Billable hours, rates, and task categories', icon: '⏱' },
    { value: 'invoices', label: 'Invoices Only', desc: 'Invoice amounts, status, and payment history', icon: '🧾' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <GoogleSheetsIcon />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Google Sheets Export</h2>
          <p className="text-sm text-slate-500">Auto-export time logs and invoices to a Google Spreadsheet</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Config */}
        <div className="space-y-5">
          {/* Export Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">What to export</label>
            <div className="space-y-2">
              {exportOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setExportType(opt.value)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    exportType === opt.value
                      ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' :'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xl mt-0.5">{opt.icon}</span>
                  <div>
                    <div className={`text-sm font-medium ${exportType === opt.value ? 'text-emerald-800' : 'text-slate-800'}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                  </div>
                  {exportType === opt.value && (
                    <div className="ml-auto mt-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Date range <span className="text-slate-400 font-normal">(optional)</span></label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Leave blank to export all records (up to 2,000 per sheet)</p>
          </div>

          {/* Existing Spreadsheet */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Append to existing spreadsheet <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={existingSpreadsheetId}
              onChange={e => setExistingSpreadsheetId(e.target.value)}
              placeholder="Paste spreadsheet ID from URL…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Found in the URL: docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
            </p>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Exporting to Google Sheets…
              </>
            ) : (
              <>
                <ExportIcon />
                Export to Google Sheets
              </>
            )}
          </button>
        </div>

        {/* Right: Result / Info */}
        <div className="space-y-4">
          {/* Success */}
          {result && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-sm font-semibold text-emerald-800">Export successful!</span>
              </div>
              <p className="text-sm text-emerald-700">{result.message}</p>
              <div className="space-y-1.5">
                {result.exportedSheets.map(sheet => (
                  <div key={sheet} className="flex items-center gap-2 text-xs text-emerald-700">
                    <span className="text-emerald-500">✓</span>
                    {sheet}
                  </div>
                ))}
              </div>
              <a
                href={result.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <LinkIcon />
                Open in Google Sheets
              </a>
              <div className="pt-1 border-t border-emerald-200">
                <p className="text-xs text-emerald-600 font-medium">Spreadsheet ID (save for future appends):</p>
                <code className="text-xs text-emerald-800 bg-emerald-100 px-2 py-1 rounded mt-1 block break-all">
                  {result.spreadsheetId}
                </code>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-2">
                <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-semibold text-red-800">Export failed</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  {error.includes('OAuth') && (
                    <a
                      href="/api/google-calendar/auth"
                      className="inline-block mt-2 text-xs text-red-700 underline hover:text-red-900"
                    >
                      Complete Google OAuth setup →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">What gets exported</p>
            <div className="space-y-2">
              <div className="flex gap-2">
                <span className="text-slate-400 text-xs mt-0.5">⏱</span>
                <div>
                  <p className="text-xs font-medium text-slate-700">Time Logs sheet</p>
                  <p className="text-xs text-slate-500">Date, client, hours, billable flag, task category, hourly rate, amount, description, staff</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-400 text-xs mt-0.5">🧾</span>
                <div>
                  <p className="text-xs font-medium text-slate-700">Invoices sheet</p>
                  <p className="text-xs text-slate-500">Invoice #, dates, client, service, amount, amount paid, balance due, status</p>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                <strong className="text-slate-600">Requires:</strong> Google OAuth connected via{' '}
                <a href="/api/google-calendar/auth" className="text-blue-600 hover:underline">/api/google-calendar/auth</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
