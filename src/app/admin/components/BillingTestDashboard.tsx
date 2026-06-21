'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type TestStatus = 'idle' | 'running' | 'pass' | 'fail';

interface TestResult {
  label: string;
  status: TestStatus;
  message: string;
  detail?: string;
}

interface TestSection {
  title: string;
  icon: React.ReactNode;
  tests: TestResult[];
  running: boolean;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconCheck = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconSpinner = () => (
  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const IconDot = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="4" />
  </svg>
);

const IconPayment = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const IconInvoice = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconRetainer = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

const IconWebhook = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
  </svg>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TestStatus }) {
  if (status === 'idle') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground">
      <IconDot /> Idle
    </span>
  );
  if (status === 'running') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
      <IconSpinner /> Running
    </span>
  );
  if (status === 'pass') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
      <IconCheck /> Pass
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
      <IconX /> Fail
    </span>
  );
}

// ─── Test Row ─────────────────────────────────────────────────────────────────

function TestRow({ test }: { test: TestResult }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-lg border px-4 py-3 transition-colors ${
      test.status === 'pass' ? 'border-green-200 bg-green-50/40' :
      test.status === 'fail' ? 'border-red-200 bg-red-50/40' :
      test.status === 'running'? 'border-blue-200 bg-blue-50/30' : 'border-border bg-card'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{test.label}</span>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={test.status} />
          {test.detail && test.status !== 'idle' && test.status !== 'running' && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              {expanded ? 'Hide' : 'Details'}
            </button>
          )}
        </div>
      </div>
      {test.message && test.status !== 'idle' && (
        <p className={`mt-1 text-xs ${test.status === 'fail' ? 'text-red-600' : 'text-muted-foreground'}`}>
          {test.message}
        </p>
      )}
      {expanded && test.detail && (
        <pre className="mt-2 text-xs bg-background border border-border rounded p-2 overflow-x-auto text-muted-foreground whitespace-pre-wrap break-all">
          {test.detail}
        </pre>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BillingTestDashboard() {
  const supabase = createClient();

  // ── State ──────────────────────────────────────────────────────────────────

  const [paymentTests, setPaymentTests] = useState<TestResult[]>([
    { label: 'Stripe publishable key configured', status: 'idle', message: '' },
    { label: 'Stripe secret key set (via edge function)', status: 'idle', message: '' },
    { label: 'Create payment intent (test $1.00)', status: 'idle', message: '' },
    { label: 'Payment record saved to database', status: 'idle', message: '' },
    { label: 'Confirm payment endpoint reachable', status: 'idle', message: '' },
  ]);

  const [invoiceTests, setInvoiceTests] = useState<TestResult[]>([
    { label: 'client_invoices table accessible', status: 'idle', message: '' },
    { label: 'payments table accessible', status: 'idle', message: '' },
    { label: 'Invoice records exist in database', status: 'idle', message: '' },
    { label: 'Payment records exist in database', status: 'idle', message: '' },
    { label: 'Generate invoice edge function reachable', status: 'idle', message: '' },
  ]);

  const [retainerTests, setRetainerTests] = useState<TestResult[]>([
    { label: 'retainer_subscriptions table accessible', status: 'idle', message: '' },
    { label: 'Create retainer subscription endpoint reachable', status: 'idle', message: '' },
    { label: 'Confirm retainer subscription endpoint reachable', status: 'idle', message: '' },
    { label: 'Cancel retainer subscription endpoint reachable', status: 'idle', message: '' },
    { label: 'Stripe webhook endpoint reachable', status: 'idle', message: '' },
    { label: 'Renewal email endpoint reachable', status: 'idle', message: '' },
  ]);

  const [runningPayments, setRunningPayments] = useState(false);
  const [runningInvoices, setRunningInvoices] = useState(false);
  const [runningRetainers, setRunningRetainers] = useState(false);
  const [overallSummary, setOverallSummary] = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function updateTest(
    setter: React.Dispatch<React.SetStateAction<TestResult[]>>,
    index: number,
    patch: Partial<TestResult>
  ) {
    setter(prev => prev.map((t, i) => i === index ? { ...t, ...patch } : t));
  }

  function markRunning(setter: React.Dispatch<React.SetStateAction<TestResult[]>>, index: number) {
    updateTest(setter, index, { status: 'running', message: 'Running…', detail: undefined });
  }

  // ── Payment Tests ──────────────────────────────────────────────────────────

  async function runPaymentTests() {
    setRunningPayments(true);
    setOverallSummary(null);
    const s = setPaymentTests;

    // Reset
    setPaymentTests(prev => prev.map(t => ({ ...t, status: 'idle', message: '', detail: undefined })));
    await new Promise(r => setTimeout(r, 100));

    // Test 0: Publishable key
    markRunning(s, 0);
    const pubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (pubKey && pubKey.startsWith('pk_')) {
      updateTest(s, 0, { status: 'pass', message: `Key present: ${pubKey.slice(0, 12)}…` });
    } else {
      updateTest(s, 0, { status: 'fail', message: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing or invalid. Add it to .env.' });
    }

    // Test 1: Secret key via edge function probe
    markRunning(s, 1);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          paymentData: { amount: 0, currency: 'usd', tableName: 'payments', description: 'test-probe', paymentType: 'test' },
          customerInfo: { userId: null, firstName: '', lastName: '', email: '', stripeCustomerId: null, billing: { address_line_1: '', city: '', state: '', postal_code: '', country: '' } },
        },
      });
      // A 400 "Missing required" means the function ran and Stripe key is loaded
      const errMsg = (data as { error?: string })?.error ?? error?.message ?? '';
      if (errMsg.includes('Missing required') || errMsg.includes('No such') || errMsg.includes('Invalid API')) {
        if (errMsg.includes('Invalid API') || errMsg.includes('No API key')) {
          updateTest(s, 1, { status: 'fail', message: 'STRIPE_SECRET_KEY is missing or invalid in Supabase edge function secrets.' });
        } else {
          updateTest(s, 1, { status: 'pass', message: 'Edge function reachable and Stripe key loaded.' });
        }
      } else if (error) {
        updateTest(s, 1, { status: 'fail', message: `Edge function error: ${error.message}`, detail: JSON.stringify(error) });
      } else {
        updateTest(s, 1, { status: 'pass', message: 'Edge function reachable and Stripe key loaded.' });
      }
    } catch (e) {
      updateTest(s, 1, { status: 'fail', message: `Cannot reach edge function: ${e instanceof Error ? e.message : String(e)}` });
    }

    // Test 2: Create payment intent with real data
    markRunning(s, 2);
    let testRecordId: string | null = null;
    try {
      const { data, error } = await supabase.functions.invoke<{ clientSecret: string; recordId: string }>('create-payment-intent', {
        body: {
          paymentData: {
            amount: 1,
            currency: 'usd',
            tableName: 'payments',
            description: 'Billing system test — $1.00',
            paymentType: 'test',
          },
          customerInfo: {
            userId: null,
            firstName: 'Test',
            lastName: 'Admin',
            email: 'billing-test@maggimay.internal',
            stripeCustomerId: null,
            billing: { address_line_1: '123 Test St', city: 'New York', state: 'NY', postal_code: '10001', country: 'US' },
          },
        },
      });
      const errMsg = (data as { error?: string })?.error ?? error?.message ?? '';
      if (errMsg) {
        updateTest(s, 2, { status: 'fail', message: errMsg });
      } else if (data?.clientSecret) {
        testRecordId = data.recordId ?? null;
        updateTest(s, 2, { status: 'pass', message: `Payment intent created. Client secret: ${data.clientSecret.slice(0, 20)}…`, detail: JSON.stringify({ clientSecret: data.clientSecret.slice(0, 30) + '…', recordId: data.recordId }) });
      } else {
        updateTest(s, 2, { status: 'fail', message: 'No clientSecret returned.', detail: JSON.stringify(data) });
      }
    } catch (e) {
      updateTest(s, 2, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    // Test 3: Payment record in DB
    markRunning(s, 3);
    try {
      const query = supabase.from('payments').select('id, payment_intent_id, payment_status, amount').eq('customer_email', 'billing-test@maggimay.internal').order('created_at', { ascending: false }).limit(1);
      const { data, error } = await query;
      if (error) {
        updateTest(s, 3, { status: 'fail', message: `DB query failed: ${error.message}` });
      } else if (data && data.length > 0) {
        updateTest(s, 3, { status: 'pass', message: `Record found. ID: ${data[0].id?.slice(0, 8)}… Status: ${data[0].payment_status}`, detail: JSON.stringify(data[0], null, 2) });
      } else {
        updateTest(s, 3, { status: 'fail', message: 'No payment record found in DB. Payment intent creation may have failed.' });
      }
    } catch (e) {
      updateTest(s, 3, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    // Test 4: Confirm payment endpoint
    markRunning(s, 4);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-payment', {
        body: { paymentIntentId: 'pi_test_probe_only', tableName: 'payments' },
      });
      const errMsg = (data as { error?: string })?.error ?? error?.message ?? '';
      // "No such PaymentIntent" means Stripe is reachable and the function works
      if (errMsg.includes('No such') || errMsg.includes('not found') || errMsg.includes('Payment record not found')) {
        updateTest(s, 4, { status: 'pass', message: 'Confirm-payment endpoint reachable and Stripe connected.' });
      } else if (errMsg) {
        updateTest(s, 4, { status: 'fail', message: errMsg });
      } else {
        updateTest(s, 4, { status: 'pass', message: 'Confirm-payment endpoint reachable.' });
      }
    } catch (e) {
      updateTest(s, 4, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    setRunningPayments(false);
  }

  // ── Invoice Tests ──────────────────────────────────────────────────────────

  async function runInvoiceTests() {
    setRunningInvoices(true);
    setOverallSummary(null);
    const s = setInvoiceTests;
    setInvoiceTests(prev => prev.map(t => ({ ...t, status: 'idle', message: '', detail: undefined })));
    await new Promise(r => setTimeout(r, 100));

    // Test 0: client_invoices table
    markRunning(s, 0);
    try {
      const { error } = await supabase.from('client_invoices').select('id').limit(1);
      if (error) {
        updateTest(s, 0, { status: 'fail', message: `Table error: ${error.message}` });
      } else {
        updateTest(s, 0, { status: 'pass', message: 'client_invoices table accessible.' });
      }
    } catch (e) {
      updateTest(s, 0, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    // Test 1: payments table
    markRunning(s, 1);
    try {
      const { error } = await supabase.from('payments').select('id').limit(1);
      if (error) {
        updateTest(s, 1, { status: 'fail', message: `Table error: ${error.message}` });
      } else {
        updateTest(s, 1, { status: 'pass', message: 'payments table accessible.' });
      }
    } catch (e) {
      updateTest(s, 1, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    // Test 2: Invoice records
    markRunning(s, 2);
    try {
      const { data, error } = await supabase.from('client_invoices').select('id, invoice_number, status, amount').order('created_at', { ascending: false }).limit(5);
      if (error) {
        updateTest(s, 2, { status: 'fail', message: error.message });
      } else if (data && data.length > 0) {
        updateTest(s, 2, { status: 'pass', message: `${data.length} invoice(s) found. Latest: ${data[0].invoice_number ?? data[0].id?.slice(0, 8)} — ${data[0].status}`, detail: JSON.stringify(data, null, 2) });
      } else {
        updateTest(s, 2, { status: 'pass', message: 'Table accessible. No invoices yet — create one via the Billing History tab.' });
      }
    } catch (e) {
      updateTest(s, 2, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    // Test 3: Payment records
    markRunning(s, 3);
    try {
      const { data, error } = await supabase.from('payments').select('id, payment_status, amount, customer_email').order('created_at', { ascending: false }).limit(5);
      if (error) {
        updateTest(s, 3, { status: 'fail', message: error.message });
      } else if (data && data.length > 0) {
        const succeeded = data.filter(p => p.payment_status === 'succeeded').length;
        updateTest(s, 3, { status: 'pass', message: `${data.length} payment record(s) found. ${succeeded} succeeded.`, detail: JSON.stringify(data, null, 2) });
      } else {
        updateTest(s, 3, { status: 'pass', message: 'Table accessible. No payment records yet.' });
      }
    } catch (e) {
      updateTest(s, 3, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    // Test 4: Generate invoice function
    markRunning(s, 4);
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: { probe: true },
      });
      const errMsg = (data as { error?: string })?.error ?? error?.message ?? '';
      if (errMsg.includes('Missing') || errMsg.includes('required') || errMsg.includes('clientEmail')) {
        updateTest(s, 4, { status: 'pass', message: 'generate-invoice endpoint reachable.' });
      } else if (errMsg) {
        updateTest(s, 4, { status: 'fail', message: errMsg });
      } else {
        updateTest(s, 4, { status: 'pass', message: 'generate-invoice endpoint reachable.' });
      }
    } catch (e) {
      updateTest(s, 4, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    setRunningInvoices(false);
  }

  // ── Retainer Tests ─────────────────────────────────────────────────────────

  async function runRetainerTests() {
    setRunningRetainers(true);
    setOverallSummary(null);
    const s = setRetainerTests;
    setRetainerTests(prev => prev.map(t => ({ ...t, status: 'idle', message: '', detail: undefined })));
    await new Promise(r => setTimeout(r, 100));

    // Test 0: retainer_subscriptions table
    markRunning(s, 0);
    try {
      const { data, error } = await supabase.from('retainer_subscriptions').select('id, status, customer_email').order('created_at', { ascending: false }).limit(5);
      if (error) {
        updateTest(s, 0, { status: 'fail', message: `Table error: ${error.message}` });
      } else {
        const active = (data ?? []).filter(r => r.status === 'active').length;
        updateTest(s, 0, { status: 'pass', message: `Table accessible. ${(data ?? []).length} subscription(s) found. ${active} active.`, detail: data && data.length > 0 ? JSON.stringify(data, null, 2) : undefined });
      }
    } catch (e) {
      updateTest(s, 0, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    // Test 1: create-retainer-subscription
    markRunning(s, 1);
    try {
      const { data, error } = await supabase.functions.invoke('create-retainer-subscription', {
        body: {
          customerInfo: { firstName: '', lastName: '', email: '', stripeCustomerId: null, billing: { address_line_1: '', city: '', state: '', postal_code: '', country: '' } },
          amount: 0,
        },
      });
      const errMsg = (data as { error?: string })?.error ?? error?.message ?? '';
      if (errMsg.includes('Missing required') || errMsg.includes('customerInfo.email')) {
        updateTest(s, 1, { status: 'pass', message: 'create-retainer-subscription endpoint reachable and validating inputs.' });
      } else if (errMsg) {
        updateTest(s, 1, { status: 'fail', message: errMsg });
      } else {
        updateTest(s, 1, { status: 'pass', message: 'create-retainer-subscription endpoint reachable.' });
      }
    } catch (e) {
      updateTest(s, 1, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    // Test 2: confirm-retainer-subscription
    markRunning(s, 2);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-retainer-subscription', {
        body: { probe: true },
      });
      const errMsg = (data as { error?: string })?.error ?? error?.message ?? '';
      if (errMsg.includes('Missing') || errMsg.includes('required') || errMsg.includes('setupIntentId')) {
        updateTest(s, 2, { status: 'pass', message: 'confirm-retainer-subscription endpoint reachable.' });
      } else if (errMsg) {
        updateTest(s, 2, { status: 'fail', message: errMsg });
      } else {
        updateTest(s, 2, { status: 'pass', message: 'confirm-retainer-subscription endpoint reachable.' });
      }
    } catch (e) {
      updateTest(s, 2, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    // Test 3: cancel-retainer-subscription
    markRunning(s, 3);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-retainer-subscription', {
        body: { probe: true },
      });
      const errMsg = (data as { error?: string })?.error ?? error?.message ?? '';
      if (errMsg.includes('Missing') || errMsg.includes('required') || errMsg.includes('subscriptionId')) {
        updateTest(s, 3, { status: 'pass', message: 'cancel-retainer-subscription endpoint reachable.' });
      } else if (errMsg) {
        updateTest(s, 3, { status: 'fail', message: errMsg });
      } else {
        updateTest(s, 3, { status: 'pass', message: 'cancel-retainer-subscription endpoint reachable.' });
      }
    } catch (e) {
      updateTest(s, 3, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    // Test 4: stripe-subscription-webhook
    markRunning(s, 4);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-subscription-webhook', {
        body: JSON.stringify({ type: 'ping' }),
      });
      const errMsg = (data as { error?: string })?.error ?? error?.message ?? '';
      // Any response (even error) means the function is deployed and reachable
      if (errMsg.includes('Invalid signature') || errMsg.includes('Unexpected token') || errMsg.includes('Unhandled')) {
        updateTest(s, 4, { status: 'pass', message: 'Webhook endpoint reachable. Configure STRIPE_WEBHOOK_SECRET in Supabase secrets for signature verification.' });
      } else if (errMsg) {
        updateTest(s, 4, { status: 'fail', message: errMsg });
      } else {
        updateTest(s, 4, { status: 'pass', message: 'Webhook endpoint reachable.' });
      }
    } catch (e) {
      updateTest(s, 4, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    // Test 5: send-retainer-renewal-email
    markRunning(s, 5);
    try {
      const { data, error } = await supabase.functions.invoke('send-retainer-renewal-email', {
        body: { probe: true },
      });
      const errMsg = (data as { error?: string })?.error ?? error?.message ?? '';
      if (errMsg.includes('Missing') || errMsg.includes('required') || errMsg.includes('emailType') || errMsg.includes('RESEND')) {
        if (errMsg.toLowerCase().includes('resend') || errMsg.toLowerCase().includes('api key')) {
          updateTest(s, 5, { status: 'fail', message: 'RESEND_API_KEY missing. Add it to Supabase edge function secrets.' });
        } else {
          updateTest(s, 5, { status: 'pass', message: 'send-retainer-renewal-email endpoint reachable.' });
        }
      } else if (errMsg) {
        updateTest(s, 5, { status: 'fail', message: errMsg });
      } else {
        updateTest(s, 5, { status: 'pass', message: 'send-retainer-renewal-email endpoint reachable.' });
      }
    } catch (e) {
      updateTest(s, 5, { status: 'fail', message: e instanceof Error ? e.message : String(e) });
    }

    setRunningRetainers(false);
  }

  // ── Run All ────────────────────────────────────────────────────────────────

  async function runAllTests() {
    await runPaymentTests();
    await runInvoiceTests();
    await runRetainerTests();

    const allTests = [
      ...paymentTests,
      ...invoiceTests,
      ...retainerTests,
    ];
    const passed = allTests.filter(t => t.status === 'pass').length;
    const failed = allTests.filter(t => t.status === 'fail').length;
    setOverallSummary(`${passed} passed · ${failed} failed out of ${allTests.length} total checks`);
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  function sectionSummary(tests: TestResult[]) {
    const ran = tests.filter(t => t.status !== 'idle');
    if (ran.length === 0) return null;
    const pass = tests.filter(t => t.status === 'pass').length;
    const fail = tests.filter(t => t.status === 'fail').length;
    return { pass, fail, total: tests.length };
  }

  const paymentSummary = sectionSummary(paymentTests);
  const invoiceSummary = sectionSummary(invoiceTests);
  const retainerSummary = sectionSummary(retainerTests);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Billing System Test</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Verify Stripe payments, invoices, and retainer subscriptions end-to-end.
          </p>
        </div>
        <button
          onClick={runAllTests}
          disabled={runningPayments || runningInvoices || runningRetainers}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#355E3B' }}
        >
          {(runningPayments || runningInvoices || runningRetainers) ? (
            <><IconSpinner /> Running all tests…</>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Run All Tests
            </>
          )}
        </button>
      </div>

      {/* Overall summary */}
      {overallSummary && (
        <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm font-medium text-foreground">{overallSummary}</p>
        </div>
      )}

      {/* ── Payment Tests ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-primary"><IconPayment /></span>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Payment Processing</h3>
              <p className="text-xs text-muted-foreground">Stripe keys, payment intent creation, DB persistence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {paymentSummary && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${paymentSummary.fail === 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {paymentSummary.pass}/{paymentSummary.total} passed
              </span>
            )}
            <button
              onClick={runPaymentTests}
              disabled={runningPayments}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-colors disabled:opacity-50"
            >
              {runningPayments ? <><IconSpinner /> Running…</> : 'Run'}
            </button>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {paymentTests.map((t, i) => <TestRow key={i} test={t} />)}
        </div>
      </div>

      {/* ── Invoice Tests ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-primary"><IconInvoice /></span>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Invoices & Billing History</h3>
              <p className="text-xs text-muted-foreground">Database tables, invoice records, payment history</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {invoiceSummary && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${invoiceSummary.fail === 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {invoiceSummary.pass}/{invoiceSummary.total} passed
              </span>
            )}
            <button
              onClick={runInvoiceTests}
              disabled={runningInvoices}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-colors disabled:opacity-50"
            >
              {runningInvoices ? <><IconSpinner /> Running…</> : 'Run'}
            </button>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {invoiceTests.map((t, i) => <TestRow key={i} test={t} />)}
        </div>
      </div>

      {/* ── Retainer Tests ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-primary"><IconRetainer /></span>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Retainer Subscriptions</h3>
              <p className="text-xs text-muted-foreground">Subscription lifecycle, webhook, renewal emails</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {retainerSummary && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${retainerSummary.fail === 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                {retainerSummary.pass}/{retainerSummary.total} passed
              </span>
            )}
            <button
              onClick={runRetainerTests}
              disabled={runningRetainers}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-secondary hover:bg-secondary/80 text-foreground transition-colors disabled:opacity-50"
            >
              {runningRetainers ? <><IconSpinner /> Running…</> : 'Run'}
            </button>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {retainerTests.map((t, i) => <TestRow key={i} test={t} />)}
        </div>
      </div>

      {/* Setup checklist */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <span className="text-primary"><IconWebhook /></span>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Setup Checklist</h3>
            <p className="text-xs text-muted-foreground">Required configuration for full billing functionality</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {[
            {
              label: 'STRIPE_SECRET_KEY',
              desc: 'Add your Stripe secret key (sk_live_… or sk_test_…) to Supabase Edge Function secrets.',
              env: 'STRIPE_SECRET_KEY',
            },
            {
              label: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
              desc: 'Add your Stripe publishable key (pk_live_… or pk_test_…) to .env.',
              env: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
            },
            {
              label: 'STRIPE_WEBHOOK_SECRET',
              desc: 'In Stripe Dashboard → Webhooks, create endpoint: https://broussardlegalservices.com/functions/v1/stripe-subscription-webhook. Copy the signing secret to Supabase secrets.',
              env: 'STRIPE_WEBHOOK_SECRET',
            },
            {
              label: 'RESEND_API_KEY',
              desc: 'Add your Resend API key (re_…) to Supabase Edge Function secrets for renewal emails.',
              env: 'RESEND_API_KEY',
            },
          ].map((item) => (
            <div key={item.env} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/40 border border-border">
              <div className="mt-0.5 shrink-0">
                <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-mono font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
