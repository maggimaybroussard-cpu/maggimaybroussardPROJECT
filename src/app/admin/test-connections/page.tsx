'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface ServiceResult {
  ok: boolean;
  message: string;
  detail?: string;
}

interface TestResponse {
  ok: boolean;
  results: {
    supabase: ServiceResult;
    resend: ServiceResult;
  };
}

type TestState = 'idle' | 'running' | 'done';

function StatusIcon({ ok, running }: { ok?: boolean; running: boolean }) {
  if (running) {
    return (
      <svg className="w-6 h-6 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    );
  }
  if (ok === true) {
    return (
      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
        <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  if (ok === false) {
    return (
      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100">
        <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="4" />
      </svg>
    </span>
  );
}

function ServiceCard({
  name,
  icon,
  result,
  running,
}: {
  name: string;
  icon: React.ReactNode;
  result?: ServiceResult;
  running: boolean;
}) {
  const [showDetail, setShowDetail] = useState(false);

  const borderColor = running
    ? 'border-blue-200'
    : result?.ok === true
    ? 'border-green-200'
    : result?.ok === false
    ? 'border-red-200' :'border-gray-200';

  const bgColor = running
    ? 'bg-blue-50/30'
    : result?.ok === true
    ? 'bg-green-50/40'
    : result?.ok === false
    ? 'bg-red-50/30' :'bg-white';

  return (
    <div className={`rounded-xl border-2 ${borderColor} ${bgColor} p-6 transition-all duration-300`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900">{name}</h3>
            <StatusIcon ok={result?.ok} running={running} />
          </div>

          {running && (
            <p className="mt-1 text-sm text-blue-600">Testing connection…</p>
          )}

          {!running && result && (
            <>
              <p className={`mt-1 text-sm ${result.ok ? 'text-green-700' : 'text-red-600'}`}>
                {result.message}
              </p>
              {result.detail && (
                <button
                  onClick={() => setShowDetail(!showDetail)}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
                >
                  {showDetail ? 'Hide details' : 'Show details'}
                </button>
              )}
              {showDetail && result.detail && (
                <pre className="mt-2 text-xs bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-gray-600 whitespace-pre-wrap break-all">
                  {result.detail}
                </pre>
              )}
            </>
          )}

          {!running && !result && (
            <p className="mt-1 text-sm text-gray-400">Not yet tested</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TestConnectionsPage() {
  const [state, setState] = useState<TestState>('idle');
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTested, setLastTested] = useState<string | null>(null);

  async function runTests() {
    setState('running');
    setResponse(null);
    setError(null);
    setLastTested(null);

    try {
      const res = await fetch('/api/admin/test-connections');
      const data: TestResponse = await res.json();
      setResponse(data);
      setState('done');
      setLastTested(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error running tests');
      setState('done');
    }
  }

  // Auto-run on mount
  useEffect(() => {
    runTests();
  }, []);

  const allPassed = response?.ok === true;
  const anyFailed = response && !response.ok;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Admin
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Connection Test</h1>
          <p className="mt-1 text-gray-500 text-sm">
            Verifying that Supabase and Resend are connected with your updated credentials.
          </p>
        </div>

        {/* Overall status banner */}
        {state === 'done' && !error && (
          <div className={`rounded-xl px-5 py-4 mb-6 flex items-center gap-3 ${
            allPassed
              ? 'bg-green-50 border border-green-200' :'bg-amber-50 border border-amber-200'
          }`}>
            {allPassed ? (
              <>
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="text-sm font-medium text-green-800">
                  All systems connected — Supabase and Resend are working correctly with your updated credentials.
                </p>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className="text-sm font-medium text-amber-800">
                  One or more connections failed. Review the details below.
                </p>
              </>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-xl px-5 py-4 mb-6 bg-red-50 border border-red-200 flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        )}

        {/* Service cards */}
        <div className="space-y-4">
          {/* Supabase */}
          <ServiceCard
            name="Supabase Database"
            running={state === 'running'}
            result={response?.results?.supabase}
            icon={
              <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C.33 12.6.72 13.4 1.425 13.4h9.255l.002 9.927c.015.986 1.26 1.41 1.874.637l9.262-11.652c.434-.55.043-1.35-.662-1.35h-9.255L11.9 1.036z" />
                </svg>
              </div>
            }
          />

          {/* Resend */}
          <ServiceCard
            name="Resend Email Service"
            running={state === 'running'}
            result={response?.results?.resend}
            icon={
              <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
            }
          />
        </div>

        {/* Re-run button */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={runTests}
            disabled={state === 'running'}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {state === 'running' ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Running…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
                </svg>
                Run Again
              </>
            )}
          </button>

          {state === 'done' && allPassed && (
            <p className="text-xs text-gray-400">
              Last tested: {lastTested}
            </p>
          )}
        </div>

        {/* Send test email section — only show if Resend passed */}
        {state === 'done' && response?.results?.resend?.ok && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Send a Test Email</h2>
            <p className="text-xs text-gray-500 mb-4">
              Resend is connected. Optionally send a real test email to confirm delivery.
            </p>
            <TestEmailForm />
          </div>
        )}
      </div>
    </div>
  );
}

function TestEmailForm() {
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function send() {
    if (!to.trim()) return;
    setStatus('sending');
    setMessage('');
    try {
      const res = await fetch('/api/admin/test-resend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Failed to send.');
      } else {
        setStatus('success');
        setMessage(`Test email sent to ${to.trim()}. Check your inbox!`);
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="email"
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        <button
          onClick={send}
          disabled={status === 'sending' || !to.trim()}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'sending' ? 'Sending…' : 'Send'}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${status === 'success' ? 'text-green-700' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
