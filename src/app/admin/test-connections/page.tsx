'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
    stripe: ServiceResult;
    twilio: ServiceResult;
    google: ServiceResult;
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
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
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
          onChange={(e) => setTo(e.target.value)}
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

export default function TestConnectionsPage() {
  const [state, setState] = useState<TestState>('idle');
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTested, setLastTested] = useState<string | null>(null);

  const runTests = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    runTests();
  }, [runTests]);

  const allPassed = response?.ok === true;

  const passedCount = response
    ? [
        response.results?.supabase?.ok,
        response.results?.resend?.ok,
        response.results?.stripe?.ok,
        response.results?.twilio?.ok,
        response.results?.google?.ok,
      ].filter(Boolean).length
    : 0;

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
            Verifying live connections for Supabase, Resend, Stripe, Twilio, and Google Workspace.
          </p>
        </div>

        {/* Overall status banner */}
        {state === 'done' && !error && (
          <div
            className={`rounded-xl px-5 py-4 mb-6 flex items-center gap-3 ${
              allPassed
                ? 'bg-green-50 border border-green-200' :'bg-amber-50 border border-amber-200'
            }`}
          >
            {allPassed ? (
              <>
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="text-sm font-medium text-green-800">
                  All 5 services connected — Stripe, Twilio, and Google are live.
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
                  {passedCount} of 5 services connected. Review the details below.
                </p>
              </>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-xl px-5 py-4 mb-6 bg-red-50 border border-red-200 flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
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

          {/* Stripe */}
          <ServiceCard
            name="Stripe Payments"
            running={state === 'running'}
            result={response?.results?.stripe}
            icon={
              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
                </svg>
              </div>
            }
          />

          {/* Twilio */}
          <ServiceCard
            name="Twilio SMS"
            running={state === 'running'}
            result={response?.results?.twilio}
            icon={
              <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 20.571c-4.731 0-8.571-3.84-8.571-8.571S7.269 3.429 12 3.429s8.571 3.84 8.571 8.571-3.84 8.571-8.571 8.571zm-2.571-9.714a1.714 1.714 0 1 1 0-3.428 1.714 1.714 0 0 1 0 3.428zm5.142 0a1.714 1.714 0 1 1 0-3.428 1.714 1.714 0 0 1 0 3.428zm-5.142 5.143a1.714 1.714 0 1 1 0-3.429 1.714 1.714 0 0 1 0 3.429zm5.142 0a1.714 1.714 0 1 1 0-3.429 1.714 1.714 0 0 1 0 3.429z" />
                </svg>
              </div>
            }
          />

          {/* Google / Gmail */}
          <ServiceCard
            name="Google Workspace / Gmail"
            running={state === 'running'}
            result={response?.results?.google}
            icon={
              <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
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
          {state === 'done' && lastTested && (
            <p className="text-xs text-gray-400">Last tested: {lastTested}</p>
          )}
        </div>

        {/* Send test email section */}
        {state === 'done' && response?.results?.resend?.ok && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Send a Test Email</h2>
            <p className="text-xs text-gray-500 mb-4">
              Resend is connected. Optionally send a real test email to confirm delivery.
            </p>
            <TestEmailForm />
          </div>
        )}

        {/* Google OAuth note */}
        {state === 'done' && response?.results?.google && !response.results.google.ok && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h2 className="text-sm font-semibold text-blue-900 mb-1">Google OAuth Setup</h2>
            <p className="text-xs text-blue-700 leading-relaxed">
              Google credentials are configured but Gmail sending requires completing the OAuth flow.
              Visit <strong>/api/google-calendar/auth</strong> in your browser while logged into your
              Google Workspace account to authorize Gmail access. Once authorized, re-run this test.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
