'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCodeImage from '@/components/ui/QRCodeImage';

import {
  trackFormStart,
  trackFieldInteraction,
  trackServiceSelected,
  trackFormSubmitAttempt,
  trackFormSuccess,
  trackFormError,
  trackContactFormSubmit,
  trackLeadQuality,
  trackRetainerTierInterest,
  trackContactFormSubmission,
} from '@/lib/analytics';

// ─── Service keyword mapping ───────────────────────────────────────────────────

const SERVICE_KEYWORDS: Record<string, string[]> = {
  'Litigation Support': [
    'litigation', 'trial', 'court', 'lawsuit', 'plaintiff', 'defendant',
    'discovery', 'deposition', 'motion', 'brief', 'pleading', 'complaint',
    'summons', 'subpoena', 'hearing', 'appeal', 'settlement', 'mediation',
    'arbitration', 'evidence', 'exhibit', 'witness', 'docket', 'filing',
  ],
  'Contract Review': [
    'contract', 'agreement', 'clause', 'terms', 'provision', 'review',
    'negotiate', 'negotiation', 'vendor', 'client agreement', 'nda',
    'non-disclosure', 'confidentiality', 'indemnification', 'liability',
    'warranty', 'breach', 'enforce', 'amendment', 'addendum', 'renewal',
  ],
  'Legal Research': [
    'research', 'case law', 'statute', 'regulation', 'precedent', 'legal analysis',
    'memo', 'memorandum', 'opinion', 'jurisdiction', 'cite', 'citation',
    'westlaw', 'lexis', 'brief research', 'legal question', 'authority',
    'code', 'ordinance', 'rule', 'standard',
  ],
  'Document Drafting': [
    'draft', 'drafting', 'prepare', 'write', 'document', 'letter',
    'correspondence', 'template', 'form', 'affidavit', 'declaration',
    'stipulation', 'order', 'notice', 'demand', 'response', 'answer',
    'petition', 'motion draft', 'letter of intent',
  ],
  'Case Management': [
    'case management', 'organize', 'track', 'deadline', 'calendar',
    'docket management', 'file management', 'status', 'update',
    'coordinate', 'schedule', 'manage', 'oversight', 'workflow',
    'intake', 'onboard', 'client management', 'matter management',
  ],
  'Deposition Prep': [
    'deposition', 'depose', 'witness prep', 'prepare witness', 'cross examination',
    'direct examination', 'deponent', 'transcript', 'deposition summary',
    'outline', 'question outline', 'deposition notice', 'depo prep',
  ],
};

// ─── Paralegal profiles ────────────────────────────────────────────────────────

interface ParalegalProfile {
  name: string;
  specialties: string[];
  availability: string;
  initials: string;
}

const PARALEGAL_PROFILES: ParalegalProfile[] = [
  {
    name: 'Maggi May Broussard',
    specialties: ['Litigation Support', 'Document Drafting', 'Deposition Prep'],
    availability: 'Mon–Fri, 8am–6pm CT',
    initials: 'MB',
  },
  {
    name: 'Contract & Research Team',
    specialties: ['Contract Review', 'Legal Research'],
    availability: 'Mon–Fri, 9am–5pm CT',
    initials: 'CR',
  },
  {
    name: 'Case Management Team',
    specialties: ['Case Management'],
    availability: 'Mon–Fri, 8am–6pm CT',
    initials: 'CM',
  },
];

// ─── Suggestion engine ─────────────────────────────────────────────────────────

interface Suggestion {
  service: string;
  paralegal: ParalegalProfile;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords: string[];
}

