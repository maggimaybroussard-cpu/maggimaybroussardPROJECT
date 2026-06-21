'use client';

import React, { useState } from 'react';

export interface PaymentMethodsPanelProps {
  /** Amount in dollars (e.g. 150.00) */
  amount: number;
  currency?: string;
  description?: string;
  invoiceNumber?: string;
  /** Called when user picks a Stripe-based method (card / saved card / Google Pay / Apple Pay) */
  onStripeCard: () => void;
  /** Called when user picks ACH bank transfer */
  onACH: () => void;
  /** Called when user picks payment plan (only shown when amount >= 200) */
  onPlan?: () => void;
  /** Business Venmo handle, e.g. "@BroussardLegal" */
  venmoHandle?: string;
  /** Business Cash App $cashtag, e.g. "$BroussardLegal" */
  cashAppTag?: string;
  /** Business Zelle phone or email */
  zelleContact?: string;
  /** Business PayPal.me link, e.g. "paypal.me/BroussardLegal" */
  paypalLink?: string;
  className?: string;
}

function formatCurrency(amount: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const CardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const BankIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
  </svg>
);

const PlanIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const CheckSmIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ── App-specific brand icons (SVG inline) ─────────────────────────────────────

const CashAppIcon = () => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#00D64F"/>
    <path d="M26.5 10.5l-1.2 1.2c-1.4-1.1-3.1-1.7-5.3-1.7-4.8 0-8.5 3.7-8.5 8.5 0 2.2.8 4.2 2.1 5.7l-1.2 1.2 1.4 1.4 1.2-1.2c1.4 1.1 3.1 1.7 5 1.7 4.8 0 8.5-3.7 8.5-8.5 0-2-.7-3.8-1.8-5.2l1.2-1.2-1.4-1.9zm-6.5 14.5c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6zm1-9.5h-2v-2h2v2zm0 6h-2v-4h2v4z" fill="white"/>
  </svg>
);

const VenmoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#3D95CE"/>
    <path d="M28 10c.7 1.2 1 2.5 1 4.1 0 5.1-4.4 11.7-8 16H13L9 10h7l2.3 9.3C20.1 16.5 22 12.5 22 10H28z" fill="white"/>
  </svg>
);

const ZelleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#6D1ED4"/>
    <path d="M27 12H16l-4 5h10l-9 11h13l3-4h-9l9-12z" fill="white"/>
  </svg>
);

const PayPalIcon = () => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="#003087"/>
    <path d="M28 14c0 3.3-2.2 5.5-5.5 5.5H20l-1 6H15l2.5-15h6c2.5 0 4.5 1.6 4.5 3.5z" fill="#009CDE"/>
    <path d="M24 18c0 3.3-2.2 5.5-5.5 5.5H16l-1 6H11l2.5-15h6c2.5 0 4.5 1.6 4.5 3.5z" fill="white"/>
  </svg>
);

const GooglePayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="white" stroke="#E0E0E0"/>
    <text x="5" y="26" fontFamily="Arial" fontWeight="bold" fontSize="11" fill="#4285F4">G</text>
    <text x="13" y="26" fontFamily="Arial" fontWeight="bold" fontSize="11" fill="#EA4335">P</text>
    <text x="21" y="26" fontFamily="Arial" fontWeight="bold" fontSize="11" fill="#FBBC05">a</text>
    <text x="28" y="26" fontFamily="Arial" fontWeight="bold" fontSize="11" fill="#34A853">y</text>
  </svg>
);

const ApplePayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="8" fill="black"/>
    <path d="M20 8c-1.5 0-3 .8-3.8 2-.7 1.1-.9 2.5-.5 3.7-1.2.1-2.3.7-3.1 1.6-.8 1-1.1 2.2-.9 3.4.2 1.2.9 2.3 1.9 3 .5.3 1 .5 1.6.5.6 0 1.2-.2 1.7-.5.5-.3 1.1-.5 1.7-.5.6 0 1.2.2 1.7.5.5.3 1.1.5 1.7.5.6 0 1.1-.2 1.6-.5 1-.7 1.7-1.8 1.9-3 .2-1.2-.1-2.4-.9-3.4-.8-.9-1.9-1.5-3.1-1.6.4-1.2.2-2.6-.5-3.7C23 8.8 21.5 8 20 8z" fill="white"/>
  </svg>
);