function analyzeSuggestion(message: string): Suggestion | null {
  if (!message || message.trim().length < 10) return null;

  const lower = message.toLowerCase();
  const scores: Record<string, { count: number; keywords: string[] }> = {};

  for (const [service, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    const matched: string[] = [];
    for (const kw of keywords) {
      if (lower.includes(kw)) matched.push(kw);
    }
    if (matched.length > 0) {
      scores[service] = { count: matched.length, keywords: matched };
    }
  }

  if (Object.keys(scores).length === 0) return null;

  // Pick the service with the most keyword matches
  const topService = Object.entries(scores).sort((a, b) => b[1].count - a[1].count)[0];
  const [service, scoreData] = topService;
  const count = scoreData.count;
  const matchedKeywords = scoreData.keywords;

  const confidence: Suggestion['confidence'] =
    count >= 3 ? 'high' : count === 2 ? 'medium' : 'low';

  // Match paralegal by specialty
  const paralegal =
    PARALEGAL_PROFILES.find((p) => p.specialties.includes(service)) ??
    PARALEGAL_PROFILES[0];

  return { service, paralegal, confidence, matchedKeywords };
}

// ─── Retainer tier type ────────────────────────────────────────────────────────

type RetainerTier = 'starter' | 'standard' | 'growth' | 'project' | '';

// ─── Types ─────────────────────────────────────────────────────────────────────

const serviceOptions = [
  'Litigation Support',
  'Contract Review',
  'Legal Research',
  'Document Drafting',
  'Case Management',
  'Deposition Prep',
  'Other / Multiple Services',
];

const contactDetails = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
    label: 'Email',
    value: 'broussardlegalservices@gmail.com',
    href: 'mailto:broussardlegalservices@gmail.com',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
    label: 'Phone',
    value: '1-504-458-2831',
    href: 'tel:+15044582831',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
      </svg>
    ),
    label: 'WhatsApp',
    value: '1-844-493-6819',
    href: 'https://wa.me/18444936819',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    ),
    label: 'Location',
    value: 'Broussard Legal Services · 900 Camp Street Suite 3rd Fl. PMB 70111, New Orleans, LA 70130',
    href: 'https://maps.google.com/?q=900+Camp+Street+Suite+3rd+Fl+PMB+70111+New+Orleans+LA+70130',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    label: 'Availability',
    value: 'Mon–Fri, 8am–6pm CT · Remote',
    href: null,
  },
];

interface FormState {
  name: string;
  firm: string;
  email: string;
  service: string;
  message: string;
  retainerTier: RetainerTier;
}

interface FormErrors {
  name?: string;
  firm?: string;
  email?: string;
  service?: string;
  message?: string;
}

interface TouchedFields {
  name?: boolean;
  firm?: boolean;
  email?: boolean;
  service?: boolean;
  message?: boolean;
}

interface ToastState {
  visible: boolean;
  type: 'success' | 'error';
  message: string;
}

function validateField(name: keyof FormState, value: string): string {
  switch (name) {
    case 'name':
      if (!value.trim()) return 'Your name is required.';
      if (value.trim().length < 2) return 'Name must be at least 2 characters.';
      return '';
    case 'firm':
      if (!value.trim()) return 'Firm or company name is required.';
      if (value.trim().length < 2) return 'Firm name must be at least 2 characters.';
      return '';
    case 'email':
      if (!value.trim()) return 'Email address is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address.';
      return '';
    case 'service':
      if (!value) return 'Please select a service.';
      return '';
    case 'message':
      if (!value.trim()) return 'A message is required.';
      if (value.trim().length < 20) return 'Message must be at least 20 characters.';
      return '';
    default:
      return '';
  }
}

function validateAll(formState: FormState): FormErrors {
  const errors: FormErrors = {};
  (Object.keys(formState) as (keyof FormState)[]).forEach((key) => {
    const error = validateField(key, formState[key]);
    if (error) errors[key] = error;
  });
  return errors;
}

// ─── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: Suggestion['confidence'] }) {
  const map = {
    high: { label: 'Strong match', cls: 'bg-emerald-100 text-emerald-700' },
    medium: { label: 'Likely match', cls: 'bg-amber-100 text-amber-700' },
    low: { label: 'Possible match', cls: 'bg-blue-100 text-blue-700' },
  };
  const { label, cls } = map[confidence];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

// ─── Suggestion card ───────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: (service: string, paralegal: string) => void;
  onDismiss: () => void;
}

function SuggestionCard({ suggestion, onAccept, onDismiss }: SuggestionCardProps) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-accent shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
          </div>
          <p className="text-xs font-semibold text-foreground">Smart Suggestions</p>
          <ConfidenceBadge confidence={suggestion.confidence} />
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Dismiss suggestions"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Suggestions row */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Service suggestion */}
        <div className="bg-background/70 border border-border rounded-lg p-3 flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Suggested Service</p>
          <p className="text-sm font-semibold text-foreground">{suggestion.service}</p>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {suggestion.matchedKeywords.slice(0, 3).map((kw) => (
              <span key={kw} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-medium">
                {kw}
              </span>
            ))}
          </div>
        </div>

        {/* Paralegal suggestion */}
        <div className="bg-background/70 border border-border rounded-lg p-3 flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Suggested Paralegal</p>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
              {suggestion.paralegal.initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">{suggestion.paralegal.name}</p>
              <p className="text-[10px] text-muted-foreground">{suggestion.paralegal.availability}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => onAccept(suggestion.service, suggestion.paralegal.name)}
          className="flex-1 py-2 bg-accent text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Apply Suggestions
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          Ignore
        </button>
      </div>
    </div>
  );
}

// ─── Retainer tiers ────────────────────────────────────────────────────────────

interface TierConfig {
  id: RetainerTier;
  label: string;
  price: string;
  hours: string;
  description: string;
  services: string[];
  billingNote: string;
}

const RETAINER_TIERS: TierConfig[] = [
  {
    id: 'starter',
    label: 'Starter',
    price: '$650/mo',
    hours: '10 hrs/mo',
    description: 'Occasional support for solo practitioners',
    services: ['Document Drafting', 'Legal Research', 'Contract Review'],
    billingNote: 'Invoiced on the 1st · Due within 7 days · Cancel with 15-day notice',
  },
  {
    id: 'standard',
    label: 'Standard',
    price: '$1,200/mo',
    hours: '20 hrs/mo',
    description: 'Reliable ongoing support for growing firms',
    services: ['Litigation Support', 'Document Drafting', 'Case Management', 'Contract Review'],
    billingNote: 'Invoiced on the 1st · Due within 7 days · Overage at $58/hr · Cancel with 15-day notice',
  },
  {
    id: 'growth',
    label: 'Growth',
    price: '$2,200/mo',
    hours: '40 hrs/mo',
    description: 'Dedicated capacity for high-volume practices',
    services: ['Litigation Support', 'Case Management', 'Deposition Prep', 'Document Drafting', 'Legal Research'],
    billingNote: 'Invoiced on the 1st · Due within 7 days · Overage at $52/hr · Cancel with 15-day notice',
  },
  {
    id: 'project',
    label: 'Project / Hourly',
    price: 'Custom',
    hours: 'As needed',
    description: 'One-off projects or hourly engagements',
    services: ['Litigation Support', 'Contract Review', 'Legal Research', 'Document Drafting', 'Case Management', 'Deposition Prep', 'Other / Multiple Services'],
    billingNote: 'Quoted per project · Invoiced upon completion or milestone',
  },
];

// ─── Main component ────────────────────────────────────────────────────────────