// ── Sub-components ────────────────────────────────────────────────────────────

interface AppPayButtonProps {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  href?: string;
  handle?: string;
  onCopy?: () => void;
  copied?: boolean;
  color: string;
  textColor?: string;
}

function AppPayButton({ icon, label, sublabel, href, handle, onCopy, copied, color, textColor = '#fff' }: AppPayButtonProps) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-2xl border border-border bg-card hover:border-foreground/20 transition-all">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '18' }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground font-light truncate">{sublabel}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all hover:opacity-90"
            style={{ background: color, color: textColor }}
          >
            Open App
            <ExternalLinkIcon />
          </a>
        )}
        {handle && onCopy && (
          <button
            onClick={onCopy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            {copied ? <><CheckSmIcon /> Copied!</> : <><CopyIcon /> Copy {handle}</>}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PaymentMethodsPanel({
  amount,
  currency = 'usd',
  description,
  invoiceNumber,
  onStripeCard,
  onACH,
  onPlan,
  venmoHandle = '@BroussardLegal',
  cashAppTag = '$BroussardLegal',
  zelleContact = 'maggimaybroussard@gmail.com',
  paypalLink,
  className = '',
}: PaymentMethodsPanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAppMethods, setShowAppMethods] = useState(false);

  const amountStr = formatCurrency(amount, currency);
  const memo = encodeURIComponent(
    description
      ? description
      : invoiceNumber
      ? `Invoice ${invoiceNumber}`
      : `Legal Services - ${amountStr}`
  );
  const amountCents = Math.round(amount * 100);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Deep links
  const venmoDeepLink = `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(venmoHandle)}&amount=${amount}&note=${memo}`;
  const venmoWebLink = `https://venmo.com/${venmoHandle.replace('@', '')}?txn=pay&amount=${amount}&note=${memo}`;
  const cashAppDeepLink = `https://cash.app/${cashAppTag.replace('$', '%24')}/${amount}`;
  const zelleDeepLink = `https://enroll.zellepay.com/qr-codes?data=${encodeURIComponent(JSON.stringify({ name: 'Broussard Legal', token: zelleContact, type: 'EMAIL' }))}`;
  const paypalDeepLink = paypalLink
    ? `https://${paypalLink}/${amount}?currency_code=${currency.toUpperCase()}&item_name=${memo}`
    : null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Choose Payment Method</h3>
          <p className="text-xs text-muted-foreground font-light mt-0.5">
            {amountStr} {invoiceNumber ? `· Invoice ${invoiceNumber}` : ''}
          </p>
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(53,94,59,0.1)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
        </div>
      </div>

      {/* Primary Stripe Methods */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-0.5">Secure Online Payment</p>

        {/* Card / Saved Card / Google Pay / Apple Pay */}
        <button
          onClick={onStripeCard}
          className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-foreground/20 hover:bg-secondary/30 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.1)' }}>
            <CardIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Card · Google Pay · Apple Pay</p>
            <p className="text-xs text-muted-foreground font-light">Credit/debit card, saved card, or digital wallet</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mini card brand icons */}
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">VISA</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold border border-red-200">MC</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:text-foreground transition-colors ml-1">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </button>

        {/* ACH Bank Transfer */}
        <button
          onClick={onACH}
          className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-foreground/20 hover:bg-secondary/30 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(53,94,59,0.1)' }}>
            <BankIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Bank Transfer (ACH)</p>
            <p className="text-xs text-muted-foreground font-light">Connect your bank account · Settles in 1–3 days</p>
          </div>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* Payment Plan */}
        {onPlan && amount >= 200 && (
          <button
            onClick={onPlan}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-foreground/20 hover:bg-secondary/30 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(200,150,90,0.12)' }}>
              <PlanIcon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Payment Plan</p>
              <p className="text-xs text-muted-foreground font-light">Split into 2–6 installments · Monthly, biweekly, or weekly</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full border font-semibold shrink-0" style={{ borderColor: 'rgba(200,150,90,0.4)', color: '#C8965A', background: 'rgba(200,150,90,0.08)' }}>
              Flexible
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}
      </div>

      {/* App-based Payment Methods (collapsible) */}
      <div className="border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowAppMethods(!showAppMethods)}
          className="w-full flex items-center justify-between px-4 py-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pay via App</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground font-medium">Cash App · Venmo · Zelle · PayPal</span>
          </div>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-muted-foreground transition-transform duration-200 ${showAppMethods ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {showAppMethods && (
          <div className="p-4 space-y-3">
            {/* Instructions banner */}
            <div className="flex items-start gap-3 p-3 rounded-xl border" style={{ background: 'rgba(53,94,59,0.04)', borderColor: 'rgba(53,94,59,0.15)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#355E3B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">
                Tap <strong className="font-semibold text-foreground">Open App</strong> to launch the payment app, or copy the handle/contact to search manually. Include your invoice number in the memo: <span className="font-mono font-semibold text-foreground">{invoiceNumber ?? description ?? 'Invoice'}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Cash App */}
              <AppPayButton
                icon={<CashAppIcon />}
                label="Cash App"
                sublabel={cashAppTag}
                href={cashAppDeepLink}
                handle={cashAppTag}
                onCopy={() => handleCopy('cashapp', cashAppTag)}
                copied={copiedKey === 'cashapp'}
                color="#00D64F"
                textColor="#fff"
              />

              {/* Venmo */}
              <AppPayButton
                icon={<VenmoIcon />}
                label="Venmo"
                sublabel={venmoHandle}
                href={venmoWebLink}
                handle={venmoHandle}
                onCopy={() => handleCopy('venmo', venmoHandle)}
                copied={copiedKey === 'venmo'}
                color="#3D95CE"
                textColor="#fff"
              />

              {/* Zelle */}
              <AppPayButton
                icon={<ZelleIcon />}
                label="Zelle"
                sublabel={zelleContact}
                href={zelleDeepLink}
                handle={zelleContact}
                onCopy={() => handleCopy('zelle', zelleContact)}
                copied={copiedKey === 'zelle'}
                color="#6D1ED4"
                textColor="#fff"
              />

              {/* PayPal */}
              {paypalDeepLink ? (
                <AppPayButton
                  icon={<PayPalIcon />}
                  label="PayPal"
                  sublabel="Pay via PayPal"
                  href={paypalDeepLink}
                  color="#003087"
                  textColor="#fff"
                />
              ) : (
                <div className="flex flex-col gap-2 p-4 rounded-2xl border border-border bg-card opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-secondary/40">
                      <PayPalIcon />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">PayPal</p>
                      <p className="text-xs text-muted-foreground font-light">Contact us for PayPal link</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Google Pay standalone note */}
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/20">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white border border-gray-200">
                <GooglePayIcon />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground">Google Pay &amp; Apple Pay</p>
                <p className="text-xs text-muted-foreground font-light">Available automatically in the <strong className="font-semibold">Card</strong> payment option above — no extra steps needed.</p>
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-black border border-gray-800">
                <ApplePayIcon />
              </div>
            </div>

            {/* Amount reminder */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
              <p className="text-xs text-muted-foreground font-light">Amount to send</p>
              <p className="text-sm font-semibold" style={{ color: '#355E3B' }}>{amountStr}</p>
            </div>
          </div>
        )}
      </div>

      {/* Security note */}
      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Stripe-powered payments are SSL encrypted · PCI DSS compliant
      </p>
    </div>
  );
}