export default function ContactSplit() {
  const [formState, setFormState] = useState<FormState>({
    name: '',
    firm: '',
    email: '',
    service: '',
    message: '',
    retainerTier: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<TouchedFields>({});
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>({ visible: false, type: 'success', message: '' });
  const formStartedRef = useRef(false);

  // Auto-suggest state
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [appliedParalegal, setAppliedParalegal] = useState<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ visible: true, type, message });
  };

  // Debounced suggestion analysis on message change
  const runSuggestion = useCallback((message: string, currentService: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const result = analyzeSuggestion(message);
      if (result && !suggestionDismissed) {
        // Only show if service not already manually selected or suggestion differs
        if (!currentService || currentService !== result.service) {
          setSuggestion(result);
        }
      } else if (!result) {
        setSuggestion(null);
      }
    }, 600);
  }, [suggestionDismissed]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (!formStartedRef.current) {
      formStartedRef.current = true;
      trackFormStart();
    }
    setFormState((prev) => {
      const next = { ...prev, [name]: value };
      // Re-run suggestion when message changes
      if (name === 'message') {
        setSuggestionDismissed(false);
        runSuggestion(value, next.service);
      }
      // Clear suggestion if user manually picks a service
      if (name === 'service' && value) {
        setSuggestion(null);
        setSuggestionDismissed(true);
      }
      return next;
    });
    if (touched[name as keyof TouchedFields]) {
      const error = validateField(name as keyof FormState, value);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
    if (name === 'service' && value) {
      trackServiceSelected(value);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name as keyof FormState, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
    trackFieldInteraction(name);
  };

  const handleAcceptSuggestion = (service: string, paralegal: string) => {
    setFormState((prev) => ({ ...prev, service }));
    setAppliedParalegal(paralegal);
    setSuggestion(null);
    setSuggestionDismissed(true);
    // Clear service error if present
    setErrors((prev) => ({ ...prev, service: '' }));
    trackServiceSelected(service);
  };

  const handleDismissSuggestion = () => {
    setSuggestion(null);
    setSuggestionDismissed(true);
  };

  const handleTierChange = (tierId: RetainerTier) => {
    const tier = RETAINER_TIERS.find((t) => t.id === tierId);
    setFormState((prev) => ({
      ...prev,
      retainerTier: tierId,
      // Pre-fill service with first option of the tier if current service not in tier's list
      service: tier && !tier.services.includes(prev.service) ? tier.services[0] : prev.service,
    }));
    // Clear service error if present
    setErrors((prev) => ({ ...prev, service: '' }));
    setSuggestion(null);
    setSuggestionDismissed(true);
    // Track retainer tier interest for conversion funnel analytics
    if (tierId && tier) {
      trackRetainerTierInterest({
        tierName: tier.label,
        tierId,
        source: 'contact_form',
        price: tier.price,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched: TouchedFields = { name: true, firm: true, email: true, service: true, message: true };
    setTouched(allTouched);
    const allErrors = validateAll(formState);
    setErrors(allErrors);

    trackFormSubmitAttempt();

    if (Object.values(allErrors).some((err) => err)) {
      trackFormError('validation_failed');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/contact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formState,
          assigned_paralegal: appliedParalegal || null,
          suggested_service: suggestion?.service || null,
          utmSource:
            typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('utm_source') ?? 'direct'
              : 'direct',
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to send message');
      }

      trackFormSuccess(formState.service);
      trackContactFormSubmit(formState.service);
      trackLeadQuality({
        source: 'contact_form',
        service: formState.service,
        conversionType: 'inquiry',
      });
      // Enhanced submission event with source + service_type attribution
      trackContactFormSubmission({
        serviceType: formState.service,
        retainerTier: formState.retainerTier || undefined,
        inquiryId: result.inquiryId || null,
      });
      showToast('success', 'Your message has been received. I\'ll respond within one business day.');
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      trackFormError(message);
      showToast('error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass = (field: keyof FormErrors, extra = '') => {
    const base = 'w-full px-4 py-3 rounded-xl border bg-input text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all duration-200';
    if (touched[field] && errors[field]) {
      return `${base} border-red-400 focus:ring-red-300/40 focus:border-red-400 ${extra}`;
    }
    if (touched[field] && !errors[field] && formState[field]) {
      return `${base} border-green-500/60 focus:ring-accent/40 focus:border-accent ${extra}`;
    }
    return `${base} border-border focus:ring-accent/40 focus:border-accent ${extra}`;
  };

  // Derive available service options based on selected tier
  const availableServices = formState.retainerTier
    ? (RETAINER_TIERS.find((t) => t.id === formState.retainerTier)?.services ?? serviceOptions)
    : serviceOptions;

  const selectedTierConfig = formState.retainerTier
    ? RETAINER_TIERS.find((t) => t.id === formState.retainerTier)
    : null;

  return (
    <section className="py-12 md:py-24 bg-background">
      {/* Toast Notification */}
      <div
        aria-live="polite"
        className={`fixed top-6 right-6 z-50 max-w-sm w-full transition-all duration-500 ${
          toast.visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-3 pointer-events-none'
        }`}
      >
        <div
          className={`flex items-start gap-3 px-5 py-4 rounded-2xl shadow-xl border backdrop-blur-sm ${
            toast.type === 'success' ?'bg-card border-accent/30 text-foreground' :'bg-card border-red-400/30 text-foreground'
          }`}
        >
          <div
            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
              toast.type === 'success' ? 'bg-accent/15 text-accent' : 'bg-red-400/15 text-red-400'
            }`}
          >
            {toast.type === 'success' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold mb-0.5">
              {toast.type === 'success' ? 'Message Sent!' : 'Delivery Failed'}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{toast.message}</p>
          </div>
          <button
            onClick={() => setToast((prev) => ({ ...prev, visible: false }))}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
            aria-label="Dismiss notification"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 md:px-10">
        <div className="grid lg:grid-cols-5 gap-8 lg:gap-20 items-start">

          {/* Left — Contact Info */}
          <div className="lg:col-span-2 flex flex-col gap-7 md:gap-10">
            {/* Personal note */}
            <div className="bg-secondary/60 border border-border card-rounded p-6 md:p-8">
              <p className="font-serif text-xl md:text-2xl italic text-foreground mb-3 md:mb-4 leading-snug">
                "I treat every client's matter with the same care I would give my own."
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed font-light">
                Whether you're a solo practitioner needing occasional support or a mid-size firm seeking a reliable ongoing partner, I'm here to help. Let's discuss what you need.
              </p>
            </div>

            {/* Contact Details */}
            <div className="flex flex-col gap-4 md:gap-5">
              {contactDetails.map((detail) => (
                <div key={detail.label} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0 mt-0.5">
                    {detail.icon}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">{detail.label}</p>
                    {detail.href ? (
                      <a
                        href={detail.href}
                        target={detail.href.startsWith('https://wa.me') ? '_blank' : undefined}
                        rel={detail.href.startsWith('https://wa.me') ? 'noopener noreferrer' : undefined}
                        className="text-foreground font-medium hover:text-accent transition-colors duration-200 text-sm break-all"
                      >
                        {detail.value}
                      </a>
                    ) : (
                      <p className="text-foreground font-medium text-sm">{detail.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Digital Card Link */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
                </svg>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">Digital Card</p>
                <a
                  href="https://mycrd.is/BroussardLegalServices"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground font-medium hover:text-accent transition-colors duration-200 text-sm break-all"
                >
                  mycrd.is/BroussardLegalServices
                </a>
              </div>
            </div>

            {/* Stat badges */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="bg-secondary/60 border border-border card-rounded-sm p-4 md:p-5 text-center">
                <p className="stat-number text-3xl">4+</p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Years Exp.</p>
              </div>
              <div className="bg-secondary/60 border border-border card-rounded-sm p-4 md:p-5 text-center">
                <p className="stat-number text-3xl">1 Day</p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Response Time</p>
              </div>
            </div>

            {/* Intake QR Code */}
            <div className="bg-secondary/60 border border-accent/20 card-rounded p-5 flex items-center gap-4">
              <div className="bg-white rounded-xl p-2 shrink-0 shadow-sm">
                <QRCodeImage
                  value="https://maggimaybr6854.builtwithrocket.new/post-booking-intake"
                  size={72}
                  bgColor="#ffffff"
                  fgColor="#4A3728"
                  level="H"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Start Your Intake</p>
                <p className="text-sm font-medium text-foreground leading-snug">Scan to complete post-booking intake</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">Docs · Retainer · Payment — all in one flow</p>
                <a
                  href="/post-booking-intake"
                  className="text-[11px] text-accent font-semibold hover:underline mt-0.5 inline-flex items-center gap-1"
                >
                  Open intake form
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Client Portal QR Code */}
            <div className="bg-secondary/60 border border-accent/20 card-rounded p-5 flex items-center gap-4">
              <div className="bg-white rounded-xl p-2 shrink-0 shadow-sm">
                <QRCodeImage
                  value="https://maggimaybr6854.builtwithrocket.new/portal/login"
                  size={56}
                  bgColor="#ffffff"
                  fgColor="#355E3B"
                  level="H"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Client Portal</p>
                <p className="text-sm font-medium text-foreground leading-snug">Scan to access your portal</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">Cases · Documents · Invoices · Messages</p>
                <a
                  href="/portal/login"
                  className="text-[11px] text-accent font-semibold hover:underline mt-0.5 inline-flex items-center gap-1"
                >
                  Open client portal
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Right — Contact Form */}
          <div className="lg:col-span-3">
            {submitted ? (
              <div className="bg-secondary/60 border border-accent/20 card-rounded p-8 md:p-12 flex flex-col items-center gap-6">
                {/* Success icon */}
                <div className="w-20 h-20 rounded-full bg-accent/15 flex items-center justify-center text-accent">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>

                {/* Heading */}
                <div className="text-center">
                  <h3 className="font-serif text-3xl text-foreground mb-3">Message Received</h3>
                  <p className="text-muted-foreground font-light leading-relaxed max-w-sm mx-auto">
                    Thank you for reaching out. I'll review your inquiry and respond within one business day.
                  </p>
                  {appliedParalegal && (
                    <p className="text-sm text-accent font-medium mt-3">
                      Routed to: {appliedParalegal}
                    </p>
                  )}
                </div>

                {/* Email confirmation banner */}
                <div className="w-full bg-accent/8 border border-accent/30 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                      <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Confirmation email sent</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      A confirmation has been sent to <span className="font-semibold text-accent">{formState.email}</span>. Check your inbox (and spam folder) for a summary of your inquiry.
                    </p>
                  </div>
                </div>

                {/* What happens next */}
                <div className="w-full bg-card border border-border rounded-2xl p-6 flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">What happens next</p>
                  {[
                    { step: '1', text: 'Your inquiry is stored and I\'ve been notified' },
                    { step: '2', text: 'A confirmation email has been sent to your inbox' },
                    { step: '3', text: 'I\'ll personally follow up within 1 business day' },
                  ].map(({ step, text }) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-accent text-xs font-bold shrink-0 mt-0.5">
                        {step}
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>

                {/* CTA links */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                  <a
                    href="/availability"
                    className="flex-1 py-3 bg-primary text-primary-foreground rounded-full text-sm font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity text-center"
                  >
                    Book a Consultation
                  </a>
                  <a
                    href="mailto:broussardlegalservices@gmail.com"
                    className="flex-1 py-3 border border-border rounded-full text-sm font-medium text-foreground hover:border-accent hover:text-accent transition-colors text-center"
                  >
                    broussardlegalservices@gmail.com
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="bg-card border border-border card-rounded p-6 md:p-10 flex flex-col gap-5 md:gap-6">
                <div>
                  <h2 className="font-serif text-3xl text-foreground mb-2">Send a Message</h2>
                  <p className="text-sm text-muted-foreground font-light">All fields are required. Your information is kept strictly confidential.</p>
                </div>

                {/* ── Retainer Tier Radio Buttons ── */}
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Which retainer tier interests you?
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {RETAINER_TIERS.map((tier) => {
                      const isSelected = formState.retainerTier === tier.id;
                      return (
                        <label
                          key={tier.id}
                          className={`relative flex flex-col gap-1 cursor-pointer rounded-xl border p-3.5 transition-all duration-200 ${
                            isSelected
                              ? 'border-accent bg-accent/8 ring-1 ring-accent/40' :'border-border bg-input/40 hover:border-accent/40 hover:bg-accent/4'
                          }`}
                        >
                          <input
                            type="radio"
                            name="retainerTier"
                            value={tier.id}
                            checked={isSelected}
                            onChange={() => handleTierChange(tier.id)}
                            className="sr-only"
                          />
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-sm font-semibold leading-tight ${isSelected ? 'text-accent' : 'text-foreground'}`}>
                              {tier.label}
                            </span>
                            <span className={`text-xs font-bold ${isSelected ? 'text-accent' : 'text-muted-foreground'}`}>
                              {tier.price}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground leading-snug">{tier.hours} · {tier.description}</span>
                          {isSelected && (
                            <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {/* Billing term reminder */}
                  {selectedTierConfig && (
                    <div className="flex items-start gap-2.5 bg-accent/6 border border-accent/20 rounded-xl px-4 py-3 mt-0.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0 mt-0.5">
                        <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
                      </svg>
                      <p className="text-[11px] text-accent/90 leading-relaxed font-medium">
                        {selectedTierConfig.billingNote}
                      </p>
                    </div>
                  )}
                </div>

                {/* Name + Firm */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="name" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Your Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={formState.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Jane Smith"
                      aria-invalid={!!(touched.name && errors.name)}
                      aria-describedby={errors.name ? 'name-error' : undefined}
                      className={fieldClass('name')}
                    />
                    {touched.name && errors.name && (
                      <p id="name-error" className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        {errors.name}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="firm" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Firm / Company
                    </label>
                    <input
                      id="firm"
                      name="firm"
                      type="text"
                      value={formState.firm}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Smith & Associates LLP"
                      aria-invalid={!!(touched.firm && errors.firm)}
                      aria-describedby={errors.firm ? 'firm-error' : undefined}
                      className={fieldClass('firm')}
                    />
                    {touched.firm && errors.firm && (
                      <p id="firm-error" className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        {errors.firm}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formState.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="jane@smithlaw.com"
                    aria-invalid={!!(touched.email && errors.email)}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    className={fieldClass('email')}
                  />
                  {touched.email && errors.email && (
                    <p id="email-error" className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Message — placed BEFORE service so suggestions appear contextually */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="message" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Describe Your Needs
                    </label>
                    <span className={`text-xs ${formState.message.trim().length > 0 && formState.message.trim().length < 20 ? 'text-red-400' : 'text-muted-foreground/60'}`}>
                      {formState.message.trim().length}/20 min
                    </span>
                  </div>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    value={formState.message}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Please describe your firm's needs, practice area, and any relevant details about the engagement…"
                    aria-invalid={!!(touched.message && errors.message)}
                    aria-describedby={errors.message ? 'message-error' : undefined}
                    className={fieldClass('message', 'resize-none')}
                  />
                  {touched.message && errors.message && (
                    <p id="message-error" className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {errors.message}
                    </p>
                  )}
                </div>

                {/* Auto-suggest card — appears between message and service */}
                {suggestion && !suggestionDismissed && (
                  <SuggestionCard
                    suggestion={suggestion}
                    onAccept={handleAcceptSuggestion}
                    onDismiss={handleDismissSuggestion}
                  />
                )}

                {/* Service Type */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="service" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Service Needed
                    </label>
                    {appliedParalegal && (
                      <span className="text-[10px] text-accent font-semibold flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Routed to {appliedParalegal}
                      </span>
                    )}
                  </div>
                  <select
                    id="service"
                    name="service"
                    value={formState.service}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={!!(touched.service && errors.service)}
                    aria-describedby={errors.service ? 'service-error' : undefined}
                    className={fieldClass('service', 'appearance-none cursor-pointer')}
                  >
                    <option value="" disabled>Select a service…</option>
                    {availableServices.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {touched.service && errors.service && (
                    <p id="service-error" className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {errors.service}
                    </p>
                  )}
                </div>

                {/* Confidentiality note */}
                <p className="text-xs text-muted-foreground/70 font-light">
                  🔒 All communications are kept strictly confidential. I do not share your information with any third parties.
                </p>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-primary text-primary-foreground rounded-full text-sm font-semibold uppercase tracking-widest hover:opacity-90 transition-all duration-300 flex items-center justify-center gap-2 hover:gap-3 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      Send Message
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}